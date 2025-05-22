// filepath: /home/masaftic/dev/fabric-project/application/src/fabric-utils/BlockChainRepository.ts
import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import {
    Candidate,
    Election,
    CreateElectionRequest
} from '../models/election.model';
import crypto from 'crypto';

/**
 * Repository for interacting with the voting contract on the blockchain
 */
export class BlockChainRepository {

    private contract: Contract;

    constructor(contract: Contract) {
        this.contract = contract;
    }

    /**
     * Get the entire world state (for debugging purposes)
     */
    async getWorldState(): Promise<any> {
        const resultBytes = await this.contract.evaluateTransaction('GetWorldState');
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    /**
     * Initialize the ledger with sample data
     */
    async initLedger(): Promise<void> {
        logger.info('InitLedger initializes the ledger with some sample elections');
        await this.contract.submitTransaction('InitLedger');
        logger.info('Transaction committed successfully');
    }

    async registerUser(userId: string, governorate: string): Promise<void> {
        logger.info('Submit Transaction: RegisterUser, creating user with ID %s', userId);
        await this.contract.submitTransaction('RegisterUser', userId, governorate);
        logger.info('Transaction committed successfully: user created with ID %s', userId);
    }

    /**
     * Get election by ID directly from blockchain
     */
    async getElection(electionID: string): Promise<Election> {
        logger.info('Evaluate Transaction: GetElection, function returns the election with ID %s', electionID);

        try {
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
        } catch (error) {
            logger.error(`Error retrieving election: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Get all elections directly from blockchain
     */
    async getAllElections(): Promise<Election[]> {
        logger.info('Evaluate Transaction: GetAllElections, function returns all elections');

        try {
            const resultBytes = await this.contract.evaluateTransaction('GetAllElections');
            const resultJson = new TextDecoder().decode(resultBytes);
            if (resultJson === '') {
                return [];
            }

            const elections = JSON.parse(resultJson) as Election[];
            logger.info(`Retrieved ${elections.length} elections from blockchain`);
            return elections;
        } catch (error) {
            logger.error(`Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
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
        const election = {
            election_id: electionId,
            name: request.name,
            description: request.description,
            candidates: candidatesWithIds,
            start_time: request.start_time,
            end_time: request.end_time,
            eligible_governorates: request.eligible_governorates
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
    async computeVoteTally(electionID: string): Promise<void> {
        logger.info('Submit Transaction: computeVoteTally for election with ID %s', electionID);
        await this.contract.submitTransaction('ComputeVoteTally', electionID);
        logger.info('Computed Vote tally for election: "%s"', electionID);
    }

    /**
     * Clear all elections (for testing)
     */
    async clearElections(): Promise<void> {
        await this.contract.submitTransaction('ClearElections');
        logger.info('Cleared all elections from ledger');
    }

    /**
     * Deletes world state
     */
    async deleteWorldState(): Promise<void> {
        await this.contract.submitTransaction('DeleteWorldState');
        logger.info('Deleted world state');
    }

    /**
     * Cast a vote in an election
     * @param voteId The unique ID for the vote
     * @param electionId The ID of the election
     * @param candidateId The ID of the candidate being voted for
     */
    async castVote(voteId: string, electionId: string, candidateId: string): Promise<string> {
        logger.info('Submit Transaction: CastVote, casting vote with ID %s for election %s and candidate %s', voteId, electionId, candidateId);
        const resultBytes = await this.contract.submitTransaction('CastVote', voteId, electionId, candidateId);
        const receipt = new TextDecoder().decode(resultBytes); // It is not actually json. Just a string
        // logger.info('Vote cast successfully with ID %s', voteId);
        return receipt;
    }

    /**
     * Get a vote by ID
     * @param voteId The ID of the vote to retrieve
     */
    async getVote(voteId: string): Promise<any> {
        logger.info('Evaluate Transaction: GetVote, function returns the vote with ID %s', voteId);
        const resultBytes = await this.contract.evaluateTransaction('GetVote', voteId);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result = JSON.parse(resultJson);
        logger.info('Retrieved vote with ID %s', voteId);
        return result;
    }

    /**
     * Get all votes from blockchain
     */
    async getAllVotes(): Promise<any[]> {
        logger.info('Evaluate Transaction: GetAllVotes, function returns all votes');
        const resultBytes = await this.contract.evaluateTransaction('GetAllVotes');
        const resultJson = new TextDecoder().decode(resultBytes);
        if (resultJson === '') {
            return [];
        }
        const votes = JSON.parse(resultJson);
        logger.info('Retrieved %d votes', votes.length);
        return votes;
    }
}
