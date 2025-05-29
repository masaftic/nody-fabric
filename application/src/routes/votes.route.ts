import { Router } from "express";
import { getUserVote, getAllVotes, userVote, getUserVotes, getVoteTally } from "../controller/vote.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router()

// Protected voting routes
router.route("/")
    .post(authenticate, userVote)
    .get(authenticate, authorize([UserRole.ElectionCommission, UserRole.Auditor]), getAllVotes)

// Analytics route must come before path with parameters to avoid conflicts
router.get("/user/:userId", authenticate, authorize([UserRole.Auditor, UserRole.ElectionCommission]), getUserVotes)
router.get("/:id", authenticate, authorize([UserRole.Auditor, UserRole.ElectionCommission]), getUserVote)


export {
    router as votesRouter
}