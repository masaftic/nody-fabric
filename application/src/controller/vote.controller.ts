import { Request, Response, NextFunction } from "express";
import { fabricConnection, withFabricAdminConnection, withFabricConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";
import { VoteModel, VoteTallyModel } from "../models/election.model";
import { FeedbackModel } from "../models/feedback.model";
import { logger } from "../logger";
import crypto from 'crypto';

async function castVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { election_id, candidate_id } = req.body;
        // Get userId from JWT token
        const userId = req.user?.user_id;
        
        if (!userId || !election_id || !candidate_id) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
            return;
        }

        const receipt = await withFabricConnection(userId, async (contract) => {
            const voteId = crypto.randomUUID();
            const blockchainRepo = new BlockChainRepository(contract);
            // Call the CastVote function on the chaincode
            return await blockchainRepo.castVote(voteId, election_id, candidate_id);
        });

        res.status(StatusCodes.OK).json({
            message: 'Vote cast successfully',
            receipt
        });
    } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: `Error casting vote`
        });
        return;
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
    const { election_id, receipt, rating, comments } = req.body;
    const userId = req.user?.user_id;

    if (!userId || !election_id || !receipt || !rating) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // Verify the vote exists with this receipt
        const vote = await VoteModel.findOne({ receipt, election_id });
        
        if (!vote) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'Vote receipt not found or does not match election' });
            return;
        }
        
        // Check if the vote belongs to this user
        if (vote.voter_id !== userId) {
            res.status(StatusCodes.FORBIDDEN).json({ message: 'This vote receipt does not belong to you' });
            return;
        }
        
        // Check if feedback already exists for this receipt
        const existingFeedback = await FeedbackModel.findOne({ receipt });
        
        if (existingFeedback) {
            res.status(StatusCodes.CONFLICT).json({ message: 'Feedback has already been submitted for this vote' });
            return;
        }
        
        // Create new feedback
        const feedback = await FeedbackModel.create({
            voter_id: userId,
            election_id,
            receipt,
            rating: Number(rating),
            comments: comments || '',
            created_at: new Date()
        });
        
        res.status(StatusCodes.CREATED).json({
            message: 'Feedback submitted successfully',
            feedback_id: feedback._id
        });
    } catch (error) {
        logger.error(`Error submitting voter feedback: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error submitting voter feedback: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

/**
 * Verify a vote using the receipt
 * This allows voters to check if their vote was correctly recorded
 */
async function verifyVote(req: Request, res: Response): Promise<void> {
    const { receipt } = req.params;
    
    if (!receipt) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Receipt is required' });
        return;
    }

    try {
        // Find vote in MongoDB by receipt
        const vote = await VoteModel.findOne({ receipt });
        
        if (!vote) {
            res.status(StatusCodes.NOT_FOUND).json({ 
                verified: false, 
                message: 'Vote not found with the provided receipt' 
            });
            return;
        }

        // Get election details to enhance the response
        let electionName = "Unknown";
        let candidateName = "Unknown";
        
        try {
            // Use admin connection to get election details
            await withFabricAdminConnection(async (contract) => {
                const blockchainRepo = new BlockChainRepository(contract);
                const election = await blockchainRepo.getElection(vote.election_id);
                
                if (election) {
                    electionName = election.name;
                    
                    // Find candidate name
                    const candidate = election.candidates.find(c => c.candidate_id === vote.candidate_id);
                    if (candidate) {
                        candidateName = candidate.name;
                    }
                }
            });
        } catch (error) {
            // If we can't get the additional details, continue with the basic verification
            logger.warn(`Unable to fetch election details for verification: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Check if feedback has been submitted
        const feedback = await FeedbackModel.findOne({ receipt });
        
        res.status(StatusCodes.OK).json({
            verified: true,
            message: 'Vote verified successfully',
            vote_details: {
                election_name: electionName,
                timestamp: vote.created_at,
                receipt: vote.receipt
            },
            feedback_submitted: !!feedback
        });
        
    } catch (error) {
        logger.error(`Error verifying vote: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            verified: false,
            message: `Error verifying vote: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

/**
 * Get detailed vote information for an authenticated user
 * This allows voters to see the full details of their own vote
 */
async function getVoteDetailsByReceipt(req: Request, res: Response): Promise<void> {
    const { receipt } = req.params;
    const userId = req.user?.user_id;
    
    if (!receipt) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Receipt is required' });
        return;
    }

    if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
        return;
    }

    try {
        // Find vote in MongoDB by receipt
        const vote = await VoteModel.findOne({ receipt });
        
        if (!vote) {
            res.status(StatusCodes.NOT_FOUND).json({ 
                success: false, 
                message: 'Vote not found with the provided receipt' 
            });
            return;
        }

        // Verify that the vote belongs to the requesting user
        if (vote.voter_id !== userId) {
            res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'You are not authorized to view this vote'
            });
            return;
        }

        // Get election details to enhance the response
        let electionName = "Unknown";
        let candidateName = "Unknown";
        
        try {
            // Use admin connection to get election details
            await withFabricAdminConnection(async (contract) => {
                const blockchainRepo = new BlockChainRepository(contract);
                const election = await blockchainRepo.getElection(vote.election_id);
                
                if (election) {
                    electionName = election.name;
                    
                    // Find candidate name
                    const candidate = election.candidates.find(c => c.candidate_id === vote.candidate_id);
                    if (candidate) {
                        candidateName = candidate.name;
                    }
                }
            });
        } catch (error) {
            // If we can't get the additional details, continue with the basic verification
            logger.warn(`Unable to fetch election details for verification: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Check if feedback has been submitted
        const feedback = await FeedbackModel.findOne({ receipt });
        
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Vote details retrieved successfully',
            vote_details: {
                election_id: vote.election_id,
                election_name: electionName,
                candidate_id: vote.candidate_id,
                candidate_name: candidateName,
                timestamp: vote.created_at,
                receipt: vote.receipt
            },
            feedback_submitted: !!feedback,
            feedback: feedback ? {
                rating: feedback.rating,
                comments: feedback.comments,
                created_at: feedback.created_at
            } : null
        });
        
    } catch (error) {
        logger.error(`Error retrieving vote details: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Error retrieving vote details: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

/**
 * Check if a user has voted in a specific election
 * This allows checking voting status for a specific election
 */
async function checkUserVotedInElection(req: Request, res: Response): Promise<void> {
    const { userId, electionId } = req.params;
    
    if (!userId || !electionId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID and Election ID are required' });
        return;
    }

    try {
        // Check if authorized user is making the request
        const requestingUserId = req.user?.user_id;
        
        // If user is not admin/auditor and trying to access someone else's data
        if (userId !== requestingUserId && 
            req.user?.role !== 'election_commission' && 
            req.user?.role !== 'auditor') {
            res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'You are not authorized to view this information'
            });
            return;
        }

        // Find vote in MongoDB by voter_id and election_id
        const vote = await VoteModel.findOne({ 
            voter_id: userId, 
            election_id: electionId 
        });
        
        res.status(StatusCodes.OK).json({
            success: true,
            message: vote ? 'User has voted in this election' : 'User has not voted in this election',
            hasVoted: !!vote,
            election_id: electionId,
            user_id: userId,
            // Include receipt only if the vote exists
            ...(vote && { receipt: vote.receipt })
        });
        
    } catch (error) {
        logger.error(`Error checking voting status: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Error checking voting status: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}


export {
    castVote as userVote,
    getVote as getUserVote,
    getVotes as getAllVotes,
    getUserVotes,
    verifyVote,
    submitVoterFeedback,
    getVoteDetailsByReceipt,
    checkUserVotedInElection
}