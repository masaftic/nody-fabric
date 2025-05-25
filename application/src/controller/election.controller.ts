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
        const userId = req.user!.userId;
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

export async function getAllElections(req: Request, res: Response<Election[] | { message: string }>) {
    // Get userId from JWT token instead of request body
    const userId = req.user?.userId;
    const { filter } = req.query;
    
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // Get elections directly from the blockchain
        const elections = await withFabricConnection(userId, async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            
            // If filter=active, get only active elections
            if (filter === 'active') {
                return await blockchainRepo.getActiveElections();
            }
            
            return await blockchainRepo.getAllElections();
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
    const userId = req.user?.userId;
    const { name, description, candidates, start_time, end_time, eligible_governorates } = req.body;

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
                eligible_governorates
            });
        }, true);

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

