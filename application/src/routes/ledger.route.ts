import { Router } from "express";
import { getWorldState, initLedger } from "../controller/ledger.controller";


const router = Router()

router.post('/init', initLedger)
router.get('/state', getWorldState)

export {
    router as ledgerRouter
}