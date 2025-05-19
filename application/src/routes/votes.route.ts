import {Router} from "express";
import {getUserVote, getAllVotes, userVote, getUserVotes} from "../controller/vote.controller";


const router = Router()

router.route("/").post(userVote).get(getAllVotes)
router.get("/:id", getUserVote)
router.get("/user/:userId", getUserVotes)


export {
    router as votesRouter
}