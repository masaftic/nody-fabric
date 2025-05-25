import { Request, Response } from "express";
import { IdentityManager } from "../fabric-utils/identityManager";
import { caURL, fabricCaTlsCertPath } from "../fabric-utils/config";
import { StatusCodes } from "http-status-codes";
import { twilioService } from "../service/twilio.service";
import verifyPhoneNumber from "../utils/verifyPhoneNumber";
import BadRequestError from "../errors/BadRequest.error";
import { userService } from '../service/user.service';
import UserModel, { UserRegisterRequest } from '../models/user.model';
import { fabricAdminConnection, fabricConnection, withFabricAdminConnection } from "../fabric-utils/fabric";
import { BlockChainRepository } from "../fabric-utils/BlockChainRepository";
import { generateToken } from '../utils/jwt.utils';
import crypto from 'crypto';


async function register(req: Request<{}, {}, UserRegisterRequest>, res: Response) {
    if (!req.body.nationalId || !req.body.phone || !req.body.governorate) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing required fields'
        });
        return;
    }

    const identityManager = new IdentityManager();
    const userId = crypto.randomUUID(); // voterId

    try {
        const admin = await identityManager.enrollAdmin();
        const secret = await identityManager.registerUser(admin, userId, '', 'voter');

        const userEnrollment = await identityManager.enrollUser(userId, secret);

        // Save user details in MongoDB
        const userData = new UserModel({
            userId,
            nationalId: req.body.nationalId,
            phone: req.body.phone,
            governorate: req.body.governorate,
            certificate: userEnrollment.certificate,
            role: 'voter',
            status: 'active',
        });

        await userService.saveUser(userData);

        await withFabricAdminConnection(async (contract) => {
            const blockchainRepo = new BlockChainRepository(contract);
            await blockchainRepo.registerUser(userId, req.body.governorate);
        });

        // Generate JWT token
        const token = generateToken({
            userId,
            role: 'voter'
        });

        res.status(StatusCodes.CREATED).json({
            message: 'User registered successfully',
            userId,
            token,
            certificate: userEnrollment.certificate,
            key: userEnrollment.key.toBytes(),
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
    const token = generateToken({
        userId: matchedUser.userId,
        role: matchedUser.role
    });

    res.status(StatusCodes.OK).json({
        message: 'User logged in successfully',
        token,
        governorate: matchedUser.governorate
    });
}

export {
    register as userRegister, sendOtp as sendSmsOtp,
    resendOtp as resendSmsOtp, verifyOtp as verifySmsOtp
}