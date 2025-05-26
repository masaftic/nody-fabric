import { Request, Response, NextFunction } from "express";
import { fabricConnection, withFabricConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { StatusCodes } from "http-status-codes";
import crypto from 'crypto';
import {
    CreateElectionRequest,
    CreateElectionResponse,
    GetElectionResponse,
    GetAllElectionsResponse,
    Election,
} from "../models/election.model";
import { logger } from "../logger";

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
        }, true);

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

    try {
        // Get elections directly from the blockchain
        const elections = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            
            // If status=active, get only active elections
            if (status === 'active') {
                return await blockchainRepo.getActiveElections();
            }
            
            // Get all elections first
            let allElections = await blockchainRepo.getAllElections();
            
            // Filter by governorate if specified
            if (governorate) {
                allElections = allElections.filter(election => 
                    election.eligible_governorates.includes(governorate as string)
                );
            }
            
            // Filter by status if specified (other than 'active' which is handled above)
            if (status && status !== 'active') {
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
        }, false);

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

