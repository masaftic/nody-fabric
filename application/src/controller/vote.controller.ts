import { Request, Response, NextFunction } from "express";
import { fabricConnection, withFabricConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";
import { VoteModel, VoteTallyModel } from "../models/election.model";
import { logger } from "../logger";
import crypto from 'crypto';

async function vote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { electionId, candidateId } = req.body;
        // Get userId from JWT token
        const userId = req.user?.user_id;
        
        if (!userId || !electionId || !candidateId) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
            return;
        }

        const receipt = await withFabricConnection(userId, async (contract) => {
            const voteId = crypto.randomUUID();
            const blockchainRepo = new BlockChainRepository(contract);
            // Call the CastVote function on the chaincode
            return await blockchainRepo.castVote(voteId, electionId, candidateId);
        });

        res.status(StatusCodes.OK).json({
            message: 'Vote cast successfully',
            receipt
        });
    } catch (error) {
        next(error);
    }
}

async function getVote(req: Request, res: Response) {
    // Get userId from JWT token
    const userId = req.user?.user_id;
    const { voteId } = req.params;
    
    if (!userId || !voteId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    await withFabricConnection(userId, async (contract) => {
        try {
            const blockchainRepo = new BlockChainRepository(contract);
            const result = await blockchainRepo.getVote(voteId);
            res.status(StatusCodes.OK).json({ message: 'Vote retrieved successfully', result });
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: `Error retrieving vote: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    });
}

async function getVotes(req: Request, res: Response) {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        const result = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.getAllVotes();
        });
        res.status(StatusCodes.OK).json({ message: 'Votes retrieved successfully', result });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving votes: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

async function getUserVotes(req: Request, res: Response): Promise<void> {
    // If userId in params, use that, otherwise get from JWT token
    let userId = req.params.userId;
    
    // If admin or auditor accessing another user's votes, allow it
    // If no userId provided, use the authenticated user's ID
    if (!userId && req.user) {
        userId = req.user.user_id;
    }
    
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


async function submitVoterFeedback(req: Request, res: Response) {
    const { election_id, receipt, feedback, comments } = req.body;
    const userId = req.user?.user_id;

    if (!userId || !election_id || !receipt || !feedback) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    // TODO: Implement feedback submission logic
}

/**
 * Get real-time vote tally for a specific election
 */
async function getVoteTally(req: Request, res: Response): Promise<void> {
    const { electionId } = req.params;
    
    if (!electionId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Election ID is required' });
        return;
    }

    try {
        // Find the tally for the given election
        const tally = await VoteTallyModel.findOne({ election_id: electionId });
        
        if (!tally) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'No votes found for this election' });
            return;
        }
        
        // Get the election details to include candidate information
        const userId = req.user?.user_id;
        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
            return;
        }
        
        const election = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.getElection(electionId);
        });
        
        // Create a more detailed response that includes candidate details with their vote counts
        const candidatesWithVotes = election.candidates.map(candidate => {
            const candidateId = candidate.candidate_id;
            return {
                candidate_id: candidateId,
                name: candidate.name,
                party: candidate.party,
                votes: tally.tallies.get(candidateId) !== undefined
                    ? tally.tallies.get(candidateId)
                    : (() => { throw new Error(`Unexpected Candidate ID ${candidateId} not found in tally`); })(),
            };
        });
        
        res.status(StatusCodes.OK).json({
            message: 'Vote tally retrieved successfully',
            election_id: electionId,
            election_name: election.name,
            total_votes: tally.total_votes,
            candidates: candidatesWithVotes,
            last_updated: tally.last_updated
        });
    } catch (error) {
        logger.error(`Error retrieving vote tally: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving vote tally: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}


export {
    vote as userVote,
    getVote as getUserVote,
    getVotes as getAllVotes,
    getUserVotes,
    getVoteTally
}