import { Contract, Network, checkpointers } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import { BlockChainRepository } from '../fabric-utils/BlockChainRepository';
import { Election } from '../models/election.model';

/**
 * Service to handle Fabric events for logging and real-time updates
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
          });

          try {
            logger.info('Block event listener started successfully');

            for await (const event of events) {
              try {
                logger.debug(`Received block event: Block #${event.getHeader()?.getNumber()}`);

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
          const events = await this.network.getChaincodeEvents(this.chaincodeName, {
            checkpoint: chaincodeCheckpointer,
          });

          try {
            logger.info('Chaincode event listener started successfully');

            for await (const event of events) {
              try {
                logger.debug(`Received chaincode event: ${event.eventName}`);
                const payload = Buffer.from(event.payload).toString();

                // Process different event types based on the event name
                switch (event.eventName) {
                  case 'vote_cast':
                    const voteData = JSON.parse(Buffer.from(event.payload).toString());
                    logger.info(`Vote cast for election ${voteData.electionId}`);
                    await this.handleVoteCast(voteData);
                    break;

                  case 'election_created':
                    logger.info('Processing election created event');
                    const electionData: Election = JSON.parse(Buffer.from(event.payload).toString());
                    await this.handleElectionCreated(electionData);
                    break;

                  case 'election_updated':
                    const updatedData = JSON.parse(Buffer.from(event.payload).toString());
                    await this.handleElectionUpdated(updatedData);
                    break;

                  case 'tally_computed':
                    const tallyData = JSON.parse(Buffer.from(event.payload).toString());
                    logger.info(`Tally computed for election ${tallyData.electionId || tallyData.election_id}`);
                    break;

                  default:
                    logger.info(`Unhandled chaincode event: ${event.eventName}`);
                }

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
      name: 'Initial Election',
      description: 'Sample test election created automatically',
      candidates: [
        {
          name: 'Candidate 1',
          party: 'Party A',
          profile_image: 'image1.png'
        },
        {
          name: 'Candidate 2',
          party: 'Party B',
          profile_image: 'image2.png'
        },
        {
          name: 'Candidate 3',
          party: 'Independent',
          profile_image: 'image3.png'
        }
      ],
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(), // 1 day later
      eligible_governorates: ['Governorate A', 'Governorate B'],
    };
    
    const votingController = new BlockChainRepository(this.contract);
    await votingController.createElection(sampleElection);
  }
  
  /**
   * Verify blockchain elections integrity
   */
  private async verifyBlockchainElections(): Promise<void> {
    const votingController = new BlockChainRepository(this.contract);
    
    // Get all elections
    let elections = await votingController.getAllElections();
    
    if (elections.length === 0) {
      logger.info('No elections found on the blockchain');
      return;
    }

    // Verify elections and compute tallies if needed
    for (const election of elections) {
      // Compute the current tally for the election (optional, can be commented out)
      await votingController.computeVoteTally(election.election_id);
    }
    
    logger.info(`Verified ${elections.length} elections on the blockchain`);
  }

  /**
   * Initialize by verifying blockchain data
   */
  async syncInitialData(): Promise<void> {
    try {
      logger.info('Verifying blockchain data integrity');
      
      await this.createSampleElection();
      // await this.verifyBlockchainElections();

      logger.info('Initial data verification completed');
    } catch (error) {
      logger.error(`Error verifying blockchain data: ${error instanceof Error ? error.message : String(error)}`);
      console.log(JSON.stringify(error));
      throw error;
    }
  }

  /**
   * Handle election created event
   * @param electionData The election data
   */
  private async handleElectionCreated(electionData: Election): Promise<void> {
    const electionId = electionData.election_id;
    logger.info(`Election ${electionId} created on blockchain: "${electionData.name}"`);
    
  }

  /**
   * Handle election updated event
   * @param electionData The election data
   */
  private async handleElectionUpdated(electionData: any): Promise<void> {
    const electionId = electionData.election_id || electionData.electionId;
    logger.info(`Election ${electionId} updated on blockchain`);
  
  }

  /**
   * Handle vote cast event
   * @param voteData The data from the vote_cast event
   */
  private async handleVoteCast(voteData: { electionId: string; candidateId: string }): Promise<void> {
    const { electionId, candidateId } = voteData;
    logger.info(`Vote cast for candidate ${candidateId} in election ${electionId}`);
    
    // Pre-aggregate votes for the candidate

  }
}

// This will be initialized in the application startup
export let fabricEventService: FabricEventService;

export const initFabricEventService = (network: Network): FabricEventService => {
  fabricEventService = new FabricEventService(network);
  return fabricEventService;
};
