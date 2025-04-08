import {Router} from "express";
import {sendSmsOtp, userRegister} from "../controller/user.controller";

const router = Router()

router.post('/register', userRegister)
router.post("/send-sms",sendSmsOtp)

export {router as userRouter}