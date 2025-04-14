// twilio-sms-otp.ts

import { Twilio } from 'twilio';
import dotenv from 'dotenv';
import User from "../models/user.model";

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

    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
        const authToken = process.env.TWILIO_AUTH_TOKEN as string;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER as string;

        if (!accountSid || !authToken || !this.twilioPhoneNumber) {
            console.error('Twilio configuration is incomplete');
        }

        this.twilioClient = new Twilio(accountSid, authToken);
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

        // get user with
        const user  = await User.findOne({phone:phoneNumber}).select("+phone +isVerified +verifyCode +verifyCodeExpireOn")

        if(!user){
            return {
                success:false,
                message:"User Not Found With This Phone Number"
            }
        }

        // Generate OTP
        const otp = this.generateOTP();

        // Store OTP with expiration (30 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        user.verifyCode = otp;
        user.verifyCodeExpireOn = expiresAt;

        await user.save();

        // Send OTP via SMS
        const smsSent = await this.sendSMS(phoneNumber, otp);

        if (smsSent) {
            return {
                success: true,
                expiresAt,
                message: 'OTP sent successfully'
            };
        } else {
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

        const user = await User.findOne({phone:phoneNumber}).select("+verifyCode +verifyCodeExpireOn +isVerified");

        // check if user[phone] exist
        if (!user) {
            return {
                success: false,
                message: 'Invalid Phone Number'
            };
        }
        // Check if OTP exists
        if(!user.verifyCode || !user.verifyCodeExpireOn){
            return {
                success:false,
                message:"No OTP found for this user"
            }
        }
        // Check if OTP has expired
        if (new Date() > user.verifyCodeExpireOn) {
            return {
                success:false,
                message:"Expired OTP"
            }
        }

        // Verify OTP
        if (user.verifyCode === otp) {
            user.isVerified = true;
            // Clear OTP data after successful verification
            user.verifyCode = undefined;
            user.verifyCodeExpireOn = undefined;
            await user.save();
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

        const user = await User.findOne({ phone: phoneNumber }).select("+phone +isVerified +verifyCode +verifyCodeExpireOn");

        // Check if session exists
        if (!user) {
            return {
                success: false,
                message: 'Invalid Phone Number'
            };
        }

        // Generate new OTP
        const newOtp = this.generateOTP();

        // Update expiration (10 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        // Update record
        user.verifyCode = newOtp;
        user.verifyCodeExpireOn = expiresAt;
        user.isVerified = false;

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