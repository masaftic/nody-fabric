import { Contract, Network, checkpointers } from '@hyperledger/fabric-gateway';
import { logger } from '../logger';
import { BlockChainRepository } from '../fabric-utils/BlockChainRepository';
import { CreateElectionRequest, Election, Vote, VoteModel, VoteTallyModel } from '../models/election.model';
import { AuditEventModel, createAuditEvent, EventType } from '../models/audit.model';

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
                    const voteData: Vote = JSON.parse(Buffer.from(event.payload).toString());
                    logger.info(`Vote cast for election ${voteData.election_id}`);
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
                    await this.handleTallyComputed(tallyData);
                    break;
                    
                  case 'user_registered':
                    const userData = JSON.parse(Buffer.from(event.payload).toString());
                    await this.handleUserRegistered(userData);
                    break;
                    
                  case 'user_status_updated':
                    const userStatusData = JSON.parse(Buffer.from(event.payload).toString());
                    await this.handleUserStatusUpdated(userStatusData);
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

    const sampleElection: CreateElectionRequest = {
      name: 'Initial Election',
      description: 'Sample test election created automatically',
      candidates: [
        {
          name: 'Candidate 1',
          party: 'Party A',
          profile_image: 'image1.png',
          description: 'Candidate 1 description'
        },
        {
          name: 'Candidate 2',
          party: 'Party B',
          profile_image: 'image2.png',
          description: 'Candidate 2 description'
        },
        {
          name: 'Candidate 3',
          party: 'Independent',
          profile_image: 'image3.png',
          description: 'Candidate 3 description'
        }
      ],
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(), // 1 day later
      eligible_governorates: ['البحر الأحمر', 'القاهرة', 'الإسكندرية'], // Example governorates
      election_image: 'election_image.png' // URL to election image
    };

    const blockchainRepo = new BlockChainRepository(this.contract);
    await blockchainRepo.createElection(sampleElection);
  }

  /**
   * Verify blockchain elections integrity
   */
  private async verifyBlockchainElections(): Promise<void> {
    const blockchainRepo = new BlockChainRepository(this.contract);

    // Get all elections
    let elections = await blockchainRepo.getAllElections();

    if (elections.length === 0) {
      logger.info('No elections found on the blockchain');
      return;
    }

    // Verify elections and compute tallies if needed
    for (const election of elections) {
      // Compute the current tally for the election (optional, can be commented out)
      await blockchainRepo.computeVoteTally(crypto.randomUUID(), election.election_id);
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

    try {
      // Create audit event for election creation
      const auditEvent = createAuditEvent('election_created', {
        election_id: electionId,
        name: electionData.name,
        creator_id: 'system', // In a real system, this would come from the event
        eligible_governorates: electionData.eligible_governorates,
        candidate_count: electionData.candidates.length
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);
      
      logger.info(`Election creation audit event recorded for ${electionId}`);
    } catch (error) {
      logger.error(`Failed to record election creation audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle election updated event
   * @param electionData The election data
   */
  private async handleElectionUpdated(electionData: any): Promise<void> {
    const electionId = electionData.election_id || electionData.electionId;
    logger.info(`Election ${electionId} updated on blockchain`);
    
    try {
      // Create audit event for election update
      const auditEvent = createAuditEvent('election_updated', {
        election_id: electionId,
        updater_id: 'system', // In a real system, this would come from the event
        updated_fields: Object.keys(electionData).filter(key => 
          key !== 'election_id' && key !== 'electionId'
        ),
        status: electionData.status || 'unknown'
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);
      
      logger.info(`Election update audit event recorded for ${electionId}`);
    } catch (error) {
      logger.error(`Failed to record election update audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle vote cast event
   * @param voteData The entire vote object from the blockchain
   */
  private async handleVoteCast(voteData: Vote): Promise<void> {
    logger.info(`Vote cast for candidate ${voteData.candidate_id} in election ${voteData.election_id}`);

    try {
      // Save vote record to MongoDB with blockchain-generated receipt
      // No need to fetch the vote again as we have all the data from the event
      await VoteModel.create(voteData);

      // Update the vote tally in real-time
      await this.updateVoteTally(voteData.election_id, voteData.candidate_id);

      // Create audit event for the vote
      const auditEvent = createAuditEvent('vote_cast', {
        election_id: voteData.election_id,
        voter_id: voteData.voter_id,
        candidate_id: voteData.candidate_id,
        receipt: voteData.receipt,
        vote_id: voteData.vote_id
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);

      logger.info(`Vote record saved to MongoDB from event with ID ${voteData.vote_id}`);
    } catch (error) {
      logger.error(`Failed to process vote event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle tally computed event
   * @param tallyData The tally data from the event
   */
  private async handleTallyComputed(tallyData: any): Promise<void> {
    const electionId = tallyData.electionId || tallyData.election_id;
    logger.info(`Tally computed for election ${electionId}`);
    
    try {
      // Create audit event for tally computation
      const auditEvent = createAuditEvent('tally_computed', {
        election_id: electionId,
        timestamp: tallyData.timestamp,
        computed_by: tallyData.user_id || 'system'
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);
      
      logger.info(`Tally computation audit event recorded for ${electionId}`);
    } catch (error) {
      logger.error(`Failed to record tally computation audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle user registered event
   * @param userData The user data from the event
   */
  private async handleUserRegistered(userData: any): Promise<void> {
    logger.info(`User registered: ${userData.user_id} with role ${userData.role}`);
    
    try {
      // Create audit event for user registration
      const auditEvent = createAuditEvent('user_registered', {
        user_id: userData.user_id,
        governorate: userData.governorate,
        role: userData.role,
        timestamp: userData.timestamp || new Date().toISOString()
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);
      
      logger.info(`User registration audit event recorded for ${userData.user_id}`);
    } catch (error) {
      logger.error(`Failed to record user registration audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle user status updated event
   * @param userStatusData The user status data from the event
   */
  private async handleUserStatusUpdated(userStatusData: any): Promise<void> {
    logger.info(`User status updated: ${userStatusData.user_id} to ${userStatusData.status}`);
    
    try {
      // Create audit event for user status update
      const auditEvent = createAuditEvent('user_status_updated', {
        user_id: userStatusData.user_id,
        status: userStatusData.status,
        reason: userStatusData.reason || 'Not specified',
        updated_by: userStatusData.updated_by || 'system',
        timestamp: userStatusData.timestamp || new Date().toISOString()
      });
      
      // Store the audit event in MongoDB
      await AuditEventModel.create(auditEvent);
      
      logger.info(`User status update audit event recorded for ${userStatusData.user_id}`);
    } catch (error) {
      logger.error(`Failed to record user status update audit event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update vote tally for a specific election and candidate
   * @param electionId The election ID
   * @param candidateId The candidate ID
   */
  private async updateVoteTally(electionId: string, candidateId: string): Promise<void> {
    try {
      // Attempt atomic update assuming the tally already exists
      const updateResult = await VoteTallyModel.updateOne(
        { election_id: electionId },
        {
          $inc: {
            [`tallies.${candidateId}`]: 1,
            total_votes: 1
          },
          $set: {
            last_updated: new Date()
          }
        }
      );

      // If no documents matched (tally doesn't exist), create a new one
      if (updateResult.matchedCount === 0) {
        const blockchainRepo = new BlockChainRepository(this.contract);
        const election = await blockchainRepo.getElection(electionId);

        const initialTallies: Record<string, number> = {};
        for (const candidate of election.candidates) {
          initialTallies[candidate.candidate_id] = 0;
        }

        // Increment the voted candidate
        if (initialTallies[candidateId] === undefined) {
          // Defensive check in case candidate is not in election
          throw new Error(`Candidate ${candidateId} not found in election ${electionId}`);
        }

        initialTallies[candidateId] = 1;

        await VoteTallyModel.create({
          election_id: electionId,
          tallies: initialTallies,
          total_votes: 1,
          last_updated: new Date()
        });
      }

      logger.debug(`Vote tallied for election ${electionId}, candidate ${candidateId}`);
    } catch (error) {
      logger.error(`Failed to update vote tally: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// This will be initialized in the application startup
export let fabricEventService: FabricEventService;

export const initFabricEventService = (network: Network): FabricEventService => {
  fabricEventService = new FabricEventService(network);
  return fabricEventService;
};
