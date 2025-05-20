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


async function register(req: Request<{}, {}, UserRegisterRequest>, res: Response) {
    if (!req.body.nationalId || !req.body.phone || !req.body.governorate) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Missing required fields'
        });
        return;
    }

    const identityManager = new IdentityManager(caURL, fabricCaTlsCertPath);
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

        res.status(StatusCodes.CREATED).json({
            message: 'User registered successfully',
            userId,
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
export {
    register as userRegister, sendOtp as sendSmsOtp,
    resendOtp as resendSmsOtp, verifyOtp as verifySmsOtp
}