import { Router } from "express";
// import { getWorldState, initLedger } from "../controller/ledger.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import { getWorldState } from "../controller/ledger.controller";

const router = Router()

// Only admins can initialize the ledger
// router.post('/init', authenticate, authorize(['admin']), initLedger)
// // Admins and auditors can view the world state
router.get('/state', authenticate, authorize([UserRole.ElectionCommission, UserRole.Auditor]), getWorldState)

export {
    router as ledgerRouter
}