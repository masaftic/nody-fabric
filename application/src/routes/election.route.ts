import {Router} from "express";
import {
    getElection, 
    getAllElections, 
    // getElectionAnalytics, 
    createElection, 
    getActiveElections
} from "../controller/election.controller";


const router = Router();

// More specific routes first
router.get("/", getAllElections);
router.post("/", createElection);
// Individual election routes
router.get("/:electionId", getElection);
// router.get("/:electionId/analytics", getElectionAnalytics);

export {
    router as electionRouter
}