import { Router } from "express";
import {
    getElection,
    getAllElections,
    createElection,
    getVoteTally,
    publishElectionResults
} from "../controller/election.controller";
import { getElectionAnalytics } from "../controller/analytics.controller";

import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.get("/", authenticate, getAllElections);
router.get("/:electionId", authenticate, getElection);

router.post("/", authenticate, authorize([UserRole.ElectionCommission]), createElection);
router.get("/:electionId/analytics", authenticate, authorize([UserRole.ElectionCommission, UserRole.Auditor]), getElectionAnalytics);

router.get("/:electionId/tally", authenticate, getVoteTally);
router.post("/:electionId/publish", authenticate, authorize([UserRole.ElectionCommission]), publishElectionResults);

export {
    router as electionRouter
}