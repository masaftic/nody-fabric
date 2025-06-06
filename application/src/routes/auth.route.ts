import { NextFunction, Router, Request, Response } from "express";
import { login, resendSmsOtp, sendSmsOtp, userRegister, verifySmsOtp } from "../controller/auth.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";


const router = Router()

router.post('/register', userRegister)
router.post('/login', login)
router.post("/send-otp", sendSmsOtp)
router.post("/resend-otp", resendSmsOtp)
router.post("/verify-otp", verifySmsOtp)

// Protected route example
router.get('/profile', authenticate, (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Profile retrieved successfully',
        userId: req.user?.user_id,
        role: req.user?.role
    });
});

// Role-based authorization examples
router.get('/admin-dashboard', authenticate, authorize([UserRole.ElectionCommission]), (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Admin dashboard accessed successfully'
    });
});

router.get('/auditor-dashboard', authenticate, authorize([UserRole.Auditor]), (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Auditor dashboard accessed successfully'
    });
});

router.get('/voter-info', authenticate, authorize([UserRole.Voter, UserRole.ElectionCommission]), (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Voter information accessed successfully',
        userId: req.user?.user_id
    });
});

export { router as authRouter }