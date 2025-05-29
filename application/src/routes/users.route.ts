import { Router } from 'express';
import { getUserById, getUserCertificate, getUsers, revokeUser, getUserRevocations } from '../controller/users.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All routes require specific roles (election_commission or auditor)
const authorizedRoles = [UserRole.ElectionCommission, UserRole.Auditor];

// Get all users with optional filtering
router.get('/', authorize(authorizedRoles), getUsers);

// Get user revocations history
router.get('/revocations', authorize(authorizedRoles), getUserRevocations);

// Get user by ID
router.get('/:user_id', authorize(authorizedRoles), getUserById);

// Get user certificate
router.get('/:user_id/certificate', authorize(authorizedRoles), getUserCertificate);

// Revoke user access
router.post('/:user_id/revoke', authorize(authorizedRoles), revokeUser);

export {
    router as usersRouter
}
