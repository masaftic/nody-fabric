import { Router } from "express";
import {
    getElection,
    getAllElections,
    // getElectionAnalytics, 
    createElection,
    getVoteTally
} from "../controller/election.controller";

import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.get("/", authenticate, getAllElections);
router.get("/:electionId", authenticate, getElection);

router.post("/", authenticate, authorize([UserRole.ElectionCommission]), createElection);
// router.get("/:electionId/analytics", getElectionAnalytics);

router.get("/:electionId/tally", authenticate, authorize([UserRole.ElectionCommission, UserRole.Auditor]), getVoteTally);

export {
    router as electionRouter
}