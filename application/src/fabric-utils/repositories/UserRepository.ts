import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';
import { BaseRepository } from './BaseRepository';
import { UserRole } from '../../models/user.model';

/**
 * Interface for user revocation record
 */
interface UserRevocation {
    user_id: string;
    reason: string;
    timestamp: string;
    revoked_by: string;
}

/**
 * Repository for interacting with user-related operations on the blockchain
 */
export class UserRepository extends BaseRepository {
    constructor(contract: Contract) {
        super(contract);
    }

    /**
     * Register a new user in the blockchain
     * @param userId The user's unique identifier
     * @param governorate The user's governorate
     */
    async registerUser(userId: string, governorate: string, userRole: UserRole): Promise<void> {
        logger.info('Submit Transaction: RegisterUser, creating user with ID %s', userId);
        await this.contract.submitTransaction('RegisterUser', userId, governorate, userRole);
        logger.info('Transaction committed successfully: user created with ID %s', userId);
    }

    /**
     * Get a user by ID from the blockchain
     * @param userId The user's unique identifier
     * @returns The user object from the blockchain
     */
    async getUserById(userId: string): Promise<any> {
        logger.info('Evaluate Transaction: GetUser, fetching user with ID %s', userId);
        const resultBytes = await this.contract.evaluateTransaction('GetUser', userId);
        const resultJson = this.utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);
        return result;
    }

    /**
     * Update a user's status in the blockchain
     * @param userId The user's unique identifier
     * @param status The new status ('active' or 'suspended')
     * @param reason The reason for the status change
     */
    async updateUserStatus(userId: string, status: string, reason: string): Promise<void> {
        logger.info('Submit Transaction: UpdateUserStatus, updating status for user with ID %s', userId);
        await this.contract.submitTransaction('UpdateUserStatus', userId, status, reason);
        logger.info('Transaction committed successfully: user status updated for ID %s', userId);
    }

    /**
     * Get the history of user revocations from the blockchain
     * @returns Array of revocation records
     */
    async getUserRevocations(): Promise<UserRevocation[]> {
        logger.info('Evaluate Transaction: GetUserRevocations');
        const resultBytes = await this.contract.evaluateTransaction('GetUserRevocations');
        const resultJson = this.utf8Decoder.decode(resultBytes);
        if (resultJson === '') {
            return [];
        }
        const result = JSON.parse(resultJson);
        return result;
    }
}
