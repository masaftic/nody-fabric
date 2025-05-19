import request from 'supertest';
import { Express } from 'express';
import { createTestServer } from '../helpers/test-server';
import { TestHelper } from '../helpers/test-helper';
import { StatusCodes } from 'http-status-codes';

describe('Ledger Controller Integration Tests', () => {
  let app: Express;
  let adminUser: { userId: string; nationalId: string; phone: string; governorate: string };

  // Setup test server and create a test admin user
  beforeAll(async () => {
    app = createTestServer();
    
    // Create a test user that will act as admin for ledger operations
    adminUser = await TestHelper.createTestUser('Admin');
    console.log(`Created admin test user with ID: ${adminUser.userId}`);
  }, 30000);

  // Clean up after all tests
  afterAll(async () => {
    await TestHelper.cleanupTestData(adminUser.userId);
  });

  describe('initLedger', () => {
    it('should initialize the ledger successfully', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/ledger/init')
        .send({ userId: adminUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body).toHaveProperty('message', 'ledger initialized successfully');
    }, 15000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/ledger/init')
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('getWorldState', () => {
    it('should retrieve the world state', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/ledger/state')
        .send({ userId: adminUser.userId });
      
      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      // World state is an object with data from the blockchain
      expect(typeof response.body).toBe('object');
    }, 10000);
    
    it('should return BAD REQUEST if missing user ID', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/ledger/state')
        .send({});
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  // describe('deleteLedger', () => {
  //   // This test could be dangerous in a production environment,
  //   // so you might want to disable it or create a separate test environment
  //   it('should clear the ledger successfully', async () => {
  //     // Act
  //     const response = await request(app)
  //       .delete('/api/v1/ledger')
  //       .send({ userId: adminUser.userId });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.OK);
  //     expect(response.body).toHaveProperty('message', 'Ledger cleared successfully');
  //   }, 15000);
    
  //   it('should return BAD REQUEST if missing user ID', async () => {
  //     // Act
  //     const response = await request(app)
  //       .delete('/api/v1/ledger')
  //       .send({});
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });
});
