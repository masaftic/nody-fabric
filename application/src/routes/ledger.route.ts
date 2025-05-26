import { Router } from "express";
// import { getWorldState, initLedger } from "../controller/ledger.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router()

// Only admins can initialize the ledger
// router.post('/init', authenticate, authorize(['admin']), initLedger)
// // Admins and auditors can view the world state
// router.get('/state', authenticate, authorize(['admin', 'auditor']), getWorldState)

export {
    router as ledgerRouter
}