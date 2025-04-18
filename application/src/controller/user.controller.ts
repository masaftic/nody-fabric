import {Request, Response} from "express";
import {IdentityManager} from "../fabric-utils/identityManager";
import {caURL, fabricCaTlsCertPath} from "../fabric-utils/config";
import {StatusCodes} from "http-status-codes";
import {twilioService} from "../service/twilio.service";
import verifyPhoneNumber from "../utils/verifyPhoneNumber";
import BadRequestError from "../errors/BadRequest.error";


const register =  async (req: Request, res: Response) => {
    const identityManager = new IdentityManager(caURL, fabricCaTlsCertPath);

    const admin = await identityManager.enrollAdmin();
    const secret = await identityManager.registerUser(admin, req.body.userId, req.body.affiliation, req.body.role)

    const userEnrollment = await identityManager.enrollUser(req.body.userId, secret);

    res.status(StatusCodes.CREATED).json({
        message: 'User registered successfully',
        certificate: userEnrollment.certificate,
        key: userEnrollment.key.toBytes(),
    });
}

const sendOtp = async (req : Request, res:Response) => {
    const {phoneNumber} = req.body;
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

const resendOtp = async (req : Request, res:Response) => {
    const {phoneNumber} = req.body;
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
const verifyOtp = async (req : Request, res:Response) => {
    const {phoneNumber, otp} = req.body;
    if (!otp || !phoneNumber || !verifyPhoneNumber(phoneNumber))
        throw new BadRequestError("Missing input fields");
    const twilioResponse: {
        success: boolean;
        message: string
    } = await twilioService.verifyOTP(phoneNumber,otp)
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
export {register as userRegister, sendOtp as sendSmsOtp,
    resendOtp as resendSmsOtp, verifyOtp as verifySmsOtp}