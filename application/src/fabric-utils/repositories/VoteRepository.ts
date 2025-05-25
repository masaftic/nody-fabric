import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for interacting with vote-related operations on the blockchain
 */
export class VoteRepository extends BaseRepository {
    constructor(contract: Contract) {
        super(contract);
    }

    /**
     * Cast a vote in an election
     * @param voteId The unique ID for the vote
     * @param electionId The ID of the election
     * @param candidateId The ID of the candidate being voted for
     */
    async castVote(voteId: string, electionId: string, candidateId: string): Promise<string> {
        logger.info('Submit Transaction: CastVote, casting vote with ID %s for election %s and candidate %s', 
            voteId, electionId, candidateId);
        const resultBytes = await this.contract.submitTransaction('CastVote', voteId, electionId, candidateId);
        const receipt = new TextDecoder().decode(resultBytes); // It is not actually json. Just a string
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
