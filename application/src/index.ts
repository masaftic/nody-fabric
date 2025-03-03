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

        // TODO: Off-line signing 
        // https://hyperledger.github.io/fabric-gateway/main/api/node/interfaces/Contract.html#off-line-signing     
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

async function initLedger(contract: Contract) {
    console.log(`\n--> InitLedger initializes the ledger with some sample elections`);

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

async function castVote(contract: Contract, voteId: string, voterId: string, electionId: string, candidateId: string): Promise<void> {
    console.log(`\n--> Submit Transaction: CastVote, function casts a vote for election ${electionId}`);

    await contract.submitTransaction('CastVote', voteId, voterId, electionId, candidateId);

    console.log('*** Transaction committed successfully');
}

async function getVote(contract: Contract, voteId: string): Promise<void> {
    console.log(`\n--> Evaluate Transaction: GetVote, function returns the vote with ID ${voteId}`);

    const resultBytes = await contract.evaluateTransaction('GetVote', voteId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

async function getElection(contract: Contract, electionID: string): Promise<void> {
    console.log(`\n--> Evaluate Transaction: GetElection, function returns the election with ID ${electionID}`);

    const resultBytes = await contract.evaluateTransaction('GetElection', electionID);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
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

        // Cast a vote
        await castVote(contract, 'vote123', 'uuid-xyz', 'election123', 'candidateA');

        // Get the vote
        await getVote(contract, 'vote123');

        await getElection(contract, 'election123');
    }
    finally {
        gateway.close();
        client.close();
    }
}

main().catch(console.error);