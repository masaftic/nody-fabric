import { Request, Response } from "express";
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

async function getElection(req: Request, res: Response) {
    const { userId } = req.body;
    const { electionId } = req.params;
    if (!userId || !electionId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        const election = await withFabricConnection(userId, async (contract) => {
            const votingController = new BlockChainRepository(contract);
            return await votingController.getElection(electionId);
        });

        res.status(StatusCodes.OK).json(election as GetElectionResponse);
    } catch (error) {
        logger.error(`Error retrieving election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving election: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

async function getAllElections(req: Request, res: Response<Election[] | { message: string }>) {
    const { userId } = req.body;
    const { filter } = req.query;
    
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // Get elections directly from the blockchain
        const elections = await withFabricConnection(userId, async (contract) => {
            const votingController = new BlockChainRepository(contract);
            
            // If filter=active, get only active elections
            if (filter === 'active') {
                return await votingController.getActiveElections();
            }
            
            return await votingController.getAllElections();
        });

        res.status(StatusCodes.OK).json(elections);
    } catch (error) {
        logger.error(`Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

async function createElection(req: Request<{}, {}, CreateElectionRequest>, res: Response<CreateElectionResponse>) {
    const { userId } = req.body as any; // TypeScript workaround for additional userId field
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
            const votingController = new BlockChainRepository(contract);
            return await votingController.createElection({
                name,
                description,
                candidates,
                start_time,
                end_time,
                eligible_governorates
            });
        });

        const response: CreateElectionResponse = {
            status: "success",
            message: "Election created successfully",
            election_id: electionId
        };

        res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
        logger.error(`Error creating election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: "error",
            message: `Error creating election: ${error instanceof Error ? error.message : String(error)}`,
            election_id: ''
        });
    }
}

async function getActiveElections(req: Request, res: Response) {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // Fetch active elections directly from the blockchain
        const activeElections = await withFabricConnection(userId, async (contract) => {
            const votingController = new BlockChainRepository(contract);
            return await votingController.getActiveElections();
        });

        res.status(StatusCodes.OK).json(activeElections);
    } catch (error) {
        logger.error(`Error retrieving active elections: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving active elections: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

export {
    getElection,
    getAllElections,
    createElection,
    getActiveElections
}
