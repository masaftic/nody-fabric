import { 
  ElectionModel, 
  Election,
  ElectionMetaData
} from '../models/election.model';
import { logger } from '../logger';

// Map to store pending UI metadata for elections before they're created on the blockchain
// Key: electionId, Value: {description, candidates}
export const pendingMetadata = new Map<string, ElectionMetaData>();


/**
 * Service to handle MongoDB operations for elections and their analytics
 * This service acts as a cache and analytics layer on top of Fabric
 */
export class ElectionDataService {
  /**
   * Save or update an election in MongoDB
   * @param electionData The election data to save
   */
  async saveElection(electionData: Election): Promise<void> {
    try {
      // First check if election exists
      const existingElection = await ElectionModel.findOne({ election_id: electionData.election_id });
      
      if (existingElection) {
        // Update only provided fields
        Object.assign(existingElection, electionData);
        await existingElection.save();
        logger.info(`Election ${electionData.election_id} updated in MongoDB`);
      } else {
        // Create new election
        await ElectionModel.create(electionData);
        logger.info(`Election ${electionData.election_id} created in MongoDB`);
      }
    } catch (error) {
      logger.error(`Error saving election to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Simplified version without analytics

  /**
   * Transform MongoDB document to Election model
   * @param doc The MongoDB document
   * @returns Election model object
   */
  private docToElection(doc: any): Election {
    return {
      election_id: doc.election_id,
      name: doc.name,
      description: doc.description,
      candidates: (doc.candidates || []).map((candidate: any) => {
        const { _id, ...rest } = candidate.toObject ? candidate.toObject() : candidate;
        return rest;
      }),
      start_time: doc.start_time instanceof Date ? doc.start_time.toISOString() : doc.start_time,
      end_time: doc.end_time instanceof Date ? doc.end_time.toISOString() : doc.end_time,
      status: doc.status as 'active' | 'inactive' | 'completed',
      eligible_governorates: doc.eligible_governorates || [],
      last_tally_time: doc.last_tally_time || (doc.vote_tally ? new Date().toISOString() : undefined),
      created_by: doc.created_by,
      featured_image: doc.featured_image
    };
  }

  /**
   * Get an election by ID from MongoDB
   * @param electionId The ID of the election to retrieve
   */
  async getElection(electionId: string): Promise<Election | null> {
    try {
      const election = await ElectionModel.findOne({ election_id: electionId });
      
      if (!election) {
        return null;
      }

      return this.docToElection(election);
    } catch (error) {
      logger.error(`Error getting election from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get all elections from MongoDB
   */
  async getAllElections(): Promise<Election[]> {
    try {
      const elections = await ElectionModel.find();
      return elections.map(this.docToElection.bind(this));
    } catch (error) {
      logger.error(`Error getting all elections from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get active elections from MongoDB
   */
  async getActiveElections(): Promise<Election[]> {
    try {
      const activeElections = await ElectionModel.find({ status: 'active' });
      return activeElections.map(this.docToElection.bind(this));
    } catch (error) {
      logger.error(`Error getting active elections from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Analytics functions removed for simplification
}

export const electionDataService = new ElectionDataService();
