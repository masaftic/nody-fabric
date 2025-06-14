import { Request, Response } from "express";
import { IdentityManager } from "../fabric-utils/identityManager";
import { caURL, fabricCaTlsCertPath } from "../fabric-utils/config";
import { StatusCodes } from "http-status-codes";
import { twilioService } from "../service/twilio.service";
import verifyPhoneNumber from "../utils/verifyPhoneNumber";
import BadRequestError from "../errors/BadRequest.error";
import { userService } from '../service/user.service';
import { faceVerificationService } from '../service/face-verification.service';
import { otpVerificationService } from '../service/otp-verification.service';
import { authChallengeService } from '../service/auth-challenge.service';
import UserModel, { UserRegisterRequest, UserRole } from '../models/user.model';
import { fabricAdminConnection, fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { generateToken } from '../utils/jwt.utils';
import crypto from 'crypto';
import { invitationService } from "../service/invitation.service";
import { Governorates } from "../models/election.model";
import { logger } from "../logger";



async function register(req: Request<{}, {}, UserRegisterRequest>, res: Response) {
    if (!req.body.national_id || !req.body.phone || !req.body.governorate) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing required fields'
        });
        return;
    }

    if (Governorates.includes(req.body.governorate) === false) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Invalid governorate'
        });
        return;
    }

    // Bypass all verification checks if invitation code is provided
    // if (!req.body.invitation_code) {
    //     // Face verification is required for regular voters
    //     if (!req.body.face_verification_secret) {
    //         res.status(StatusCodes.BAD_REQUEST).json({
    //             message: 'Face verification is required. Please complete ID verification first.'
    //         });
    //         return;
    //     }

    //     // Validate the face verification secret
    //     const isValidFaceSecret = faceVerificationService.validateSecret(req.body.face_verification_secret);
    //     if (!isValidFaceSecret) {
    //         res.status(StatusCodes.UNAUTHORIZED).json({
    //             message: 'Invalid or expired face verification. Please complete ID verification again.'
    //         });
    //         return;
    //     }

    //     // OTP verification is also required for regular voters
    //     if (!req.body.otp_verification_secret) {
    //         res.status(StatusCodes.BAD_REQUEST).json({
    //             message: 'Phone verification is required. Please complete OTP verification first.'
    //         });
    //         return;
    //     }

    //     // Validate the OTP verification secret
    //     const isValidOtpSecret = otpVerificationService.validateSecret(req.body.phone, req.body.otp_verification_secret);
    //     if (!isValidOtpSecret) {
    //         res.status(StatusCodes.UNAUTHORIZED).json({
    //             message: 'Invalid or expired phone verification. Please complete OTP verification again.'
    //         });
    //         return;
    //     }
    // }

    try {
        // Check if national ID is already in use - fast lookup using SHA-256 hashes
        const isNationalIdInUse = await userService.isNationalIdInUse(req.body.national_id);
        if (isNationalIdInUse) {
            res.status(StatusCodes.CONFLICT).json({
                message: 'National ID already registered'
            });
            return;
        }

        // Check if phone number is already in use - fast lookup using SHA-256 hashes
        const isPhoneInUse = await userService.isPhoneNumberInUse(req.body.phone);
        if (isPhoneInUse) {
            res.status(StatusCodes.CONFLICT).json({
                message: 'Phone number already registered'
            });
            return;
        }

        // Create unique ID for the new user
        const user_id = crypto.randomUUID(); // voterId

        // Default role is 'voter'
        let role: UserRole = UserRole.Voter;

        // Check if invitation code is provided
        if (req.body.invitation_code) {
            // Validate the invitation code
            const validatedRole = await invitationService.validateAndUseCode(req.body.invitation_code, user_id);

            if (!validatedRole) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    message: 'Invalid or expired invitation code'
                });
                return;
            }

            // If code is valid, set the role from the invitation code
            role = validatedRole;
        }

        const identityManager = new IdentityManager();
        const admin = await identityManager.enrollAdmin();
        const secret = await identityManager.registerUser(admin, user_id, '', role.toString());

        const userEnrollment = await identityManager.enrollUser(user_id, secret);

        // Save user details in MongoDB - using optimistic approach for better performance
        // The uniqueness of nationalId and phone will be enforced by MongoDB unique constraints
        const userData = new UserModel({
            userId: user_id,
            nationalId: req.body.national_id,
            phone: req.body.phone,
            governorate: req.body.governorate,
            certificate: userEnrollment.certificate,
            role: role,
            status: 'active',
        });

        // try {
        // Directly save to MongoDB - more efficient than going through userService
        await userData.save();
        // } catch (dbError: any) {
        //     // Handle MongoDB duplicate key errors with specific error messages
        //     if (dbError.code === 11000) {
        //         // Extract the duplicate field name from the error message
        //         const field = Object.keys(dbError.keyPattern)[0];
        //         if (field === 'nationalId') {
        //             res.status(StatusCodes.CONFLICT).json({
        //                 message: 'National ID already registered'
        //             });
        //         } else if (field === 'phone') {
        //             res.status(StatusCodes.CONFLICT).json({
        //                 message: 'Phone number already registered'
        //             });
        //         } else {
        //             res.status(StatusCodes.CONFLICT).json({
        //                 message: 'User already exists'
        //             });
        //         }
        //         return;
        //     }
        //     throw dbError; // Re-throw if not a duplicate key error
        // }

        await withFabricAdminConnection(async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            await blockchainRepo.registerUser(user_id, req.body.governorate, role);
        });

        // Generate JWT token
        const access_token = generateToken({
            user_id: user_id,
            role,
            governorate: req.body.governorate,
        });

        res.status(StatusCodes.CREATED).json({
            message: 'User registered successfully',
            user_id,
            access_token,
            certificate: userEnrollment.certificate,
            private_key: userEnrollment.key.toBytes(),
        });
    } catch (error: any) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: `Error registering user: ${error.message}}`
        });
    }
}

const sendOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone || !verifyPhoneNumber(phone))
        throw new BadRequestError("InValid Phone Number");
    const twilioResponse: {
        success: boolean;
        expiresAt?: Date;
        message: string
    } = await twilioService.createAndSendOTP(phone);

    if (!twilioResponse.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: twilioResponse
        });
        return;
    }

    res.status(StatusCodes.OK).json({
        message: twilioResponse.message
    });
}

const resendOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone || !verifyPhoneNumber(phone))
        throw new BadRequestError("InValid Phone Number");

    const twilioResponse: {
        success: boolean;
        expiresAt?: Date;
        message: string
    } = await twilioService.resendOTP(phone);

    if (!twilioResponse.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: twilioResponse
        })
        return
    }
    res.status(StatusCodes.OK).json({
        message: twilioResponse.message
    })
}

const verifyOtp = async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    if (!otp || !phone || !verifyPhoneNumber(phone))
        throw new BadRequestError("Missing input fields");

    const twilioResponse: {
        success: boolean;
        message: string
    } = await twilioService.verifyOTP(phone, otp);

    if (!twilioResponse.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: twilioResponse
        });
        return;
    }

    // Generate OTP verification secret after successful verification
    const verificationSecret = otpVerificationService.generateSecret(phone);

    res.status(StatusCodes.OK).json({
        message: twilioResponse.message,
        otp_verification_secret: verificationSecret
    });
}


/**
 * Get a login challenge for secure authentication
 * Step 1 of challenge-based login
 */
export async function getLoginChallenge(req: Request, res: Response) {
    const { user_id } = req.body;

    if (!user_id) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing user ID'
        });
        return;
    }

    // Make sure the user exists
    const user = await userService.getUserById(user_id);
    if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
            message: 'User not found'
        });
        return;
    }

    // Generate a random challenge for this user
    const challenge = authChallengeService.generateChallenge(user_id);

    res.status(StatusCodes.OK).json({
        message: 'Login challenge generated',
        challenge,
        user_id
    });
}

/**
 * Verify a signed challenge and issue JWT token
 * Step 2 of challenge-based login
 */
export async function verifyChallenge(req: Request, res: Response) {
    const { user_id, challenge, signature } = req.body;

    if (!user_id || !challenge || !signature) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing required fields'
        });
        return;
    }

    // Make sure the user exists
    const user = await userService.getUserById(user_id);
    if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
            message: 'User not found'
        });
        return;
    }

    // Verify that the challenge is valid
    if (!authChallengeService.verifyChallenge(user_id, challenge)) {
        res.status(StatusCodes.UNAUTHORIZED).json({
            message: 'Invalid or expired challenge'
        });
        return;
    }

    try {
        // Get the user's certificate from the database
        const certificate = user.certificate;

        // Create public key from certificate
        const publicKey = crypto.createPublicKey(certificate);

        // Verify the signature
        // First, hash the challenge as we're verifying a signature of the challenge hash
        const challengeBuffer = Buffer.from(challenge, 'hex');
        const hash = crypto.createHash('sha256').update(challengeBuffer).digest();

        const isSignatureValid = crypto.verify(
            'sha256',                                    // Hash algorithm
            hash,                                        // Hash of the challenge
            publicKey,                                   // Public key from certificate
            Buffer.from(signature, 'base64')             // Signature as buffer
        );

        if (isSignatureValid) {
            logger.error(`Signature validation failed for user ${user_id}`);
            res.status(StatusCodes.UNAUTHORIZED).json({
                message: 'Invalid signature'
            });
            return;
        }

        logger.info(`Signature validation successful for user ${user_id}`);

        // Signature is valid, issue JWT token
        const access_token = generateToken({
            user_id: user.userId,
            role: user.role,
            governorate: user.governorate,
        });

        res.status(StatusCodes.OK).json({
            message: 'Login successful',
            access_token,
        });
    } catch (error) {
        console.error('Error verifying signature:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error verifying signature'
        });
    }
}
    
/**
 * Legacy phone-based login (fallback method)
 * @deprecated Use challenge-based login instead
 */
export async function loginWithPhone(req: Request, res: Response) {
    // Temporarily using phone number for login.
    // Instead of a sign challenge with the private key of the user.

    const { phone } = req.body;
    if (!phone || !verifyPhoneNumber(phone))
        throw new BadRequestError("InValid Phone Number");

    // Use the service method to find a user by phone number
    const matchedUser = await userService.findUserByPhone(phone);

    if (!matchedUser) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
    }

    // Generate JWT token
    const access_token = generateToken({
        user_id: matchedUser.userId,
        role: matchedUser.role,
        governorate: matchedUser.governorate,
    });

    res.status(StatusCodes.OK).json({
        message: 'User logged in successfully',
        access_token,
    });
}

export {
    register as userRegister, sendOtp as sendSmsOtp,
    resendOtp as resendSmsOtp, verifyOtp as verifySmsOtp,
    loginWithPhone as login, // Backward compatibility
}

