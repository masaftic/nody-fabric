import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';
import {
    Candidate,
    Election,
    CreateElectionRequest,
    VoteTally,
    BlockchainVoteTally,
    ElectionStatus
} from '../../models/election.model';
import crypto from 'crypto';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for interacting with election-related operations on the blockchain
 */
export class ElectionRepository extends BaseRepository {
    constructor(contract: Contract) {
        super(contract);
    }

    /**
     * Get election by ID directly from blockchain
     */
    async getElection(electionID: string): Promise<Election> {
        logger.info('Evaluate Transaction: GetElection, function returns the election with ID %s', electionID);
        // Get data from blockchain
        const resultBytes = await this.contract.evaluateTransaction('GetElection', electionID);
        const resultJson = new TextDecoder().decode(resultBytes);
        if (!resultJson) {
            logger.warn('No election found with ID %s', electionID);
            throw new Error(`No election found with ID ${electionID}`);
        }
        const election = JSON.parse(resultJson) as Election;

        logger.info('Election retrieved from blockchain: %s', election.name);
        return election;
    }

    /**
     * Get all elections directly from blockchain
     */
    async getAllElections(): Promise<Election[]> {
        logger.info('Evaluate Transaction: GetAllElections, function returns all elections');

        const resultBytes = await this.contract.evaluateTransaction('GetAllElections');
        const resultJson = new TextDecoder().decode(resultBytes);
        if (resultJson === '') {
            return [];
        }

        const elections = JSON.parse(resultJson) as Election[];
        logger.info(`Retrieved ${elections.length} elections from blockchain`);
        return elections;
    }

    /**
     * Get only active elections directly from blockchain
     */
    async getActiveElections(): Promise<Election[]> {
        logger.info('Getting active elections');
        const allElections = await this.getAllElections();
        const activeElections = allElections.filter(election =>
            election.status.toLowerCase() === 'active'
        );
        logger.info('Retrieved %d active elections', activeElections.length);
        return activeElections;
    }

    /**
     * Create a new election with full details in a single transaction
     */
    async createElection(request: CreateElectionRequest): Promise<string> {
        // Generate election and candidate IDs
        const electionId = crypto.randomUUID();
        const candidatesWithIds = request.candidates.map(candidate => ({
            ...candidate,
            candidate_id: crypto.randomUUID()
        }));

        // Prepare election object for blockchain
        const election: Election = {
            election_id: electionId,
            name: request.name,
            description: request.description,
            candidates: candidatesWithIds,
            start_time: request.start_time,
            end_time: request.end_time,
            status: ElectionStatus.Scheduled, // Initial status
            eligible_governorates: request.eligible_governorates,
            election_image: request.election_image
        };

        // Submit to blockchain
        const blockchainInputJSON = JSON.stringify(election);
        await this.contract.submitTransaction('CreateElection', blockchainInputJSON);

        logger.info('Transaction committed successfully: election created with ID %s and sample candidate ID %s', electionId, candidatesWithIds[0].candidate_id);
        return electionId;
    }

    /**
     * Compute the vote tally for an election
     */
    async computeVoteTally(tallyID: string, electionID: string): Promise<BlockchainVoteTally> {
        logger.info('Submit Transaction: computeVoteTally for election with ID %s', electionID);
        const resultBytes = await this.contract.submitTransaction('ComputeVoteTally', tallyID, electionID);
        const resultJson = new TextDecoder().decode(resultBytes);
        const tally = JSON.parse(resultJson) as BlockchainVoteTally;
        logger.info('Computed Vote tally for election: "%s"', electionID);
        return tally;
    }

    /**
     * Clear all elections (for testing)
     */
    async clearElections(): Promise<void> {
        await this.contract.submitTransaction('ClearElections');
        logger.info('Cleared all elections from ledger');
    }
}
