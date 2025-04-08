import {Request, Response} from "express";
import {fabricConnection} from "../fabric-utils/fabric";
import {VotingContractController} from "../fabric-utils/votingContractController";
import {StatusCodes} from "http-status-codes";

const  getElection = async (req: Request, res: Response) => {
    const { userId } = req.body;
    const { electionId } = req.params;
    if (!userId || !electionId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    const [gateway, client] = await fabricConnection(userId);
    try {
        const contract = gateway.getNetwork('mychannel').getContract('basic');
        const votingController = new VotingContractController(contract);
        const result = await votingController.getElection(electionId);
        res.status(StatusCodes.OK).json({ message: 'Election retrieved successfully', result });
        return;
    } finally {
        gateway.close();
        client.close();
    }
}

export {
    getElection
}