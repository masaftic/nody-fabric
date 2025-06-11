import crypto from 'crypto';
import { logger } from '../logger';

interface OtpVerificationSecretStore {
    [phoneNumber: string]: {
        secret: string;
        expiresAt: Date;
    };
}

/**
 * A service to manage OTP verification secrets for user registration
 * This implementation uses an in-memory store, but can be extended to use Redis or DB
 */
class OtpVerificationService {
    private secretStore: OtpVerificationSecretStore = {};
    private SECRET_EXPIRY_HOURS = 2; // Shorter expiry than face verification (2 hours)
    
    /**
     * Generate a verification secret for a phone number after OTP verification
     * @param phoneNumber The verified phone number
     * @returns The generated secret
     */
    generateSecret(phoneNumber: string): string {
        // Generate a random secret with phone number as part of input
        const secret = crypto.createHash('sha256')
            .update(`${phoneNumber}-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`)
            .digest('hex');

        // Store the secret with expiration
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.SECRET_EXPIRY_HOURS);
        
        this.secretStore[phoneNumber] = {
            secret,
            expiresAt
        };
        
        logger.info(`Generated OTP verification secret for phone: ${phoneNumber}`);
        return secret;
    }

    /**
     * Validate a verification secret for a phone number
     * @param phoneNumber The phone number
     * @param secret The secret to validate
     * @returns True if valid, false otherwise
     */
    validateSecret(phoneNumber: string, secret: string): boolean {
        const storedData = this.secretStore[phoneNumber];
        
        // No stored secret for this phone number
        if (!storedData) {
            logger.warn(`OTP verification failed: No secret found for phone: ${phoneNumber}`);
            return false;
        }
        
        // Secret expired
        if (new Date() > storedData.expiresAt) {
            logger.warn(`OTP verification failed: Secret expired for phone: ${phoneNumber}`);
            delete this.secretStore[phoneNumber]; // Clean up expired secret
            return false;
        }
        
        // Secret doesn't match
        if (storedData.secret !== secret) {
            logger.warn(`OTP verification failed: Invalid secret for phone: ${phoneNumber}. Provided: ${secret.substring(0,10)}..., Expected: ${storedData.secret.substring(0,10)}...`);
            return false;
        }
        
        // Valid secret - remove it after use to prevent reuse
        logger.info(`OTP verification successful for phone: ${phoneNumber}`);
        delete this.secretStore[phoneNumber];
        return true;
    }
}

export const otpVerificationService = new OtpVerificationService();
