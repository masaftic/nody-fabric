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


async function register(req: Request<{}, {}, UserRegisterRequest>, res: Response) {
    if (!req.body.national_id || !req.body.phone || !req.body.governorate) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing required fields'
        });
        return;
    }

    const identityManager = new IdentityManager();
    const user_id = crypto.randomUUID(); // voterId

    try {
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

        const admin = await identityManager.enrollAdmin();
        const secret = await identityManager.registerUser(admin, user_id, '', role);

        const userEnrollment = await identityManager.enrollUser(user_id, secret);

        // Save user details in MongoDB
        const userData = new UserModel({
            userId: user_id,
            nationalId: req.body.national_id,
            phone: req.body.phone,
            governorate: req.body.governorate,
            certificate: userEnrollment.certificate,
            role: role,
            status: 'active',
        });

        await userService.saveUser(userData);

        await withFabricAdminConnection(async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            await blockchainRepo.registerUser(user_id, req.body.governorate);
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

    const { phoneNumber } = req.body;
    if (!phoneNumber || !verifyPhoneNumber(phoneNumber))
        throw new BadRequestError("InValid Phone Number");

    // Since phone numbers are hashed in the database, we need to check each user
    const users = await UserModel.find({});
    let matchedUser = null;

    // Find the user whose hashed phone matches the provided phone
    for (const user of users) {
        const isMatch = await user.comparePhoneNumber(phoneNumber);
        if (isMatch) {
            matchedUser = user;
            break;
        }
    }

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