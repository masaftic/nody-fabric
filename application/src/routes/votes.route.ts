import {Router} from "express";
import {getUserVote,getAllVotes, userVote} from "../controller/vote.controller";


const router = Router()

router.route("/vote").post(userVote).get(getAllVotes)
router.get("/vote/:id", getUserVote)


export {
    router as votesRouter
}