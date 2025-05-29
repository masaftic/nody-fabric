import { IUser, UserRole } from '../models/user.model';
import { logger } from '../logger';
import UserModel from '../models/user.model';

interface UserFilter {
  status?: string;
  governorate?: string;
  role?: string;
}

/**
 * Service to handle MongoDB operations for users
 */
export class UserService {
  /**
   * Save or update a user in MongoDB
   * @param userData The user data to save
   */
  /**
   * Save or update a user in MongoDB
   * Uses userId (which is not hashed) as the unique identifier
   * @param userData The user data to save
   */
  async saveUser(userData: IUser): Promise<void> {
    try {
      // Always use userId for lookups since it's not hashed
      const existingUser = await UserModel.findOne({ userId: userData.userId });

      if (existingUser) {
        // Update the existing user - be careful with phone and nationalId
        // which might be already hashed in the existing user
        const updatedData = { ...userData };

        Object.assign(existingUser, updatedData);
        await existingUser.save();
        logger.info(`User with ID ${userData.userId} updated in MongoDB`);
      } else {
        // Create a new user
        await UserModel.create(userData);
        logger.info(`User with ID ${userData.userId} created in MongoDB`);
      }
    } catch (error) {
      logger.error(`Error saving user to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a user by ID
   * @param userId The user ID to lookup
   * @returns User data or null if not found
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      // Try to look up by userId first (most efficient)
      const user = await UserModel.findOne({ userId });
      
      if (user) {
        return user;
      }
      
      // If this looks like a national ID (14 digits), try that lookup as well
      if (userId.match(/^\d{14}$/)) {
        return await this.findUserByNationalId(userId);
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting user by ID: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get all users with optional filtering
   * @param filter Optional filter criteria
   * @returns Array of users
   */
  async getUsers(filter: UserFilter = {}): Promise<IUser[]> {
    try {
      const query: any = {};
      
      if (filter.status) {
        query.status = filter.status;
      }
      
      if (filter.governorate) {
        query.governorate = filter.governorate;
      }
      
      if (filter.role) {
        query.role = filter.role;
      }
      
      const users = await UserModel.find(query);
      return users;
    } catch (error) {
      logger.error(`Error getting users: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Change user status (activate/suspend)
   * @param userId The user ID to update
   * @param status The new status ('active' or 'suspended')
   * @returns Updated user or null if not found
   */
  async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<IUser | null> {
    try {
      const user = await UserModel.findOne({ userId });
      
      if (!user) {
        return null;
      }
      
      user.status = status;
      await user.save();
      
      logger.info(`User ${userId} status updated to ${status}`);
      return user;
    } catch (error) {
      logger.error(`Error updating user status: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if a national ID is already in use
   * @param nationalId The plain (unhashed) national ID to check
   * @returns True if the national ID is in use, false otherwise
   */
  async isNationalIdInUse(nationalId: string): Promise<boolean> {
    try {
      // Since national IDs are hashed in the database, we need to check each user
      const users = await UserModel.find({});
      
      // Check if any user's hashed national ID matches the provided plain national ID
      for (const user of users) {
        const isMatch = await user.compareNationalId(nationalId);
        if (isMatch) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking national ID: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Find a user by phone number (handling hashing)
   * @param phoneNumber The plain (unhashed) phone number
   * @returns The user object or null if not found
   */
  async findUserByPhone(phoneNumber: string): Promise<IUser | null> {
    try {
      // Since phone numbers are hashed in the database, we need to check each user
      const users = await UserModel.find({});
      
      for (const user of users) {
        const isMatch = await user.comparePhoneNumber(phoneNumber);
        if (isMatch) {
          return user;
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error finding user by phone: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if a phone number is already in use
   * @param phone The plain (unhashed) phone number to check
   * @returns True if the phone number is in use, false otherwise
   */
  async isPhoneNumberInUse(phone: string): Promise<boolean> {
    try {
      // Since phone numbers are hashed in the database, we need to check each user
      const users = await UserModel.find({});
      
      // Check if any user's hashed phone matches the provided plain phone
      for (const user of users) {
        const isMatch = await user.comparePhoneNumber(phone);
        if (isMatch) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking phone number: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Find a user by national ID (handling hashing)
   * @param nationalId The plain (unhashed) national ID
   * @returns The user object or null if not found
   */
  async findUserByNationalId(nationalId: string): Promise<IUser | null> {
    try {
      // Since national IDs are hashed in the database, we need to check each user
      const users = await UserModel.find({});
      
      for (const user of users) {
        const isMatch = await user.compareNationalId(nationalId);
        if (isMatch) {
          return user;
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error finding user by national ID: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const userService = new UserService();
