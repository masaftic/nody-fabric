import FabricCAServices from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ICryptoSuite, ICryptoKey, User } from 'fabric-common';
import { IdentityManager } from './identityManager';
import * as grpc from '@grpc/grpc-js';
import { connect, Gateway, hash, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import { mspId, channelName, chaincodeName, tlsCertPath, peerEndpoint, fabricCaTlsCertPath, caURL, peerHostAlias, usersWalletPath } from './config';
import { VotingContractController } from './votingContractController';
import { timeOperation } from './utils';

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

async function registerAndEnrollUser() {
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

    console.log('Successfully registered and enrolled user:', userId);
}

async function main() {
    await registerAndEnrollUser();
    const [gateway, client] = await fabricConnection();

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        const votingController = new VotingContractController(contract);

        await timeOperation('Clear State', async () => {
            await votingController.clearVotes();
            await votingController.clearElections();
        });

        await timeOperation('Init Ledger', async () => {
            await votingController.initLedger();
        });

        console.log('World State: After Init');
        await votingController.getWorldState();

        
        const candidates = ['candidateA', 'candidateB'];
        const getRandomCandidate = () => candidates[Math.floor(Math.random() * candidates.length)];
        
        await timeOperation('Cast Votes', async () => {
            // Parallel vote submission
            const votePromises = Array(1000).fill(0).map((_, i) =>
                votingController.castVote(
                    `${crypto.randomBytes(5).toString('hex')}-${i}`,
                    'uuid-xyz',
                    'election123',
                    getRandomCandidate()
                )
            );
            await Promise.all(votePromises);
        });

        // console.log('World State: After votes');
        // await votingController.getWorldState();

        await timeOperation('Compute Tally', async () => {
            await votingController.computeVoteTally('election123');
        });

        await votingController.getElection('election123');
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(console.error);
