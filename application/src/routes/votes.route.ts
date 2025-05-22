import {Router} from "express";
import {getUserVote, getAllVotes, userVote, getUserVotes, getVoteTally} from "../controller/vote.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router()

// Protected voting routes
router.route("/")
    .post(authenticate, userVote)
    .get(authenticate, authorize(['admin', 'auditor']), getAllVotes)

// Analytics route must come before path with parameters to avoid conflicts
router.get("/analytics/:electionId", authenticate, getVoteTally)
router.get("/user/:userId", authenticate, getUserVotes)
router.get("/:id", authenticate, getUserVote)


export {
    router as votesRouter
}