import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class TwilioService {
    private client: twilio.Twilio;
    private verifyService: string;

    constructor() {
        // Initialize Twilio client
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID || "AC09e60bb1cf519361f991ee872baa75a1",
            process.env.TWILIO_AUTH_TOKEN || "aa1112257e70457bee97a87a644dc2cf"
        );

        // Verify service SID (for phone verification)
        this.verifyService = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA9b1f1f384f57b369b5d6a8a41b2b3780';
    }

    /**
     * Send an SMS message
     * @param to Recipient's phone number
     * @param body Message body
     */
    async sendSMS(to: string, body: string): Promise<boolean> {
        try {
            await this.client.messages.create({
                body: body,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: to
            });
            return true;
        } catch (error) {
            console.error('Error sending SMS:', error);
            return false;
        }
    }

    /**
     * Start phone number verification
     * @param phoneNumber Phone number to verify
     */
    async sendOTP(phoneNumber: string): Promise<boolean> {
        try {
            const verification =await this.client.verify.v2
                .services(this.verifyService)
                .verifications.create({
                    to: phoneNumber,
                    channel: 'sms'
                });
            return verification.status === "pending"
        } catch (error) {
            console.error('Error starting verification:', error);
            return false;
        }
    }

    /**
     * Verify phone number code
     * @param phoneNumber Phone number being verified
     * @param code Verification code
     */
    async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
        try {
            const verificationCheck =  await this.client.verify.v2
                .services(this.verifyService)
                .verificationChecks.create({
                    to: phoneNumber,
                    code: code
                });
            return verificationCheck.status === 'approved'
        } catch (error) {
            console.error('Error checking verification:', error);
            return false;
        }
    }
}



export const twilioService = new TwilioService();