import { IUser } from '../models/user.model';
import { logger } from '../logger';
import UserModel from '../models/user.model';

/**
 * Service to handle MongoDB operations for users
 */
export class UserService {
  /**
   * Save or update a user in MongoDB
   * @param userData The user data to save
   */
  async saveUser(userData: IUser): Promise<void> {
    try {
      // Check if the user already exists
      const existingUser = await UserModel.findOne({ nationalId: userData.nationalId });

      if (existingUser) {
        // Update the existing user
        Object.assign(existingUser, userData);
        await existingUser.save();
        logger.info(`User ${userData.nationalId} updated in MongoDB`);
      } else {
        // Create a new user
        await UserModel.create(userData);
        logger.info(`User ${userData.nationalId} created in MongoDB`);
      }
    } catch (error) {
      logger.error(`Error saving user to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const userService = new UserService();
