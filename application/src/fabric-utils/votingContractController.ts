import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import { 
    Candidate, 
    Election, 
    CreateElectionRequest,
    CreateBlockchainElectionRequest
} from '../models/election.model';
import { electionDataService, pendingMetadata } from '../service/election.service';
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

    /**
     * Transform blockchain data to Election model
     */
    private transformBlockchainToElection(chainData: any): Election {
        return {
            election_id: chainData.electionId,
            name: chainData.name || chainData.electionName,
            description: "Election details not available", // Default placeholder
            candidates: this.transformCandidates(chainData),
            start_time: chainData.startTime,
            end_time: chainData.endTime,
            status: this.mapElectionStatus(chainData.electionStatus),
            eligible_governorates: chainData.eligibleGovernorates || [],
            last_tally_time: chainData.lastTallyTime
        };
    }

    /**
     * Get election by ID
     * First tries to get enriched data from MongoDB, falls back to blockchain data
     */
    async getElection(electionID: string): Promise<Election> {
        logger.info('Evaluate Transaction: GetElection, function returns the election with ID %s', electionID);
        
        try {
            // First try to get detailed election data from MongoDB
            const detailedElection = await electionDataService.getElection(electionID);
            
            // If we have detailed data in MongoDB, use that
            if (detailedElection) {
                logger.info('Retrieved detailed election from MongoDB: %s', detailedElection.name);
                return detailedElection;
            }
            
            // Otherwise, get the basic data from blockchain
            const resultBytes = await this.contract.evaluateTransaction('GetElection', electionID);
            const resultJson = new TextDecoder().decode(resultBytes);
            const chainResult = JSON.parse(resultJson);
            
            // Transform blockchain result to Election model
            const election = this.transformBlockchainToElection(chainResult);
            
            logger.info('Basic election retrieved from blockchain: %s', election.name);
            return election;
        } catch (error) {
            logger.error(`Error retrieving election: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    
    /**
     * Get all elections from blockchain
     */
    private async getElectionsFromBlockchain(): Promise<Election[]> {
        const resultBytes = await this.contract.evaluateTransaction('GetAllElections');
        const resultJson = new TextDecoder().decode(resultBytes);
        if (resultJson === '') {
            return [];
        }

        const chainResults = JSON.parse(resultJson);
        return chainResults.map(this.transformBlockchainToElection.bind(this));
    }

    /**
     * Get all elections
     * First tries to get all from MongoDB, falls back to blockchain
     */
    async getAllElections(): Promise<Election[]> {
        logger.info('Evaluate Transaction: GetAllElections, function returns all elections');
        
        try {
            // First try to get cached elections from MongoDB
            const cachedElections = await electionDataService.getAllElections();
            
            if (cachedElections && cachedElections.length > 0) {
                logger.info('Retrieved %d elections from MongoDB cache', cachedElections.length);
                return cachedElections;
            }
            
            // Otherwise get from blockchain
            const elections = await this.getElectionsFromBlockchain();
            
            logger.info('Retrieved and processed %d elections from blockchain', elections.length);
            return elections;
        } catch (error) {
            logger.error(`Error retrieving elections: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Get only active elections
     */
    async getActiveElections(): Promise<Election[]> {
        logger.info('Getting active elections');
        const allElections = await this.getAllElections();
        const activeElections = allElections.filter(election => 
            election.status === 'active'
        );
        logger.info('Retrieved %d active elections', activeElections.length);
        return activeElections;
    }

    /**
     * Save UI metadata to pending map
     * @param electionId The election ID
     * @param request The original request
     * @param candidateIds The generated candidate IDs
     */

    async createElection(request: CreateBlockchainElectionRequest): Promise<string> {
        const blockchainInputJSON = JSON.stringify(request);
        await this.contract.submitTransaction('CreateElection', blockchainInputJSON);
        
        logger.info('Transaction committed successfully: election created with ID %s', request.election_id);
        return request.election_id;
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
     * Maps blockchain election status to model election status
     */
    private mapElectionStatus(status: string): 'active' | 'inactive' | 'completed' {
        switch(status.toLowerCase()) {
            case 'active': return 'active';
            case 'completed': return 'completed';
            default: return 'inactive';
        }
    }
    
    /**
     * Create a simple candidate object from ID
     */
    private createPlaceholderCandidate(candidateId: string): Candidate {
        return {
            candidate_id: candidateId,
            name: `Candidate ${candidateId.substring(0, 5)}`,  // Placeholder name
            party: 'Independent'  // Default value
        };
    }
    
    /**
     * Transform candidates from blockchain format to model format
     */
    private transformCandidates(chainElection: any): Candidate[] {
        // If the blockchain has full candidate objects
        if (chainElection.candidateDetails && Array.isArray(chainElection.candidateDetails)) {
            return chainElection.candidateDetails.map((candidate: any) => ({
                candidate_id: candidate.id || candidate.candidateId || candidate.name,
                name: candidate.name,
                party: candidate.party || 'Independent',
                profile_image: candidate.profileImage
            }));
        }
        
        // If the blockchain only has candidate IDs in any format, use those
        const candidateIds = 
            (chainElection.candidateIds && Array.isArray(chainElection.candidateIds)) ? chainElection.candidateIds : 
            (chainElection.candidates && Array.isArray(chainElection.candidates)) ? chainElection.candidates : 
            [];
            
        return candidateIds.map(this.createPlaceholderCandidate);
    }
}