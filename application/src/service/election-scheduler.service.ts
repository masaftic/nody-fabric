import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { Contract } from '@hyperledger/fabric-gateway';
import { ElectionStatus, VoteModel, VoteTally, VoteTallyModel } from "../models/election.model";
import { logger } from "../logger";
import { fabricAdminConnection } from "../fabric-utils/fabric";
import crypto from 'crypto';

/**
 * Service to manage the lifecycle of elections, automatically transitioning
 * elections between states based on their scheduled start and end times.
 */
export class ElectionSchedulerService {
    private contract: Contract;
    private blockchainRepo: BlockChainRepository;
    private schedulerInterval: NodeJS.Timeout | null = null;
    private readonly SCHEDULER_INTERVAL_MS = 60000; // Run every minute

    constructor(contract: Contract) {
        this.contract = contract;
        this.blockchainRepo = new BlockChainRepository(contract);
    }

    /**
     * Start the scheduler
     */
    public start(): void {
        logger.info('Starting election scheduler service...');
        // Immediately run the scheduling process once
        this.processElections()
            .then(() => logger.info('Initial election processing complete'))
            .catch(err => logger.error(`Error during initial election processing: ${err}`));
        
        // Then set up the regular interval
        this.schedulerInterval = setInterval(() => {
            this.processElections()
                .catch(err => logger.error(`Error processing elections: ${err}`));
        }, this.SCHEDULER_INTERVAL_MS);
        
        logger.info(`Election scheduler running with interval of ${this.SCHEDULER_INTERVAL_MS}ms`);
    }

    /**
     * Stop the scheduler
     */
    public stop(): void {
        logger.info('Stopping election scheduler service...');
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        logger.info('Election scheduler stopped');
    }

    /**
     * Process all elections to update their statuses based on time
     */
    private async processElections(): Promise<void> {
        try {
            logger.debug('Processing elections...');
            const now = new Date();
            const allElections = await this.blockchainRepo.getAllElections();
            
            // Process each election
            for (const election of allElections) {
                const startTime = new Date(election.start_time);
                const endTime = new Date(election.end_time);
                
                // If election is scheduled and start time has passed, make it live
                if (election.status === ElectionStatus.Scheduled && now >= startTime) {
                    logger.info(`Activating election ${election.election_id}: ${election.name}`);
                    await this.blockchainRepo.updateElectionStatus(election.election_id, ElectionStatus.Live);
                    logger.info(`Election ${election.election_id} is now live`);
                }
                
                // If election is live and end time has passed, end it and calculate final tally
                else if (election.status === ElectionStatus.Live && now >= endTime) {
                    logger.info(`Ending election ${election.election_id}: ${election.name}`);
                    await this.blockchainRepo.updateElectionStatus(election.election_id, ElectionStatus.Ended);
                    
                    const tallyId = crypto.randomUUID(); // Generate a unique ID for the tally
                    // Compute the final tally for the ended election
                    logger.info(`Computing final tally for election ${election.election_id}`);
                    const blockchainTally = await this.blockchainRepo.computeVoteTally(tallyId, election.election_id);
                    logger.info(`Final tally computed for election ${election.election_id}`);

                    const finalTally: VoteTally = {
                        election_id: election.election_id,
                        tallies: blockchainTally.tallies,
                        total_votes: Object.values(blockchainTally.tallies).reduce((sum, val) => sum + val, 0),
                        last_updated: new Date(),
                    }

                    await VoteTallyModel.updateOne(
                        { election_id: election.election_id },
                        { $set: finalTally },
                        { upsert: true }
                    );
                }
            }
        } catch (error) {
            logger.error(`Error in processElections: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Publish election results, transitioning from Ended to Published state
     * This is typically triggered manually by election officials after validating results
     */
    public async publishElectionResults(electionId: string): Promise<void> {
        try {
            const election = await this.blockchainRepo.getElection(electionId);
            
            // Verify the election is in the ended state
            if (election.status !== ElectionStatus.Ended) {
                throw new Error(`Cannot publish results for election ${electionId} as it is not in 'ended' state (current state: ${election.status})`);
            }
            
            // Update the status to published
            await this.blockchainRepo.updateElectionStatus(electionId, ElectionStatus.Published);
            logger.info(`Results for election ${electionId} have been published`);
            
            // Could trigger other actions like notifications, etc.
        } catch (error) {
            logger.error(`Error publishing election results: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}

// Singleton instance of the scheduler
let schedulerServiceInstance: ElectionSchedulerService | null = null;

/**
 * Initialize and start the election scheduler service
 */
export async function initElectionSchedulerService(): Promise<ElectionSchedulerService> {
    // Use admin connection to ensure the scheduler has sufficient privileges
    try {
        const [gateway, client] = await fabricAdminConnection();
        const network = gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');
        
        // Create the scheduler service
        schedulerServiceInstance = new ElectionSchedulerService(contract);
        schedulerServiceInstance.start();
        
        // Set up process termination handlers
        process.on('SIGINT', () => {
            logger.info('Received SIGINT. Stopping election scheduler...');
            if (schedulerServiceInstance) {
                schedulerServiceInstance.stop();
            }
        });
        
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM. Stopping election scheduler...');
            if (schedulerServiceInstance) {
                schedulerServiceInstance.stop();
            }
        });
        
        return schedulerServiceInstance;
    } catch (error) {
        logger.error(`Failed to initialize election scheduler service: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Get the scheduler service instance
 */
export function getSchedulerService(): ElectionSchedulerService {
    if (!schedulerServiceInstance) {
        throw new Error('Election scheduler service has not been initialized');
    }
    return schedulerServiceInstance;
}
