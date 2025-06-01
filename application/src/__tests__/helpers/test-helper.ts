import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IdentityManager } from '../../fabric-utils/identityManager';
import UserModel, { UserRole } from '../../models/user.model';
import { withFabricAdminConnection } from '../../fabric-utils/fabric';
import { BlockChainRepository } from '../../fabric-utils/BlockChainRepository';
import { CreateElectionRequest } from '../../models/election.model';

/**
 * Test helper with utility functions for integration tests
 */
export class TestHelper {
  /**
   * Create a test user in Fabric CA and MongoDB
   */
  static async createTestUser(governorate: string = 'Cairo') {
    const userId = uuidv4();
    const nationalId = `30301231230123`;
    const phone = '01234567891';

    const identityManager = new IdentityManager();
    
    try {
      // Register and enroll user in Fabric CA
      const admin = await identityManager.enrollAdmin();
      const secret = await identityManager.registerUser(admin, userId, '', 'voter');
      const userEnrollment = await identityManager.enrollUser(userId, secret);
      
      // Save user in MongoDB
      const userData = new UserModel({
        userId,
        nationalId,
        phone,
        governorate,
        certificate: userEnrollment.certificate,
        role: 'voter',
        status: 'active',
      });

      await userData.save();

      // Register user in blockchain
      await withFabricAdminConnection(async (contract) => {
        const blockchainRepo = new BlockChainRepository(contract);
        await blockchainRepo.registerUser(userId, governorate, UserRole.Voter);
      });

      return { userId, nationalId, phone, governorate };
    } catch (error) {
      console.error(`Error creating test user: ${error}`);
      throw error;
    }
  }

  /**
   * Clean up test data (should be called in afterEach or afterAll hooks)
   */
  static async cleanupTestData(testUserId?: string) {
    // Delete test users
    if (testUserId) {
      await UserModel.deleteOne({ userId: testUserId });
    } else {
      await UserModel.deleteMany({ userId: { $regex: /^TEST-/ } });
    }
  }

  /**
   * Generate random election data
   */
  static generateElectionData(): CreateElectionRequest {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    
    return {
      name: `Test Election ${Date.now()}`,
      description: 'Test election created for integration testing',
      candidates: [
        { name: 'Candidate 1', party: 'Party A', profile_image: 'image1.png', description: 'Candidate 1 description' },
        { name: 'Candidate 2', party: 'Party B', profile_image: 'image2.png', description: 'Candidate 2 description' },
      ],
      start_time: now.toISOString(),
      end_time: tomorrow.toISOString(),
      eligible_governorates: ['أسوان', 'قنا', 'الأقصر'], // Example governorates
      election_image: 'election_image.png', // URL to election image
    };
  }

  /**
   * Reset the database between tests if needed
   */
  static async resetDatabase() {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
}
