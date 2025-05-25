import { connect, Contract, Gateway, hash, Identity, Signer } from "@hyperledger/fabric-gateway";
import * as grpc from '@grpc/grpc-js';
import { adminWalletPath, mspId, peerEndpoint, peerHostAlias, tlsCertPath, usersWalletPath } from "./config";
import * as fs from 'fs/promises';
import path from "path";
import * as crypto from 'crypto';
import { signers } from "@hyperledger/fabric-gateway";
import { logger } from "../logger";
import { hasConnectedSigningClients, registerSigningHandler } from "../service/socket-io.service";

async function adminIdentity(): Promise<Identity> {
    const adminCredPath = path.join(adminWalletPath, '..', 'admin');
    const certPath = path.join(adminCredPath, 'cert.pem');
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function userIdentity(userId: string): Promise<Identity> {
    const certPath = path.join(usersWalletPath, userId, 'cert.pem');
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function userSigner(userId: string, useRemoteSigning: boolean = false): Promise<Signer> {
    // If not using remote signing, use local key
    if (!useRemoteSigning) {
        const keyPath = path.join(usersWalletPath, userId, 'key.pem');
        const privateKeyPEM = await fs.readFile(keyPath);

        return async (digest: Uint8Array): Promise<Uint8Array> => {
            logger.info('Local signer: Signing digest');

            const privateKey = crypto.createPrivateKey(privateKeyPEM);
            const signer = signers.newPrivateKeySigner(privateKey);
            const signature = await signer(digest);

            logger.info('Local signer: Generated signature');

            return signature;
        }
    }

    // For remote signing
    return async (digest: Uint8Array): Promise<Uint8Array> => {
        logger.info(`Remote signer: Requesting signature for user ${userId}`);

        // Track signing request count for this user
        if (!global.signingRequests) {
            global.signingRequests = {};
        }
        if (!global.signingRequests[userId]) {
            global.signingRequests[userId] = 0;
        }
        global.signingRequests[userId]++;

        // The actual remote signing logic will be handled by the Socket.IO service
        const signature = await requestRemoteSignature(userId, digest);

        logger.info(`Remote signer: Received signature for user ${userId} (request #${global.signingRequests[userId]})`);

        return signature;
    }
}


// Simple function to request a signature from the remote client via Socket.IO
async function requestRemoteSignature(userId: string, digest: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        if (!global.socketService) {
            reject(new Error('Socket service not available for remote signing'));
            return;
        }
        
        // Check if there are any connected signing clients for this user
        if (!hasConnectedSigningClients(userId)) {
            reject(new Error(`No connected signing clients for user ${userId}`));
            return;
        }

        // Generate a unique request ID
        const requestId = crypto.randomUUID();

        // Set timeout
        const timeout = setTimeout(() => {
            // Clean up the handler when timing out
            if (global.signingHandlers) {
                delete global.signingHandlers[requestId];
            }
            reject(new Error('Remote signing request timed out'));
        }, 30000); // 30 seconds timeout

        // Register handler for this signing request
        registerSigningHandler(requestId, (data) => {
            logger.info(`Received remote signing response for request ${requestId}`);
            logger.debug(`Remote signing response data: ${JSON.stringify(data)}`);

            clearTimeout(timeout);

            if (data.error) {
                reject(new Error(`Remote signing failed: ${data.error}`));
                return;
            }

            try {
                const signatureBuffer = Buffer.from(data.signature, 'base64');
                resolve(new Uint8Array(signatureBuffer));
            } catch (error) {
                reject(error);
            }
        });

        logger.debug(`digest: ${digest}`);

        // Emit the signing request to the client
        global.socketService.emit('signing-request', {
            userId,
            requestId,
            digest: Buffer.from(digest).toString('base64')
        });

        logger.info(`Sent signing request ${requestId} for user ${userId}`);
    });
}

async function adminSigner(): Promise<Signer> {
    const adminCredPath = path.join(adminWalletPath, '..', 'admin');
    const keyPath = path.join(adminCredPath, 'key.pem');
    const privateKeyPEM = await fs.readFile(keyPath);

    return async (digest: Uint8Array): Promise<Uint8Array> => {
        logger.info('Admin signer: Signing digest');

        const privateKey = crypto.createPrivateKey(privateKeyPEM);
        const signer = signers.newPrivateKeySigner(privateKey);
        const signature = await signer(digest);

        logger.info('Admin signer: Generated signature');

        return signature;
    }
}

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

export async function fabricConnection(
    userId: string,
    useRemoteSigning: boolean = false
): Promise<[Gateway, grpc.Client]> {
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await userIdentity(userId),
        signer: await userSigner(userId, useRemoteSigning),

        hash: hash.sha256,

        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    return [gateway, client];
}

export async function fabricAdminConnection(): Promise<[Gateway, grpc.Client]> {
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await adminIdentity(),
        signer: await adminSigner(),

        hash: hash.sha256,

        // Default timeouts for different gRPC calls - may need longer timeouts for admin operations
        evaluateOptions: () => {
            return { deadline: Date.now() + 10000 }; // 10 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 30000 }; // 30 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 10000 }; // 10 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 120000 }; // 2 minutes
        },
    });

    return [gateway, client];
}


export async function withFabricAdminConnection<T>(
    callback: (contract: Contract) => Promise<T>
): Promise<T> {
    const [gateway, client] = await fabricAdminConnection();
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        return await callback(contract); // Execute the callback and return its result
    } finally {
        client.close();
        gateway.close();
    }
}

export async function withFabricConnection<T>(
    userId: string,
    callback: (contract: Contract) => Promise<T>,
    useRemoteSigning: boolean = false
): Promise<T> {
    const [gateway, client] = await fabricConnection(userId, useRemoteSigning);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        return await callback(contract); // Execute the callback and return its result
    } finally {
        client.close();
        gateway.close();
    }
}
