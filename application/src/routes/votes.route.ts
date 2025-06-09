import { Router } from "express";
import { 
    getUserVote, 
    getAllVotes, 
    userVote, 
    getUserVotes, 
    verifyVote, 
    submitVoterFeedback, 
    getVoteDetailsByReceipt, 
    checkUserVotedInElection 
} from "../controller/vote.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router()

// Protected voting routes
router.route("/")
    .post(authenticate, userVote)
    .get(authenticate, authorize([UserRole.ElectionCommission, UserRole.Auditor]), getAllVotes)

// Feedback submission route
router.post("/feedback", authenticate, submitVoterFeedback);

// Vote verification route - public API that can be used without authentication
router.get("/verify/:receipt", verifyVote);

// Authenticated route for detailed vote information
router.get("/details/:receipt", authenticate, getVoteDetailsByReceipt);

// Check if a user has voted in a specific election
router.get("/check/:userId/:electionId", authenticate, checkUserVotedInElection);

// Analytics route must come before path with parameters to avoid conflicts
router.get("/user/:userId", authenticate, authorize([UserRole.Auditor, UserRole.ElectionCommission]), getUserVotes)
router.get("/:id", authenticate, authorize([UserRole.Auditor, UserRole.ElectionCommission]), getUserVote)


export {
    router as votesRouter
}