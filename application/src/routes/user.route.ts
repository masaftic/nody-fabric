import {Router} from "express";
import {resendSmsOtp, sendSmsOtp, userRegister, verifySmsOtp} from "../controller/user.controller";

const router = Router()

router.post('/register', userRegister)
router.post("/send-otp",sendSmsOtp)
router.post("/resend-otp",resendSmsOtp)
router.post("/verify-otp",verifySmsOtp)
export {router as userRouter}