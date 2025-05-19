import request from 'supertest';
import { Express } from 'express';
import { createTestServer } from '../helpers/test-server';
import { TestHelper } from '../helpers/test-helper';
import { StatusCodes } from 'http-status-codes';
import { withFabricConnection } from '../../fabric-utils/fabric';
import { BlockChainRepository } from '../../fabric-utils/BlockChainRepository';
import { VoteModel } from '../../models/election.model';

describe('Vote Controller Integration Tests', () => {
  let app: Express;
  let testUser: { userId: string; nationalId: string; phone: string; governorate: string };
  let electionId: string;
  let candidateId: string;
  let voteId: string;

  // Setup test server and create test data
  beforeAll(async () => {
    app = createTestServer();
    
    // Create a test user
    testUser = await TestHelper.createTestUser();
    console.log(`Created test user with ID: ${testUser.userId}`);
    
    // Create a test election with the user
    const electionData = TestHelper.generateElectionData();
    
    const electionResponse = await request(app)
      .post('/api/v1/elections')
      .send({ ...electionData, userId: testUser.userId });
    
    electionId = electionResponse.body.election_id;
    console.log(`Created test election with ID: ${electionId}`);
    
    // Get the candidate ID from the election
    const electionDetails = await withFabricConnection(testUser.userId, async (contract) => {
      const votingController = new BlockChainRepository(contract);
      return await votingController.getElection(electionId);
    });
    
    candidateId = electionDetails.candidates[0].candidate_id;
    console.log(`Using candidate with ID: ${candidateId}`);
  }, 30000); // Increased timeout for setup

  // Clean up after all tests
  afterAll(async () => {
    await TestHelper.cleanupTestData(testUser.userId);
    await VoteModel.deleteMany({ voter_id: testUser.userId });
  });

  describe('userVote', () => {
    it('should successfully cast a vote', async () => {
      // Arrange
      const voteData = {
        userId: testUser.userId,
        electionId,
        candidateId,
      };
      
      // Act
      const response = await request(app)
        .post('/api/v1/votes')
        .send(voteData);
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('message', 'Vote cast successfully');
      expect(response.body).toHaveProperty('receipt');
      
      // Save vote ID for later tests
      voteId = response.body.voteId;
    }, 15000);
    
    it('should return BAD REQUEST if missing required fields', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/votes')
        .send({ userId: testUser.userId }); // Missing electionId and candidateId
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getUserVote', () => {
    it('should retrieve a vote by ID', async () => {
      // Skip this test if no vote was cast
      if (!voteId) {
        console.warn('Skipping test because no vote was cast');
        return;
      }
      
      // Act
      const response = await request(app)
        .get(`/api/v1/votes/${voteId}`)
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('message', 'Vote retrieved successfully');
      expect(response.body.result).toHaveProperty('election_id', electionId);
      expect(response.body.result).toHaveProperty('candidate_id', candidateId);
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get(`/api/v1/votes/${voteId}`)
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getAllVotes', () => {
    it('should retrieve all votes', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/votes')
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('message', 'Votes retrieved successfully');
      expect(response.body).toHaveProperty('result');
      expect(Array.isArray(response.body.result)).toBe(true);
      
      // If we created a vote, we should find it in the results
      if (voteId) {
        const found = response.body.result.some((vote: any) => vote.vote_id === voteId);
        expect(found).toBe(true);
      }
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/votes')
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getUserVotes', () => {
    it('should retrieve votes for a specific user', async () => {
      // Act
      const response = await request(app)
        .get(`/api/v1/votes/user/${testUser.userId}`)
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('message', 'User votes retrieved successfully');
      expect(response.body).toHaveProperty('votes');
      expect(Array.isArray(response.body.votes)).toBe(true);
      
      // If we created a vote, we should find it in the results
      if (voteId) {
        const found = response.body.votes.some((vote: any) => vote.vote_id === voteId);
        expect(found).toBe(true);
      }
    }, 10000);
  });
});
