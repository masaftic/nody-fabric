import request from 'supertest';
import { Express } from 'express';
import { createTestServer } from '../helpers/test-server';
import { TestHelper } from '../helpers/test-helper';
import { StatusCodes } from 'http-status-codes';
import { withFabricConnection } from '../../fabric-utils/fabric';
import { BlockChainRepository } from '../../fabric-utils/BlockChainRepository';

describe('Election Controller Integration Tests', () => {
  let app: Express;
  let testUser: { userId: string; nationalId: string; phone: string; governorate: string };
  let createdElectionId: string;

  // Setup test server and create a test user
  beforeAll(async () => {
    app = createTestServer();
    testUser = await TestHelper.createTestUser();
    console.log(`Created test user with ID: ${testUser.userId}`);
  }, 30000); // Increased timeout for Fabric CA operations

  // Clean up after all tests
  afterAll(async () => {
    await TestHelper.cleanupTestData(testUser.userId);
  });

  describe('createElection', () => {
    it('should successfully create an election', async () => {
      // Arrange
      const electionData = TestHelper.generateElectionData();
      
      // Act
      const response = await request(app)
        .post('/api/v1/elections')
        .send({ ...electionData, userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('message', 'Election created successfully');
      expect(response.body).toHaveProperty('election_id');
      
      // Save the election ID for later tests
      createdElectionId = response.body.election_id;
    }, 15000); // Increased timeout for blockchain operations
    
    it('should return BAD REQUEST if missing required fields', async () => {
      // Arrange - Missing name field
      const incompleteData = {
        userId: testUser.userId,
        description: 'Test description',
      };
      
      // Act
      const response = await request(app)
        .post('/api/v1/elections')
        .send(incompleteData);
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body).toHaveProperty('message', 'Missing required fields');
    });
  });

  describe('getElection', () => {
    it('should retrieve a single election by ID', async () => {
      // Skip this test if no election was created
      if (!createdElectionId) {
        console.warn('Skipping test because no election was created');
        return;
      }
      
      // Act
      const response = await request(app)
        .get(`/api/v1/elections/${createdElectionId}`)
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('election_id', createdElectionId);
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get(`/api/v1/elections/${createdElectionId}`)
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getAllElections', () => {
    it('should retrieve all elections', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/elections')
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(Array.isArray(response.body)).toBe(true);
      
      // If we created an election, we should find it in the results
      if (createdElectionId) {
        const found = response.body.some((election: any) => election.election_id === createdElectionId);
        expect(found).toBe(true);
      }
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/elections')
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getActiveElections', () => {
    it('should retrieve active elections', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/elections?filter=active')
        .send({ userId: testUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(Array.isArray(response.body)).toBe(true);
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/elections?filter=active')
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  // Verify election cleanup by direct blockchain access
  describe('Blockchain verification', () => {
    it('should have the created election in the blockchain', async () => {
      // Skip if no election was created
      if (!createdElectionId) {
        console.warn('Skipping verification because no election was created');
        return;
      }

      // Get the election directly from the blockchain
      const election = await withFabricConnection(testUser.userId, async (contract) => {
        const blockchainRepo = new BlockChainRepository(contract);
        return await blockchainRepo.getElection(createdElectionId);
      });

      expect(election).toHaveProperty('election_id', createdElectionId);
    }, 10000);
  });
});
