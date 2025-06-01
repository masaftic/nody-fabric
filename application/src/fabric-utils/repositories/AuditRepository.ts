import { Contract, EndorseError } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for audit operations on the blockchain
 */
export class AuditRepository extends BaseRepository {
  constructor(contract: Contract) {
    super(contract);
  }

  /**
   * Get user revocations from the blockchain
   * @returns Array of user revocations
   */
  async getUserRevocations(): Promise<any[]> {
    const resultBytes = await this.contract.evaluateTransaction('GetUserRevocations');
    const resultJson = this.utf8Decoder.decode(resultBytes);
    return resultJson ? JSON.parse(resultJson) : [];
  }

  /**
   * Compute vote tally for an election
   * @param electionId The ID of the election
   * @returns The computed tally or error
   */
  async computeVoteTally(electionId: string): Promise<void> {
    await this.contract.submitTransaction('ComputeVoteTally', electionId);
    logger.info(`Successfully computed tally for election ${electionId}`);
  }

  /**
   * Get all votes for an election
   * @returns Array of votes
   */
  async getAllVotes(): Promise<any[]> {
    const resultBytes = await this.contract.evaluateTransaction('GetAllVotes');
    const resultJson = this.utf8Decoder.decode(resultBytes);
    return resultJson ? JSON.parse(resultJson) : [];
  }

  /**
   * Get vote by ID
   * @param voteId The ID of the vote
   * @returns The vote or null if not found
   */
  async getVote(voteId: string): Promise<any> {
    const resultBytes = await this.contract.evaluateTransaction('GetVote', voteId);
    const resultJson = this.utf8Decoder.decode(resultBytes);
    return resultJson ? JSON.parse(resultJson) : null;
  }
}
