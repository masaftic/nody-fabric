import {Request, Response} from "express";
import {IdentityManager} from "../fabric-utils/identityManager";
import {caURL, fabricCaTlsCertPath} from "../fabric-utils/config";
import {StatusCodes} from "http-status-codes";
import {verifyPhoneNumber} from "../utils/verifyPhoneNumber";
import {twilioService} from "../service/twilio.service";


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

const send = async (req : Request, res:Response) => {
    const {phone} = req.body
    if(!phone || !verifyPhoneNumber(phone))
    {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: "Invalid Phone Number."
        })
        return;
    }

    const process  = await twilioService.createAndSendOTP(phone);
    console.log(process)
    if(! process){
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message:"Failed to send sms otp"
        })
    }
    else{
        res.status(StatusCodes.OK).json({
            message : "Send sms opt successfully"
        })
    }
}


export {
    register as userRegister,
    send as sendSmsOtp
}