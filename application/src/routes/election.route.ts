import {Router} from "express";
import {getElection} from "../controller/election.controller";


const router = Router()

router.get("/electionId",getElection)

export {
    router as electionRouter
}