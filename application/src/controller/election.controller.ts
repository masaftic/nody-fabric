import { Request, Response, NextFunction } from "express";
import { fabricConnection, withFabricAdminConnection, withFabricConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";
import crypto from 'crypto';
import {
    CreateElectionRequest,
    CreateElectionResponse,
    GetElectionResponse,
    GetAllElectionsResponse,
    Election,
    ElectionStatus,
    Governorates,
    Governorate,
    VoteTallyModel
} from "../models/election.model";
import { logger } from "../logger";
import { stat } from "fs";
import { getSchedulerService } from "../service/election-scheduler.service";

export async function getElection(req: Request, res: Response) {
    try {
        // Get userId from JWT token instead of request body
        const userId = req.user!.user_id;
        const { electionId } = req.params;
        
        if (!electionId) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
            return;
        }

        const election = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.getElection(electionId);
        });

        res.status(StatusCodes.OK).json(election as GetElectionResponse);
    } catch (error) {
        logger.error(`Error retrieving election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving election: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

export async function getAllElections(req: Request, res: Response<GetAllElectionsResponse | { message: string }>) {
    // Get userId from JWT token instead of request body
    const userId = req.user?.user_id;
    const { status, governorate } = req.query;
    
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    if (status && !Object.values(ElectionStatus).includes(status as ElectionStatus)) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status value. valid ones are ' + Object.values(ElectionStatus).join(', ') });
        return;
    }

    if (governorate && Governorates.includes(governorate as Governorate) === false) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid governorate value.' });
        return;
    }

    try {
        // Get elections directly from the blockchain
        const elections = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
                        
            // Get all elections first
            let allElections = await blockchainRepo.getAllElections();
            
            // Filter by governorate if specified
            if (governorate) {
                allElections = allElections.filter(election => 
                    election.eligible_governorates.includes(governorate as Governorate)
                );
            }
            
            // Filter by status if specified
            if (status) {
                allElections = allElections.filter(election => 
                    election.status.toLowerCase() === status.toString().toLowerCase()
                );
            }
            
            return allElections;
        });

        res.status(StatusCodes.OK).json(elections);
    } catch (error) {
        logger.error(`Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

export async function createElection(req: Request<{}, {}, CreateElectionRequest>, res: Response<CreateElectionResponse>) {
    // Get userId from JWT token instead of request body
    const userId = req.user?.user_id;
    const { name, description, candidates, start_time, end_time, eligible_governorates, election_image } = req.body;

    // Validate required fields
    if (!userId || !name || !description || !candidates || !start_time || !end_time || !eligible_governorates) {
        res.status(StatusCodes.BAD_REQUEST).json({
            status: "error",
            message: 'Missing required fields',
            election_id: ''
        });
        return;
    }

    if (eligible_governorates.length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
            status: "error",
            message: 'At least one eligible governorate is required',
            election_id: ''
        });
        return;
    }

    if (eligible_governorates.some(gov => !Governorates.includes(gov))) {
        res.status(StatusCodes.BAD_REQUEST).json({
            status: "error",
            message: 'Invalid governorate value. Valid ones are ' + Governorates.join(', '),
            election_id: ''
        });
        return;
    }

    if (candidates.length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
            status: "error",
            message: 'At least one candidate is required',
            election_id: ''
        });
        return;
    }

    try {
        // Create the election directly with all information
        const electionId = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.createElection({
                name,
                description,
                candidates,
                start_time,
                end_time,
                eligible_governorates,
                election_image
            });
        });

        const response: CreateElectionResponse = {
            status: "success",
            message: "Election created successfully",
            election_id: electionId
        };

        res.status(StatusCodes.CREATED).json(response);
        return;
    } catch (error) {
        logger.error(`Error creating election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: "error",
            message: `Error creating election: ${error instanceof Error ? error.message : String(error)}`,
            election_id: ''
        });
    }
}

/**
 * Get real-time vote tally for a specific election
 */
export async function getVoteTally(req: Request, res: Response): Promise<void> {
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

        // res.status(200).json({
        //     election_id: electionId,
        //     total_votes: tally.total_votes,
        //     tallies: Object.fromEntries(tally.tallies), // Convert Map to plain object
        //     last_updated: tally.last_updated
        // });
        // return;
        
        // // Get the election details to include candidate information
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

/**
 * Publish election results, transitioning from Ended to Published state
 * This is typically triggered manually by election officials after validating results
 */
export async function publishElectionResults(req: Request, res: Response): Promise<void> {
    try {
        // Get userId from JWT token
        const userId = req.user?.user_id;
        const { electionId } = req.params;
        
        if (!userId || !electionId) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
            return;
        }

        // Get the election details to verify current status
        const election = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.getElection(electionId);
        });
        
        if (election.status !== ElectionStatus.Ended) {
            res.status(StatusCodes.BAD_REQUEST).json({ 
                message: `Cannot publish results for election ${electionId} as it is not in 'ended' state (current state: ${election.status})`
            });
            return;
        }

        // Use the scheduler service to publish the results
        // This ensures a consistent process for publishing results
        const schedulerService = getSchedulerService();
        await schedulerService.publishElectionResults(electionId);
        
        // Get the final tally data
        const tally = await VoteTallyModel.findOne({ election_id: electionId });
        
        if (!tally) {
            res.status(StatusCodes.NOT_FOUND).json({ message: 'No votes found for this election' });
            return;
        }

        // Create a response that matches the documented format
        const candidatesWithVotes = election.candidates.map(candidate => {
            return {
                candidate_id: candidate.candidate_id,
                name: candidate.name,
                party: candidate.party,
                votes: tally.tallies.get(candidate.candidate_id) || 0
            };
        });

        res.status(StatusCodes.OK).json({
            message: "Election results published successfully",
            election_id: electionId,
            election_name: election.name,
            total_votes: tally.total_votes,
            status: ElectionStatus.Published,
            candidates: candidatesWithVotes,
            published_at: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error(`Error publishing election results: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error publishing election results: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}
