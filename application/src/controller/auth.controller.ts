import { Request, Response } from "express";
import { IdentityManager } from "../fabric-utils/identityManager";
import { caURL, fabricCaTlsCertPath } from "../fabric-utils/config";
import { StatusCodes } from "http-status-codes";
import { twilioService } from "../service/twilio.service";
import verifyPhoneNumber from "../utils/verifyPhoneNumber";
import BadRequestError from "../errors/BadRequest.error";
import { userService } from '../service/user.service';
import UserModel, { UserRegisterRequest, UserRole } from '../models/user.model';
import { fabricAdminConnection, fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { generateToken } from '../utils/jwt.utils';
import crypto from 'crypto';
import { invitationService } from "../service/invitation.service";
import { Governorates } from "../models/election.model";


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
    const { phoneNumber } = req.body;
    if (!phoneNumber || !verifyPhoneNumber(phoneNumber))
        throw new BadRequestError("InValid Phone Number");
    const twilioResponse: {
        success: boolean;
        expiresAt?: Date;
        message: string
    } = await twilioService.createAndSendOTP(phoneNumber)
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

const resendOtp = async (req: Request, res: Response) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber || !verifyPhoneNumber(phoneNumber))
        throw new BadRequestError("InValid Phone Number");
    const twilioResponse: {
        success: boolean;
        expiresAt?: Date;
        message: string
    } = await twilioService.resendOTP(phoneNumber)
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
    const { phoneNumber, otp } = req.body;
    if (!otp || !phoneNumber || !verifyPhoneNumber(phoneNumber))
        throw new BadRequestError("Missing input fields");
    const twilioResponse: {
        success: boolean;
        message: string
    } = await twilioService.verifyOTP(phoneNumber, otp)
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


export async function login(req: Request, res: Response) {
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
    resendOtp as resendSmsOtp, verifyOtp as verifySmsOtp
}