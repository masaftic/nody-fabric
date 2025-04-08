import {Router} from "express";
import {userRegister} from "../controller/user.controller";

const router = Router()

router.post('/register', userRegister)

export {router as userRouter}