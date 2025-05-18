import { Request, Response } from "express";
import { fabricConnection } from "../fabric-utils/fabric";
import { BlockChainRepository as BlockChainRepository } from "../fabric-utils/votingContractController";
import { StatusCodes } from "http-status-codes";
import crypto from 'crypto';
import {
    CreateElectionRequest,
    CreateElectionResponse,
    GetElectionResponse,
    GetAllElectionsResponse,
    GetElectionAnalyticsResponse
} from "../models/election.model";
import { electionDataService, pendingMetadata as electionPendingData } from "../service/election.service";
import { logger } from "../logger";

const getElection = async (req: Request, res: Response) => {
    const { userId } = req.body;
    const { electionId } = req.params;
    if (!userId || !electionId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // First check if we have the data in MongoDB
        const cachedElection = await electionDataService.getElection(electionId);

        if (cachedElection) {
            res.status(StatusCodes.OK).json(cachedElection as GetElectionResponse);
            return;
        }

        // If not in MongoDB, get from blockchain
        const [gateway, client] = await fabricConnection(userId);
        try {
            const contract = gateway.getNetwork('mychannel').getContract('basic');
            const votingController = new BlockChainRepository(contract);
            const result = await votingController.getElection(electionId);

            // Save to MongoDB for future queries
            const formattedResponse = await electionDataService.saveElection(result);

            res.status(StatusCodes.OK).json(formattedResponse);
            return;
        } finally {
            gateway.close();
            client.close();
        }
    } catch (error) {
        logger.error(`Error retrieving election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving election: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

const getAllElections = async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // First check if we have data in MongoDB
        const cachedElections = await electionDataService.getAllElections();

        if (cachedElections && cachedElections.length > 0) {
            res.status(StatusCodes.OK).json(cachedElections);
            return;
        }

        // If not in MongoDB or empty, get from blockchain
        const [gateway, client] = await fabricConnection(userId);
        try {
            const contract = gateway.getNetwork('mychannel').getContract('basic');
            const votingController = new BlockChainRepository(contract);
            const elections = await votingController.getAllElections();

            // Save all elections to MongoDB for future queries
            for (const election of elections) {
                await electionDataService.saveElection(election);
            }

            // Format the response according to the API doc
            const formattedElections = elections.map((election: any) => ({
                election_id: election.electionId,
                name: election.electionName,
                description: election.electionDescription,
                start_time: election.startTime,
                end_time: election.endTime,
                status: election.electionStatus
            }));

            res.status(StatusCodes.OK).json(formattedElections);
            return;
        } finally {
            gateway.close();
            client.close();
        }
    } catch (error) {
        logger.error(`Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

// const getElectionAnalytics = async (req: Request, res: Response) => {
//     const { userId } = req.body;
//     const { electionId } = req.params;
//     if (!userId || !electionId) {
//         res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
//         return;
//     }

//     try {
//         // First check if we have analytics in MongoDB
//         const cachedAnalytics = await electionDataService.getElectionAnalytics(electionId);

//         if (cachedAnalytics) {
//             res.status(StatusCodes.OK).json(cachedAnalytics as GetElectionAnalyticsResponse);
//             return;
//         }

//         // If not in MongoDB, compute and fetch from blockchain
//         const [gateway, client] = await fabricConnection(userId);
//         try {
//             const contract = gateway.getNetwork('mychannel').getContract('basic');
//             const votingController = new VotingContractController(contract);

//             // First compute the current vote tally
//             await votingController.computeVoteTally(electionId);

//             // Then get the election with updated tally
//             const election = await votingController.getElection(electionId);

//             // Save to MongoDB for future queries
//             await electionDataService.saveElection(election);

//             // Trigger analytics update in MongoDB
//             await electionDataService.updateElectionAnalytics(electionId);

//             // Get the generated analytics
//             const analytics = await electionDataService.getElectionAnalytics(electionId);

//             if (!analytics) {
//                 throw new Error(`Failed to generate analytics for election ${electionId}`);
//             }

//             res.status(StatusCodes.OK).json(analytics as GetElectionAnalyticsResponse);
//             return;
//         } finally {
//             gateway.close();
//             client.close();
//         }
//     } catch (error) {
//         logger.error(`Error retrieving election analytics: ${error instanceof Error ? error.message : String(error)}`);
//         res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
//             message: `Error retrieving election analytics: ${error instanceof Error ? error.message : String(error)}` 
//         });
//     }
// }

const createElection = async (req: Request<{}, {}, CreateElectionRequest>, res: Response<CreateElectionResponse>) => {
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
        const [gateway, client] = await fabricConnection(userId);
        try {
            const contract = gateway.getNetwork('mychannel').getContract('basic');

            const votingController = new BlockChainRepository(contract);

            const electionId = crypto.randomUUID();
            const candidateIds = candidates.map(() => crypto.randomUUID());

            // Save the election metadata to memory. We wait until we get 'election_created' event from the blockchain.
            // After which we fill the remaining election metadata and store the election in mongodb.
            // Thus the blockchain acts the the source of truth
            electionPendingData.set(electionId, {
                election_id: electionId,
                description,
                candidates: candidates.map((candidate, index) => ({
                    candidate_id: candidateIds[index],
                    ...candidate,
                }))
            });

            await votingController.createElection({
                election_id: electionId,
                name,
                candidate_ids: candidateIds,
                start_time,
                end_time,
                eligible_governorates
            })

            const response: CreateElectionResponse = {
                status: "success",
                message: "Election created successfully",
                election_id: electionId
            };

            res.status(StatusCodes.CREATED).json(response);
            return;
        } finally {
            gateway.close();
            client.close();
        }
    } catch (error) {
        logger.error(`Error creating election: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: "error",
            message: `Failed to create election: ${error instanceof Error ? error.message : String(error)}`,
            election_id: ''
        });
    }
}

const getActiveElections = async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
        return;
    }

    try {
        // First check if we have data in MongoDB
        const cachedActiveElections = await electionDataService.getActiveElections();

        if (cachedActiveElections && cachedActiveElections.length > 0) {
            res.status(StatusCodes.OK).json(cachedActiveElections);
            return;
        }

        // If not in MongoDB or empty, get from blockchain
        const [gateway, client] = await fabricConnection(userId);
        try {
            const contract = gateway.getNetwork('mychannel').getContract('basic');
            const votingController = new BlockChainRepository(contract);
            const activeElections = await votingController.getActiveElections();

            // Save all elections to MongoDB for future queries
            for (const election of activeElections) {
                await electionDataService.saveElection(election);
            }

            res.status(StatusCodes.OK).json(activeElections);
            return;
        } finally {
            gateway.close();
            client.close();
        }
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
    // getElectionAnalytics,
    createElection,
    getActiveElections
}