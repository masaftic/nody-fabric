import express from 'express';
import { getChaincodeEvents, getVoterActivity, recalculateTally } from '../controller/audits.controller';
import { BlockChainRepository } from '../fabric-utils/BlockChainRepository';
import { authenticate, authorize } from '../middleware/auth.middleware';
import User, { UserRole } from '../models/user.model';

const router = express.Router();


router.get('/voter-activity/:voterId', 
  authenticate, 
  authorize([UserRole.Auditor, UserRole.ElectionCommission]), 
  getVoterActivity
);


router.get('/chaincode-events', 
  authenticate, 
  authorize([UserRole.Auditor, UserRole.ElectionCommission]), 
  getChaincodeEvents
);


router.post('/tally/:election_id', 
  authenticate, 
  authorize([UserRole.Auditor]), 
  recalculateTally
);

export {
    router as auditRouter
}
