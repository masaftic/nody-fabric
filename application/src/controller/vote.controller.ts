import {Request, Response} from "express";
import {fabricConnection} from "../fabric-utils/fabric";
import {VotingContractController} from "../fabric-utils/votingContractController";
import {StatusCodes} from "http-status-codes";

const vote =  async (req: Request, res: Response) => {
    const { userId, electionId, candidateId } = req.body;
    if (!userId || !electionId || !candidateId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        await votingController.castVote(crypto.randomUUID(), electionId, candidateId);
        res.status(StatusCodes.OK).json({ message: 'Vote cast successfully' });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

const getVote =  async (req: Request, res: Response) => {
    const { userId } = req.body;
    const { voteId } = req.params;
    if (!userId || !voteId) {
        res.status(StatusCodes.BAD_REQUEST).
        json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        const result = await votingController.getVote(voteId);
        res.status(StatusCodes.OK).json({ message: 'Vote retrieved successfully', result });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

const getVotes = async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        const result = await votingController.getAllVotes();
        res.status(StatusCodes.OK).json({ message: 'Votes retrieved successfully', result });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}
export {
    vote as userVote,
    getVote as getUserVote,
    getVotes as getAllVotes
}