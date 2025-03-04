import { Contract } from '@hyperledger/fabric-gateway';

export class VotingContractController {
    private contract: Contract;

    constructor(contract: Contract) {
        this.contract = contract;
    }

    // In your VotingContractController
    async getWorldState(): Promise<void> {
        const resultBytes = await this.contract.evaluateTransaction('GetWorldState');

        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        console.log('*** Result:', result);
    }

    async initLedger(): Promise<void> {
        console.log(`\n--> InitLedger initializes the ledger with some sample elections`);
        await this.contract.submitTransaction('InitLedger');
        console.log('*** Transaction committed successfully');
    }

    async castVote(voteId: string, voterId: string, electionId: string, candidateId: string): Promise<void> {
        console.log(`\n--> Submit Transaction: CastVote, function casts a vote for election ${electionId}`);
        await this.contract.submitTransaction('CastVote', voteId, voterId, electionId, candidateId);
        console.log('*** Transaction committed successfully');
    }

    async getVote(voteId: string): Promise<void> {
        console.log(`\n--> Evaluate Transaction: GetVote, function returns the vote with ID ${voteId}`);
        const resultBytes = await this.contract.evaluateTransaction('GetVote', voteId);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        console.log('*** Result:', result);
    }

    async getAllVotes(): Promise<void> {
        console.log(`\n--> Evaluate Transaction: GetAllVotes, function returns the votes`);
        const resultBytes = await this.contract.evaluateTransaction('GetAllVotes');
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        console.log('*** Result:', result);
    }

    async getElection(electionID: string): Promise<void> {
        console.log(`\n--> Evaluate Transaction: GetElection, function returns the election with ID ${electionID}`);
        const resultBytes = await this.contract.evaluateTransaction('GetElection', electionID);
        const resultJson = new TextDecoder().decode(resultBytes);
        const result: unknown = JSON.parse(resultJson);
        console.log('*** Result:', result);
    }

    async computeVoteTally(electionID: string): Promise<void> {
        console.log(`\n--> Evaluate Transaction: computeVoteTally, function computes vote tally for election with ID ${electionID}`);
        await this.contract.submitTransaction('ComputeVoteTally', electionID);
        console.log(`Computed Vote tally for election: "${electionID}"`);
    }


    async clearVotes(): Promise<void> {
        const result = await this.contract.submitTransaction('ClearVotes');
        console.log('Cleared all votes from ledger');
    }

    async clearElections(): Promise<void> {
        const result = await this.contract.submitTransaction('ClearElections');
        console.log('Cleared all elections from ledger');
    }
}

