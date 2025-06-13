// twilio-sms-otp.ts

import { Twilio } from 'twilio';
import dotenv from 'dotenv';
import { logger } from '../logger';

// Load environment variables
dotenv.config();

// OTP record interface
interface OtpRecord {
    phoneNumber: string;
    otp: string;
    expiresAt: Date;
    verified: boolean;
}



class TwilioOtpService {
    private twilioClient: Twilio;
    private twilioPhoneNumber: string;
    private otpStore: Map<string, { otp: string, expiresAt: Date, verified: boolean }>;

    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
        const authToken = process.env.TWILIO_AUTH_TOKEN as string;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER as string;

        if (!accountSid || !authToken || !this.twilioPhoneNumber) {
            console.error('Twilio configuration is incomplete');
        }

        this.twilioClient = new Twilio(accountSid, authToken);
        this.otpStore = new Map();
    }

    /**
     * Generate a random 6-digit OTP
     */
    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Send OTP via Twilio SMS
     */
    private async sendSMS(phoneNumber: string, otp: string): Promise<boolean> {
        try {
            const message = await this.twilioClient.messages.create({
                body: `Your verification code is: ${otp}. This code will expire in 10 minutes.`,
                from: this.twilioPhoneNumber,
                // messagingServiceSid:"process.env['TWILIO_VERIFY_SERVICE_SID']",
                to: phoneNumber
            });

            console.log(`SMS sent with SID: ${message.sid}`);
            return true;
        } catch (error) {
            console.error('Error sending SMS:', error);
            return false;
        }
    }

    /**
     * Create and send a new OTP
     */
    async createAndSendOTP(phoneNumber: string): Promise<{ success: boolean; expiresAt?: Date; message: string  }> {
        // Generate OTP
        const otp = this.generateOTP();

        // Store OTP with expiration (30 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        // Store in memory
        this.otpStore.set(phoneNumber, {
            otp,
            expiresAt,
            verified: false
        });
        
        logger.info(`Generated OTP '${otp}' for ${phoneNumber}, expires at ${expiresAt.toISOString()}`);

        // Send OTP via SMS
        const smsSent = await this.sendSMS(phoneNumber, otp);

        if (smsSent) {
            return {
                success: true,
                expiresAt,
                message: 'OTP sent successfully'
            };
        } else {
            // Clean up store if SMS failed
            this.otpStore.delete(phoneNumber);
            return {
                success: false,
                message: 'Failed to send OTP'
            };
        }
    }

    /**
     * Verify an OTP
     */
    async verifyOTP(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
        // Get stored OTP record
        const otpRecord = this.otpStore.get(phoneNumber);

        // Check if OTP exists for this phone number
        if (!otpRecord) {
            return {
                success: false,
                message: 'No OTP found for this phone number'
            };
        }

        // Check if OTP has expired
        if (new Date() > otpRecord.expiresAt) {
            // Remove expired OTP
            this.otpStore.delete(phoneNumber);
            return {
                success: false,
                message: "Expired OTP"
            }
        }

        // Verify OTP
        if (otpRecord.otp === otp) {
            // Mark as verified
            otpRecord.verified = true;
            
            logger.info(`OTP verified successfully for ${phoneNumber}`);
            
            return {
                success: true,
                message: 'OTP verified successfully'
            };
        } else {
            return {
                success: false,
                message: 'Invalid OTP'
            };
        }
    }

    /**
     * Resend OTP
     */
    async resendOTP(phoneNumber: string): Promise<{ success: boolean; expiresAt?: Date; message: string }> {
        // Generate new OTP
        const newOtp = this.generateOTP();

        // Update expiration (10 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        // Update in-memory store
        this.otpStore.set(phoneNumber, {
            otp: newOtp,
            expiresAt,
            verified: false
        });
        
        logger.info(`Resent OTP for ${phoneNumber}, expires at ${expiresAt.toISOString()}`);

        // Send new OTP via SMS
        const smsSent = await this.sendSMS(phoneNumber, newOtp);

        if (smsSent) {
            return {
                success: true,
                expiresAt,
                message: 'OTP resent successfully'
            };
        } else {
            return {
                success: false,
                message: 'Failed to resend OTP'
            };
        }
    }
}


export const twilioService = new TwilioOtpService();