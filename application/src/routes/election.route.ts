import {Router} from "express";
import {
    getElection, 
    getAllElections, 
    // getElectionAnalytics, 
    createElection, 
    getActiveElections
} from "../controller/election.controller";


const router = Router();

// Individual election routes
router.get("/:electionId", getElection);
// router.get("/:electionId/analytics", getElectionAnalytics);

// General election routes
router.get("/", getAllElections);
router.post("/", createElection);
router.get("/active", getActiveElections);

export {
    router as electionRouter
}