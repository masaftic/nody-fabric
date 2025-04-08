import express, { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import { caURL, fabricCaTlsCertPath } from './fabric-utils/config';
import { IdentityManager } from './fabric-utils/identityManager';
import { VotingContractController } from './fabric-utils/votingContractController';
import { fabricConnection } from './fabric-utils/fabric';
import {mainRouter} from "./routes/main.route";
import {userRouter} from "./routes/user.route";
import {votesRouter} from "./routes/votes.route";
import {electionRouter} from "./routes/election.route";
import {ledgerRouter} from "./routes/ledger.route";

export const createServerApp = async () => {
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req: Request, res: Response, next: NextFunction) => {
        logger.info(`Request: ${req.method} ${req.url}`);
        next();
    });

    // app.get('/api', (req, res) => {
    //     res.send('Hello World!');
    // });
    app.use("/api/test",mainRouter)
    // app.post('/api/users/register', async (req: Request, res: Response) => {
    //     const identityManager = new IdentityManager(caURL, fabricCaTlsCertPath);
    //
    //     const admin = await identityManager.enrollAdmin();
    //     const secret = await identityManager.registerUser(admin, req.body.userId, req.body.affiliation, req.body.role)
    //
    //     const userEnrollment = await identityManager.enrollUser(req.body.userId, secret);
    //
    //     res.status(201).json({
    //         message: 'User registered successfully',
    //         certificate: userEnrollment.certificate,
    //         key: userEnrollment.key.toBytes(),
    //     });
    // })

    app.use("/api/user",userRouter)
    // /api/user/send-sms
    // app.post('/api/votes', async (req: Request, res: Response) => {
    //     const { userId, electionId, candidateId } = req.body;
    //     if (!userId || !electionId || !candidateId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         await votingController.castVote(crypto.randomUUID(), electionId, candidateId);
    //         res.status(200).json({ message: 'Vote cast successfully' });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });
    //
    // app.get('/api/votes/:voteId', async (req: Request, res: Response) => {
    //     const { userId } = req.body;
    //     const { voteId } = req.params;
    //     if (!userId || !voteId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         const result = await votingController.getVote(voteId);
    //         res.status(200).json({ message: 'Vote retrieved successfully', result });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });
    //
    // app.get('/api/votes', async (req: Request, res: Response) => {
    //     const { userId } = req.body;
    //     if (!userId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         const result = await votingController.getAllVotes();
    //         res.status(200).json({ message: 'Votes retrieved successfully', result });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });

    app.use("/api/vote",votesRouter)
    // app.get('/api/elections/:electionId', async (req: Request, res: Response) => {
    //     const { userId } = req.body;
    //     const { electionId } = req.params;
    //     if (!userId || !electionId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         const result = await votingController.getElection(electionId);
    //         res.status(200).json({ message: 'Election retrieved successfully', result });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });
    app.use("/api/election",electionRouter)

    // app.post('/api/ledger/init', async (req: Request, res: Response) => {
    //     if (!req.body.userId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(req.body.userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         await votingController.initLedger();
    //         res.status(201).json({ message: 'ledger initialized successfully' });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });

    // app.get('/api/ledger', async (req: Request, res: Response) => {
    //     if (!req.body.userId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(req.body.userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         const result = await votingController.getWorldState();
    //         res.status(200).json({ message: 'Vote cast successfully', result });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });

    // app.delete('/api/ledger/clear', async (req: Request, res: Response) => {
    //     if (!req.body.userId) {
    //         res.status(400).json({ message: 'Missing required fields' });
    //         return;
    //     }
    //
    //     const [gateway, client] = await fabricConnection(req.body.userId);
    //     try {
    //         const contract = gateway.getNetwork('mychannel').getContract('basic');
    //         const votingController = new VotingContractController(contract);
    //         await votingController.clearVotes();
    //         await votingController.clearElections();
    //         res.status(200).json({ message: 'Ledger cleared successfully' });
    //         return;
    //     } finally {
    //         gateway.close();
    //         client.close();
    //     }
    // });

    app.use("/api/ledger",ledgerRouter)

    app.use((req: Request, res: Response) => {
        res.status(404).json({
            status: 'Not Found',
            timestamp: new Date().toISOString(),
        });
    });

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        logger.error(err);
        res.status(500).json({
            status: 'Internal Server Error',
            timestamp: new Date().toISOString(),
        });
    });

    return app;
}