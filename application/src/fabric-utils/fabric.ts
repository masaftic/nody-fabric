import { connect, Contract, Gateway, hash, Identity, Signer } from "@hyperledger/fabric-gateway";
import * as grpc from '@grpc/grpc-js';
import { adminWalletPath, mspId, peerEndpoint, peerHostAlias, tlsCertPath, usersWalletPath } from "./config";
import * as fs from 'fs/promises';
import path from "path";
import * as crypto from 'crypto';
import { signers } from "@hyperledger/fabric-gateway";
import { logger } from "../logger";

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

async function userSigner(userId: string): Promise<Signer> {
    const keyPath = path.join(usersWalletPath, userId, 'key.pem');
    const privateKeyPEM = await fs.readFile(keyPath);
    // return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPEM));

    return async (digest: Uint8Array): Promise<Uint8Array> => {
        logger.info('Custom signer: Signing digest:');

        // Simulate a delay (e.g., to mimic mobile device signing)
        // await new Promise(resolve => setTimeout(resolve, 200));

        const privateKey = crypto.createPrivateKey(privateKeyPEM);
        const signer = signers.newPrivateKeySigner(privateKey);
        const signature = await signer(digest);

        logger.info('Custom signer: Generated signature');

        return signature;
    }
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

export async function fabricConnection(userId: string): Promise<[Gateway, grpc.Client]> {
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await userIdentity(userId),
        signer: await userSigner(userId),

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
    callback: (contract: Contract) => Promise<T>
): Promise<T> {
    const [gateway, client] = await fabricConnection(userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        return await callback(contract); // Execute the callback and return its result
    } finally {
        client.close();
        gateway.close();
    }
}
