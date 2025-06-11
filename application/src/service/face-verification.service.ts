import crypto from 'crypto';
import { logger } from '../logger';

interface FaceVerificationSecretStore {
    [nationalId: string]: {
        secret: string;
        expiresAt: Date;
    };
}

/**
 * A service to manage face verification secrets for user registration
 * This implementation uses an in-memory store, but can be extended to use Redis or DB
 */
class FaceVerificationService {
    private secretStore: FaceVerificationSecretStore = {};
    private SECRET_EXPIRY_HOURS = 24; // Secrets valid for 24 hours
    
    /**
     * Generate a face verification secret for a national ID
     * @param nationalId The national ID to generate a secret for
     * @returns The generated secret
     */
    generateSecret(nationalId: string): string {
        // Generate a random secret with nationalId as part of input
        const secret = crypto.createHash('sha256')
            .update(`${nationalId}-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`)
            .digest('hex');

        // Store the secret with expiration
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.SECRET_EXPIRY_HOURS);
        
        this.secretStore[nationalId] = {
            secret,
            expiresAt
        };
        
        logger.info(`Generated face verification secret for national ID: ${nationalId}`);
        return secret;
    }

    /**
     * Validate a face verification secret for a national ID
     * @param nationalId The national ID
     * @param secret The secret to validate
     * @returns True if valid, false otherwise
     */
    validateSecret(nationalId: string, secret: string): boolean {
        const storedData = this.secretStore[nationalId];
        
        // No stored secret for this nationalId
        if (!storedData) {
            logger.warn(`Face verification failed: No secret found for national ID: ${nationalId}`);
            return false;
        }
        
        // Secret expired
        if (new Date() > storedData.expiresAt) {
            logger.warn(`Face verification failed: Secret expired for national ID: ${nationalId}`);
            delete this.secretStore[nationalId]; // Clean up expired secret
            return false;
        }
        
        // Secret doesn't match
        if (storedData.secret !== secret) {
            logger.warn(`Face verification failed: Invalid secret for national ID: ${nationalId}. Provided: ${secret.substring(0,10)}..., Expected: ${storedData.secret.substring(0,10)}...`);
            return false;
        }
        
        // Valid secret - remove it after use to prevent reuse
        logger.info(`Face verification successful for national ID: ${nationalId}`);
        delete this.secretStore[nationalId];
        return true;
    }
}

export const faceVerificationService = new FaceVerificationService();
