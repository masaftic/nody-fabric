import {Request, Response} from "express";
import {fabricConnection, withFabricConnection} from "../fabric-utils/fabric";
import {BlockChainRepository} from "../fabric-utils/BlockChainRepository";
import {StatusCodes} from "http-status-codes";
import { VoteModel } from "../models/election.model";
import { logger } from "../logger";
import crypto from 'crypto';

async function vote(req: Request, res: Response) {
    const { userId, electionId, candidateId } = req.body;
    if (!userId || !electionId || !candidateId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    withFabricConnection(userId, async (contract) => {
        const voteId = crypto.randomUUID();
        const votingController = new BlockChainRepository(contract);
        try {
            // Call the CastVote function on the chaincode
            await votingController.castVote(voteId, electionId, candidateId);
            
            // Save vote record in MongoDB for user-related tracking
            try {
                // Generate a receipt
                const receipt = crypto.createHash('sha256').update(`${voteId}${electionId}${candidateId}`).digest('hex');
                
                await VoteModel.create({
                    vote_id: voteId,
                    voter_id: userId,
                    election_id: electionId,
                    candidate_id: candidateId,
                    receipt: receipt,
                    timestamp: new Date()
                });
                
                logger.info(`Vote record saved to MongoDB for user ${userId}`);
            } catch (dbError) {
                logger.error(`Failed to save vote record to MongoDB: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
                // Continue with success response even if MongoDB save fails
                // since the blockchain transaction was successful
            }
            
            res.status(StatusCodes.OK).json({
                message: 'Vote cast successfully',
                voteId
            });
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: `Error casting vote: ${error instanceof Error ? error.message : String(error)}`,
                json: JSON.stringify(error)
            });
        }
    });
}

async function getVote(req: Request, res: Response) {
    const { userId } = req.body;
    const { voteId } = req.params;
    if (!userId || !voteId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    withFabricConnection(userId, async (contract) => {
        try {
            const votingController = new BlockChainRepository(contract);
            const result = await votingController.getVote(voteId);
            res.status(StatusCodes.OK).json({ message: 'Vote retrieved successfully', result });
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: `Error retrieving vote: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    });
}

const getVotes = async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    withFabricConnection(userId, async (contract) => {
        try {
            const votingController = new BlockChainRepository(contract);
            const result = await votingController.getAllVotes();
            res.status(StatusCodes.OK).json({ message: 'Votes retrieved successfully', result });
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: `Error retrieving votes: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    });
}

async function getUserVotes(req: Request, res: Response) {
    const { userId } = req.params;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing user ID' });
        return;
    }

    try {
        // Get user's votes from MongoDB
        const votes = await VoteModel.find({ voter_id: userId });
        res.status(StatusCodes.OK).json({ 
            message: 'User votes retrieved successfully', 
            votes 
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving user votes: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

export {
    vote as userVote,
    getVote as getUserVote,
    getVotes as getAllVotes,
    getUserVotes
}