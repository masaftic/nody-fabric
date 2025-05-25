import { Contract } from '@hyperledger/fabric-gateway';
import { logger } from '../../logger';
import { BaseRepository } from './BaseRepository';

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
    async registerUser(userId: string, governorate: string): Promise<void> {
        logger.info('Submit Transaction: RegisterUser, creating user with ID %s', userId);
        await this.contract.submitTransaction('RegisterUser', userId, governorate);
        logger.info('Transaction committed successfully: user created with ID %s', userId);
    }
}
