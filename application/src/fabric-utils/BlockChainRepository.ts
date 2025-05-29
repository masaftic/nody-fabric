import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import {
    Election,
    CreateElectionRequest
} from '../models/election.model';
import { 
    BaseRepository,
    ElectionRepository,
    UserRepository,
    VoteRepository
} from './repositories';
import { UserRole } from '../models/user.model';

/**
 * Repository for interacting with the voting contract on the blockchain
 * This class delegates to specialized repositories for different domain operations
 */
export class BlockChainRepository {
    private baseRepo: BaseRepository;
    private electionRepo: ElectionRepository;
    private userRepo: UserRepository;
    private voteRepo: VoteRepository;

    constructor(contract: Contract) {
        this.baseRepo = new BaseRepository(contract);
        this.electionRepo = new ElectionRepository(contract);
        this.userRepo = new UserRepository(contract);
        this.voteRepo = new VoteRepository(contract);
    }

    /**
     * Get the entire world state (for debugging purposes)
     */
    async getWorldState(): Promise<any> {
        return this.baseRepo.getWorldState();
    }

    /**
     * Initialize the ledger with sample data
     */
    async initLedger(): Promise<void> {
        return this.baseRepo.initLedger();
    }

    /**
     * User Repository Methods
     */
    async registerUser(userId: string, governorate: string, userRole: UserRole): Promise<void> {
        return this.userRepo.registerUser(userId, governorate, userRole);
    }

    /**
     * Election Repository Methods
     */
    async getElection(electionID: string): Promise<Election> {
        return this.electionRepo.getElection(electionID);
    }

    async getAllElections(): Promise<Election[]> {
        return this.electionRepo.getAllElections();
    }

    async getActiveElections(): Promise<Election[]> {
        return this.electionRepo.getActiveElections();
    }

    async createElection(request: CreateElectionRequest): Promise<string> {
        return this.electionRepo.createElection(request);
    }

    async computeVoteTally(electionID: string): Promise<void> {
        return this.electionRepo.computeVoteTally(electionID);
    }

    async clearElections(): Promise<void> {
        return this.electionRepo.clearElections();
    }

    async deleteWorldState(): Promise<void> {
        return this.baseRepo.deleteWorldState();
    }

    /**
     * Vote Repository Methods
     */
    async castVote(voteId: string, electionId: string, candidateId: string): Promise<string> {
        return this.voteRepo.castVote(voteId, electionId, candidateId);
    }

    async getVote(voteId: string): Promise<any> {
        return this.voteRepo.getVote(voteId);
    }

    async getAllVotes(): Promise<any[]> {
        return this.voteRepo.getAllVotes();
    }
}
