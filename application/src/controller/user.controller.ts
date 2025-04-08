import {Request, Response} from "express";
import {IdentityManager} from "../fabric-utils/identityManager";
import {caURL, fabricCaTlsCertPath} from "../fabric-utils/config";
import {StatusCodes} from "http-status-codes";


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


export {register as userRegister}