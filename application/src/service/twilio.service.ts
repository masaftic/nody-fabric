// twilio-sms-otp.ts

import { Twilio } from 'twilio';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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
    private otpStore: Record<string, OtpRecord>;
    private twilioPhoneNumber: string;

    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
        const authToken = process.env.TWILIO_AUTH_TOKEN as string;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER as string

        this.twilioClient = new Twilio(accountSid, authToken);
        this.otpStore = {};

        // Start cleanup interval
        this.startCleanupInterval();
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
    async createAndSendOTP(phoneNumber: string): Promise<{ success: boolean; sessionId?: string; expiresAt?: Date; message: string }> {
        // Generate OTP

        console.log(`here ${process.env.TWILIO_ACCOUNT_SID} -> ${process.env.TWILIO_AUTH_TOKEN} -> ${process.env.TWILIO_PHONE_NUMBER}`)
        const otp = this.generateOTP();
        const sessionId = uuidv4();

        // Store OTP with expiration (10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        this.otpStore[sessionId] = {
            phoneNumber,
            otp,
            expiresAt,
            verified: false
        };

        // Send OTP via SMS
        const smsSent = await this.sendSMS(phoneNumber, otp);

        if (smsSent) {
            return {
                success: true,
                sessionId,
                expiresAt,
                message: 'OTP sent successfully'
            };
        } else {
            delete this.otpStore[sessionId]; // Clean up if SMS failed
            return {
                success: false,
                message: 'Failed to send OTP'
            };
        }
    }

    /**
     * Verify an OTP
     */
    verifyOTP(sessionId: string, otp: string): { success: boolean; message: string } {
        const otpRecord = this.otpStore[sessionId];

        // Check if OTP exists
        if (!otpRecord) {
            return {
                success: false,
                message: 'Invalid session ID'
            };
        }

        // Check if OTP has expired
        if (new Date() > otpRecord.expiresAt) {
            delete this.otpStore[sessionId]; // Clean up expired OTP
            return {
                success: false,
                message: 'OTP has expired'
            };
        }

        // Verify OTP
        if (otpRecord.otp === otp) {
            otpRecord.verified = true;
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
    async resendOTP(sessionId: string): Promise<{ success: boolean; expiresAt?: Date; message: string }> {
        const otpRecord = this.otpStore[sessionId];

        // Check if session exists
        if (!otpRecord) {
            return {
                success: false,
                message: 'Invalid session ID'
            };
        }

        // Generate new OTP
        const newOtp = this.generateOTP();

        // Update expiration (10 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        // Update record
        otpRecord.otp = newOtp;
        otpRecord.expiresAt = expiresAt;
        otpRecord.verified = false;

        // Send new OTP via SMS
        const smsSent = await this.sendSMS(otpRecord.phoneNumber, newOtp);

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

    /**
     * Start interval to cleanup expired OTPs
     */
    private startCleanupInterval(): void {
        // Cleanup expired OTPs periodically (every 15 minutes)
        setInterval(() => {
            const now = new Date();
            Object.keys(this.otpStore).forEach(sessionId => {
                if (now > this.otpStore[sessionId].expiresAt) {
                    delete this.otpStore[sessionId];
                }
            });
        }, 15 * 60 * 1000); // 15 minutes
    }
}


export const twilioService = new TwilioOtpService();