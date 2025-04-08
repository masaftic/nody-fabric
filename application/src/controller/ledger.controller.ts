import {Request, Response} from "express";
import {fabricConnection} from "../fabric-utils/fabric";
import {VotingContractController} from "../fabric-utils/votingContractController";
import {StatusCodes} from "http-status-codes";

const init = async (req: Request, res: Response) => {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(req.body.userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        await votingController.initLedger();
        res.status(StatusCodes.CREATED).json({ message: 'ledger initialized successfully' });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

const voteCast = async (req: Request, res: Response) => {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(req.body.userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        const result = await votingController.getWorldState();
        res.status(StatusCodes.OK).json({ message: 'Vote cast successfully', result });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

const clear = async (req: Request, res: Response) => {
    if (!req.body.userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(req.body.userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        await votingController.clearVotes();
        await votingController.clearElections();
        res.status(StatusCodes.OK).json({ message: 'Ledger cleared successfully' });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

export {
    init as initLedger,
    voteCast,
    clear as deleteLedger
}