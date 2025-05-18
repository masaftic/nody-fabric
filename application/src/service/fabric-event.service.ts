import { Contract, Network, checkpointers, ChaincodeEvent } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import { electionDataService, pendingMetadata } from './election.service';
import { BlockChainRepository } from '../fabric-utils/votingContractController';
import { BlockchainElection } from '../models/election.model';

/**
 * Service to handle Fabric events for real-time updates to MongoDB
 */
export class FabricEventService {
  private contract: Contract;
  private network: Network;
  private isListening: boolean = false;
  private chaincodeName: string = 'basic';

  constructor(network: Network) {
    this.network = network;
    this.contract = network.getContract(this.chaincodeName);
  }

  /**
   * Start listening for blockchain events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      logger.info('Already listening for Fabric events');
      return;
    }

    try {
      logger.info('Starting to listen for Fabric events');

      // Start the block event listener in a separate async process
      this.startBlockEventListener();

      // Start the chaincode event listener in a separate async process
      this.startChaincodeEventListener();

      this.isListening = true;
      logger.info('Successfully started listening for Fabric events');
    } catch (error) {
      logger.error(`Error setting up event listeners: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Start listening for block events
   * This runs as a background process
   */
  private async startBlockEventListener(): Promise<void> {
    // Create a checkpointer to track progress
    const blockCheckpointer = checkpointers.inMemory();

    // Start event processing loop in the background
    (async () => {
      while (true) {
        try {
          const events = await this.network.getBlockEvents({
            checkpoint: blockCheckpointer,
            // Uncomment and set a starting block if needed
            // startBlock: BigInt(1),
          });

          try {
            logger.info('Block event listener started successfully');

            for await (const event of events) {
              try {
                logger.debug(`Received block event: Block #${event.getHeader()?.getNumber()}`);

                // Process the block event
                // For now, we'll periodically fetch all elections
                // const votingController = new VotingContractController(this.contract);
                // const elections = await votingController.getAllElections();

                // // Update our MongoDB with latest blockchain data
                // for (const election of elections) {
                //   await electionDataService.saveElection(election);
                //   await votingController.computeVoteTally(election.election_id);
                //   // Analytics removed for simplification
                // }

                // Checkpoint after processing the block
                const blockNumber = event.getHeader()?.getNumber();
                if (blockNumber !== undefined) {
                  await blockCheckpointer.checkpointBlock(BigInt(blockNumber));
                } else {
                  logger.warn('Block number is undefined, skipping checkpoint.');
                }

              } catch (processError) {
                logger.error(`Error processing block event: ${processError instanceof Error ? processError.message : String(processError)}`);
              }
            }
          } catch (iterationError) {
            logger.error(`Block event iteration error: ${iterationError instanceof Error ? iterationError.message : String(iterationError)}`);
          } finally {
            events.close();
          }
        } catch (connectionError) {
          logger.error(`Block events connection error: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    })().catch(err => {
      logger.error(`Unhandled error in block event listener: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Start listening for chaincode events
   * This runs as a background process
   */
  private async startChaincodeEventListener(): Promise<void> {
    // Create a checkpointer to track progress
    const chaincodeCheckpointer = checkpointers.inMemory();

    // Start event processing loop in the background
    (async () => {
      while (true) {
        try {
          const events = await this.network.getChaincodeEvents(this.chaincodeName
            , {
            checkpoint: chaincodeCheckpointer,
            // Uncomment and set a starting block if needed
            // startBlock: BigInt(1),
          }
            );

          try {
            logger.info('Chaincode event listener started successfully');

            for await (const event of events) {
              try {
                logger.debug(`Received chaincode event: ${event.eventName}`);
                const payload = Buffer.from(event.payload).toString();

                // Process different event types based on the event name
                switch (event.eventName) {
                  case 'vote_cast':
                    // Vote handling removed for simplification
                    const voteData = JSON.parse(Buffer.from(event.payload).toString());
                    logger.info(`Vote cast for election ${voteData.electionId}`);
                    break;

                  case 'election_created':
                    logger.info('Processing election created event');
                    // Process blockchain election data
                    const blockchainElectionData: BlockchainElection = JSON.parse(Buffer.from(event.payload).toString());
                    
                    await this.handleElectionCreated(blockchainElectionData);
                    break;

                  case 'election_updated':
                    // Process updated blockchain election data
                    const updatedBlockchainData = JSON.parse(Buffer.from(event.payload).toString());
                    await this.handleElectionUpdated(updatedBlockchainData);
                    break;

                  case 'tally_computed':
                    // Parse payload to get the election ID
                    // const tallyData = JSON.parse(Buffer.from(event.payload).toString());
                    // const electionId = tallyData.electionId || tallyData.election_id;
                    
                    // if (electionId) {
                    //   // Just log that we received the tally event - analytics removed for simplification
                    //   logger.info(`Received vote tally event for election ${electionId}`);
                    // } else {
                    //   logger.error('Tally computed event received without election ID');
                    // }
                    break;

                  default:
                    logger.info(`Unhandled chaincode event: ${event.eventName}`);
                }

                // Checkpoint after processing
                // await chaincodeCheckpointer.checkpointChaincodeEvent(event);

              } catch (processError) {
                logger.error(`Error processing chaincode event: ${processError instanceof Error ? processError.message : String(processError)}`);
              }
            }
          } catch (iterationError) {
            logger.error(`Chaincode event iteration error: ${iterationError instanceof Error ? iterationError.message : String(iterationError)}`);
          } finally {
            events.close();
          }
        } catch (connectionError) {
          logger.error(`Chaincode events connection error: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    })().catch(err => {
      logger.error(`Unhandled error in chaincode event listener: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Create a sample election for testing
   */
  private async createSampleElection(): Promise<void> {
    logger.info('Creating sample test election');
    
    const sampleElection = {
      election_id: 'test-election-002' + Math.floor(Math.random() * 1000),
      name: 'Initial Election',
      candidate_ids: [
        'candidate-001',
        'candidate-002',
        'candidate-003'
      ],
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(), // 1 day later
      eligible_governorates: ['Governorate A', 'Governorate B'],
    };
    
    const votingController = new BlockChainRepository(this.contract);
    await votingController.createElection(sampleElection);
  }
  
  /**
   * Sync blockchain elections to MongoDB
   */
  private async syncElectionsToMongoDB(): Promise<void> {
    const votingController = new BlockChainRepository(this.contract);
    
    // Get all elections
    let elections = await votingController.getAllElections();
    
    if (elections.length === 0) {
      logger.info('No elections found on the blockchain');
      return;
    }

    // Save all elections to MongoDB and update tallies
    for (const election of elections) {
      await electionDataService.saveElection(election);
      
      // // Compute the current tally for the election
      // await votingController.computeVoteTally(election.election_id);
      
      // // Get the updated election with vote tally
      // const updatedElection = await votingController.getElection(election.election_id);
      // await electionDataService.saveElection(updatedElection);
    }
    
    logger.info(`Synced ${elections.length} elections to MongoDB`);
  }

  /**
   * Initialize by syncing all current data from blockchain to MongoDB
   */
  async syncInitialData(userId: string): Promise<void> {
    try {
      logger.info('Syncing initial data from blockchain to MongoDB');
      
      await this.createSampleElection();
      await this.syncElectionsToMongoDB();

      // In a real implementation, we would also sync votes
      // This would require a GetAllVotes method in the chaincode

      logger.info('Initial data sync completed');
    } catch (error) {
      logger.error(`Error syncing initial data: ${error instanceof Error ? error.message : String(error)}`);
      console.log(JSON.stringify(error));
      throw error;
    }
  }

  /**
   * Handle election created event
   * @param blockchainData The blockchain election data
   */
  private async handleElectionCreated(blockchainData: BlockchainElection): Promise<void> {
    const electionId = blockchainData.election_id;
    
    // Check if we have UI metadata pending for this election
    const pendingData = pendingMetadata.get(electionId);
    
    // Base election data from blockchain
    const baseElection = {
      ...blockchainData
    };
    
    if (pendingData) {
      // Create a complete election record with blockchain data + UI metadata
      await electionDataService.saveElection({
        ...baseElection,
        description: pendingData.description || "Created on blockchain",
        candidates: pendingData.candidates
      });
      
      // Remove the metadata from the pending map as we've used it
      pendingMetadata.delete(electionId);
      logger.info(`Created complete election record with UI metadata for ${electionId}`);
    } else {
      // We don't have UI metadata, just use the blockchain data with placeholders
      await electionDataService.saveElection({
        ...baseElection,
        description: "Created on blockchain", // Placeholder
        candidates: blockchainData.candidate_ids.map((id: string) => ({
          candidate_id: id,
          name: `Candidate ${id.substring(0, 5)}`,
          party: 'Unknown'
        }))
      });
      logger.info(`Created basic election record for ${electionId} (no UI metadata available)`);
    }
  }

  /**
   * Handle election updated event
   * @param blockchainData The blockchain election data
   */
  private async handleElectionUpdated(blockchainData: any): Promise<void> {
    const electionId = blockchainData.electionId;
    
  //   // Get existing detailed data
  //   const existingElection = await electionDataService.getElection(electionId);
    
  //   if (existingElection) {
  //     // Update only blockchain-specific fields
  //     await electionDataService.saveElection({
  //       election_id: electionId,
  //       status: blockchainData.electionStatus,
  //       last_tally_time: blockchainData.lastTallyTime
  //     });
  //     logger.info(`Updated existing election record for ${electionId}`);
  //   } else {
  //     // Create basic record with blockchain data if detailed data doesn't exist
  //     const baseElection = {
  //       election_id: electionId,
  //       name: blockchainData.name,
  //       description: "Updated on blockchain", // Placeholder
  //       start_time: blockchainData.startTime,
  //       end_time: blockchainData.endTime,
  //       status: blockchainData.electionStatus,
  //       eligible_governorates: blockchainData.eligibleGovernorates || []
  //     };
      
  //     // Add candidates if they exist in the data
  //     const candidates = blockchainData.candidateIds?.map((id: string) => ({
  //       candidate_id: id,
  //       name: `Candidate ${id.substring(0, 5)}`, // Placeholder
  //       party: 'Unknown' // Placeholder
  //     })) || [];
      
  //     await electionDataService.saveElection({
  //       ...baseElection,
  //       candidates
  //     });
  //     logger.info(`Created new election record from update for ${electionId}`);
  //   }
  }
}

// This will be initialized in the application startup
export let fabricEventService: FabricEventService;

export const initFabricEventService = (network: Network): FabricEventService => {
  fabricEventService = new FabricEventService(network);
  return fabricEventService;
};
