import { Router, Request, Response } from "express";
import { electionRouter } from "./election.route";


const router = Router();

router.get("/", (req: Request, res: Response) => {
    res.send("Muhammmed on da code");
});

// Register election routes
// router.use("/elections", electionRouter);

export { router as mainRouter }