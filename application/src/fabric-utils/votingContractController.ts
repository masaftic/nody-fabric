import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';

export class VotingContractController {
    private contract: Contract;

    constructor(contract: Contract) {
        this.contract = contract;
    }

    async getWorldState(): Promise<any> {
        const resultBytes = await this.contract.evaluateTransaction('GetWorldState');
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    async initLedger(): Promise<void> {
        logger.info('InitLedger initializes the ledger with some sample elections');
        await this.contract.submitTransaction('InitLedger');
        logger.info('Transaction committed successfully');
    }

    async castVote(voteId: string, electionId: string, candidateId: string): Promise<void> {
        logger.info('Submit Transaction: CastVote, function casts a vote for election %s', electionId);
        await this.contract.submitTransaction('CastVote', voteId, electionId, candidateId);
        logger.info('Transaction committed successfully');
    }

    async getVote(voteId: string): Promise<any> {
        logger.info('Evaluate Transaction: GetVote, function returns the vote with ID %s', voteId);
        const resultBytes = await this.contract.evaluateTransaction('GetVote', voteId);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    async getAllVotes(): Promise<any> {
        logger.info('Evaluate Transaction: GetAllVotes, function returns the votes');
        const resultBytes = await this.contract.evaluateTransaction('GetAllVotes');
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    async getElection(electionID: string): Promise<any> {
        logger.info('Evaluate Transaction: GetElection, function returns the election with ID %s', electionID);
        const resultBytes = await this.contract.evaluateTransaction('GetElection', electionID);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        logger.info('Result: %o', result);
        return result;
    }

    async computeVoteTally(electionID: string): Promise<void> {
        logger.info('Evaluate Transaction: computeVoteTally, function computes vote tally for election with ID %s', electionID);
        await this.contract.submitTransaction('ComputeVoteTally', electionID);
        logger.info('Computed Vote tally for election: "%s"', electionID);
    }

    async clearVotes(): Promise<void> {
        await this.contract.submitTransaction('ClearVotes');
        logger.info('Cleared all votes from ledger');
    }

    async clearElections(): Promise<void> {
        await this.contract.submitTransaction('ClearElections');
        logger.info('Cleared all elections from ledger');
    }
}

