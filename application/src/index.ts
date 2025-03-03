import FabricCAServices from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ICryptoSuite, ICryptoKey, User } from 'fabric-common';
import { IdentityManager } from './IdentityManager';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, hash, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import { mspId, channelName, chaincodeName, tlsCertPath, peerEndpoint, fabricCaTlsCertPath, caURL, peerHostAlias, usersWalletPath } from './config';

const utf8Decoder = new TextDecoder();

async function getFirstDirFileName(dirPath: string): Promise<string> {
    const files = await fs.readdir(dirPath);
    const folder = files[0];
    if (!folder) {
        throw new Error(`No folders in directory: ${dirPath}`);
    }
    return path.join(dirPath, folder);
}

async function userIdentity(): Promise<Identity> {
    const userCredPath = await getFirstDirFileName(usersWalletPath);
    const certPath = path.join(userCredPath, 'cert.pem');
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
    const userCredPath = await getFirstDirFileName(usersWalletPath);
    const keyPath = path.join(userCredPath, 'key.pem');
    const privateKeyPEM = await fs.readFile(keyPath);

    const privateKey = crypto.createPrivateKey(privateKeyPEM);
    return signers.newPrivateKeySigner(privateKey);
}

async function fabricConnection(): Promise<[Gateway, grpc.Client]> {
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await userIdentity(),
        signer: await newSigner(),
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

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}


async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllAssets(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}


async function RegisterAndEnrollUser() {
    const tlsCert = await fs.readFile(fabricCaTlsCertPath);

    const identityManager = new IdentityManager(caURL, fabricCaTlsCertPath);

    // Enroll admin
    const adminIdentity = await identityManager.enrollAdmin();

    // Register and enroll a new user
    const userId = crypto.randomBytes(10).toString('hex');
    const userAffiliation = 'org1.department1';
    const userRole = 'voter';

    // Register user
    const secret = await identityManager.registerUser(
        adminIdentity,
        userId,
        userAffiliation,
        userRole
    );

    // Enroll user
    const userEnrollment = await identityManager.enrollUser(userId, secret);
    // Get certificate and private key

    console.log('Successfully registered and enrolled user:', userEnrollment);
}


async function main() {
    await RegisterAndEnrollUser();

    const [gateway, client] = await fabricConnection();

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        await initLedger(contract);
        await getAllAssets(contract);
    }
    catch (error) {
        gateway.close();
        client.close();
    }
}


main().catch(console.error);