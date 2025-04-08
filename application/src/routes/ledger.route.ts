import {Router} from "express";
import {deleteLedger, voteCast,initLedger} from "../controller/ledger.controller";


const router = Router()

router.route('/').get(voteCast).delete(deleteLedger).post(initLedger)

export {
    router as ledgerRouter
}