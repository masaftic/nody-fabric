import crypto from 'crypto';
import { logger } from '../logger';

/**
 * Interface for storing challenge data
 */
interface ChallengeStore {
    [userId: string]: {
        challenge: string;
        expiresAt: Date;
    };
}

/**
 * Service for handling authentication challenges for secure login
 */
class AuthChallengeService {
    private challengeStore: ChallengeStore = {};
    private CHALLENGE_EXPIRY_MINUTES = 5; // Challenge valid for 5 minutes
    
    /**
     * Generate a random challenge for a user
     * @param userId The user ID to generate challenge for
     * @returns The generated challenge string
     */
    generateChallenge(userId: string): string {
        // Generate a random challenge
        const challenge = crypto.randomBytes(32).toString('hex');
        
        // Store with expiration
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.CHALLENGE_EXPIRY_MINUTES);
        
        this.challengeStore[userId] = {
            challenge,
            expiresAt
        };
        
        logger.info(`Generated auth challenge for user: ${userId}`);
        return challenge;
    }
    
    /**
     * Verify if a challenge is valid for a user
     * @param userId The user ID
     * @param challenge The challenge to verify
     * @returns True if valid, false otherwise
     */
    verifyChallenge(userId: string, challenge: string): boolean {
        const storedData = this.challengeStore[userId];
        
        // No stored challenge for this user
        if (!storedData) {
            logger.warn(`Challenge verification failed: No challenge found for user: ${userId}`);
            return false;
        }
        
        // Challenge expired
        if (new Date() > storedData.expiresAt) {
            logger.warn(`Challenge verification failed: Challenge expired for user: ${userId}`);
            delete this.challengeStore[userId]; // Clean up expired challenge
            return false;
        }
        
        // Challenge doesn't match
        if (storedData.challenge !== challenge) {
            logger.warn(`Challenge verification failed: Invalid challenge for user: ${userId}`);
            return false;
        }
        
        // Valid challenge - remove it after use to prevent reuse
        logger.info(`Challenge verification successful for user: ${userId}`);
        delete this.challengeStore[userId];
        return true;
    }
}

export const authChallengeService = new AuthChallengeService();
