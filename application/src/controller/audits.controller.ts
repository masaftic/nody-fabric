import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../logger';
import { AuditEventModel, VoterActivityResponse, ChaincodeEventsResponse } from '../models/audit.model';
import { VoteModel, VoteTallyModel } from '../models/election.model';
import { fabricEventService } from '../service/fabric-event.service';
import { BlockChainRepository } from '../fabric-utils/BlockChainRepository';
import { withFabricConnection } from '../fabric-utils/fabric';
import { Contract } from '@hyperledger/fabric-gateway';

/**
 * Controller for audit-related operations
 */


export async function getVoterActivity(req: Request, res: Response): Promise<void> {
    try {
        const { voterId } = req.params;

        // Validate voter ID
        if (!voterId) {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Voter ID is required'
            });
            return;
        }

        // Get votes cast by this voter
        const votes = await VoteModel.find({ voter_id: voterId }).sort({ created_at: 1 });

        // Get all audit events related to this voter
        const auditEvents = await AuditEventModel.find({
            'details.voter_id': voterId
        }).sort({ timestamp: 1 });

        // Combine into a comprehensive activity log
        const activity: VoterActivityResponse = {
            voter_id: voterId,
            activity: [
                ...votes.map(vote => ({
                    timestamp: vote.created_at.toISOString(),
                    action: 'voted',
                    details: {
                        election_id: vote.election_id,
                        candidate_id: vote.candidate_id,
                        receipt: vote.receipt
                    }
                })),
                ...auditEvents
                    .filter(event => event.event_type !== 'vote_cast') // Avoid duplication with votes
                    .map(event => ({
                        timestamp: new Date(event.timestamp).toISOString(),
                        action: event.event_type,
                        details: event.details
                    }))
            ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        };

        res.status(StatusCodes.OK).json(activity);
    } catch (error) {
        logger.error(`Error getting voter activity: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Failed to retrieve voter activity'
        });
    }
}


export async function getChaincodeEvents(req: Request, res: Response): Promise<void> {
    try {
        const { eventType, electionId, limit, startDate, endDate } = req.query;

        // Build query filters
        const query: Record<string, any> = {};

        if (eventType) {
            query.event_type = eventType;
        }

        if (electionId) {
            query['details.election_id'] = electionId;
        }

        // Date range filter
        if (startDate || endDate) {
            query.timestamp = {};

            if (startDate) {
                query.timestamp.$gte = new Date(startDate as string);
            }

            if (endDate) {
                query.timestamp.$lte = new Date(endDate as string);
            }
        }

        // Get audit events with pagination
        const events = await AuditEventModel.find(query)
            .sort({ timestamp: -1 })
            .limit(limit ? parseInt(limit as string, 10) : 50);

        const response: ChaincodeEventsResponse = {
            events: events.map(event => ({
                event_id: event.event_id,
                timestamp: new Date(event.timestamp).toISOString(),
                event_type: event.event_type,
                details: event.details,
                block_number: event.block_number,
                tx_id: event.tx_id
            }))
        };

        res.status(StatusCodes.OK).json(response);
    } catch (error) {
        logger.error(`Error getting chaincode events: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Failed to retrieve chaincode events'
        });
    }
}


export async function recalculateTally(req: Request, res: Response): Promise<void> {
    try {
        const { election_id } = req.params;

        // Validate election ID
        if (!election_id) {
            res.status(StatusCodes.BAD_REQUEST).json({
                message: 'Election ID is required'
            });
            return;
        }

        // Call blockchain to compute tally
        const blockchainTally = await withFabricConnection(req.user!.user_id, async (contract: Contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            return await blockchainRepo.computeVoteTally(crypto.randomUUID(), election_id);
        });

        // Get tally from MongoDB (real-time tally)
        const mongoTally = await VoteTallyModel.findOne({ election_id });

        // Compare tallies for discrepancies
        let discrepancy = false;
        const discrepancyDetails: any = {};
        let mongoTotal = 0;

        if (mongoTally) {
            // Check if tallies match
            for (const [candidateId, count] of Object.entries(blockchainTally.tallies)) {
                const mongoCount = mongoTally.tallies.get(candidateId) || 0;
                if (mongoCount !== count) {
                    discrepancy = true;
                    discrepancyDetails[candidateId] = { calculated: count, stored: mongoCount };
                }
            }

            // Calculate totals
            mongoTotal = Array.from(mongoTally.tallies.values()).reduce((sum, val) => sum + val, 0);
            const calculatedTotal = Object.values(blockchainTally.tallies).reduce((sum, val) => sum + val, 0);

            if (mongoTotal !== calculatedTotal) {
                discrepancy = true;
                discrepancyDetails.totals = { calculated: calculatedTotal, stored: mongoTotal };
            }
        }

        if (discrepancy) {
            // Return discrepancy details
            res.status(StatusCodes.OK).json({
                discrepancy: "Tally discrepancy detected",
                details: {
                    election_id,
                    discrepancies: discrepancyDetails
                },
                timestamp: new Date().toISOString()
            });
        } else {
            // Return successful tally
            res.status(StatusCodes.OK).json({
                tally: Object.entries(blockchainTally.tallies).map(([candidate_id, votes]) => ({
                    candidate_id,
                    votes
                })),
                total_votes: Object.values(blockchainTally.tallies).reduce((sum, val) => sum + val, 0),
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error(`Error recalculating tally: ${error instanceof Error ? error.message : String(error)}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Failed to recalculate tally'
        });
    }
}

