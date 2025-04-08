import {Router, Request, Response} from "express"

const router = Router()

router.get("/", (req:Request, res:Response) => {
    res.send("Muhammmed on da code")
})

export {router as mainRouter}