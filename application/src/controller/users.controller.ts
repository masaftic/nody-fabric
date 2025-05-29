import { Request, Response } from "express";
import { IdentityManager } from "../fabric-utils/identityManager";
import { StatusCodes } from "http-status-codes";
import { userService } from '../service/user.service';
import { withFabricAdminConnection, withFabricConnection } from "../fabric-utils/fabric";
import crypto from 'crypto';
import { UserRepository } from "../fabric-utils/repositories";
import { logger } from "../logger";
import { UserRole } from "../models/user.model";


/**
 * Get user by ID
 * Authorized roles: election_commission, auditor
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.params;

    try {
        const user = await userService.getUserById(user_id);

        if (!user) {
            res.status(StatusCodes.NOT_FOUND).json({
                message: 'User not found'
            });
            return;
        }

        res.status(StatusCodes.OK).json({
            user_id: user.userId,
            governorate: user.governorate,
            status: user.status,
            role: user.role,
            registration_date: user.createdAt
        });
    } catch (error: any) {
        logger.error(`Error retrieving user: ${error.message}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error retrieving user'
        });
    }
};

/**
 * Get user certificate
 * Authorized roles: election_commission, auditor
 */
export const getUserCertificate = async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.params;

    try {
        const user = await userService.getUserById(user_id);

        if (!user) {
            res.status(StatusCodes.NOT_FOUND).json({
                message: 'User not found'
            });
            return;
        }

        res.status(StatusCodes.OK).json({
            certificate: user.certificate,
        });
    } catch (error: any) {
        logger.error(`Error retrieving user certificate: ${error.message}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error retrieving user certificate'
        });
    }
};

/**
 * Get all users with optional filters
 * Authorized roles: election_commission, auditor
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
    const { status, governorate, role } = req.query;

    // Validate query parameters
    if (status && !['active', 'suspended'].includes(status as string)) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Invalid status filter. Allowed values are "active" or "suspended".'
        });
        return;
    }

    if (governorate && typeof governorate !== 'string') {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Invalid governorate filter. Must be a string.'
        });
        return;
    }

    if (role && !Object.values(UserRole).includes(role as UserRole)) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Invalid role filter. Allowed values are "voter", "election_commission", or "auditor".'
        });
        return;
    }

    try {
        const users = await userService.getUsers({
            status: status as string,
            governorate: governorate as string,
            role: role as string
        });

        const formattedUsers = users.map(user => ({
            user_id: user.userId,
            governorate: user.governorate,
            status: user.status,
            role: user.role,
            registration_date: user.createdAt.toISOString()
        }));

        res.status(StatusCodes.OK).json(formattedUsers);
    } catch (error: any) {
        logger.error(`Error retrieving users: ${error.message}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error retrieving users'
        });
    }
};

/**
 * Revoke user access
 * Authorized roles: election_commission, auditor
 */
export const revokeUser = async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.params;
    const { reason } = req.body || {};

    if (!reason) {
        res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Reason is required for revocation'
        });
        return;
    }

    try {
        // 1. Update the user status in our database
        const user = await userService.updateUserStatus(user_id, 'suspended');

        if (!user) {
            res.status(StatusCodes.NOT_FOUND).json({
                message: 'User not found'
            });
            return;
        }

        // 2. Update the blockchain record
        await withFabricConnection(req.user!.user_id, async (contract) => {
            const userRepo = new UserRepository(contract);
            await userRepo.updateUserStatus(user_id, 'suspended', reason);
        });

        // 3. Revoke the user's certificate in the CA
        try {
            const identityManager = new IdentityManager();
            const admin = await identityManager.enrollAdmin();

            await identityManager.revokeUserCertificate(
                admin,
                user_id,
                reason
            );

            logger.info(`Certificate for user ${user_id} revoked successfully`);
        } catch (certError: any) {
            // Log error but continue - the user is already suspended in the database and blockchain
            logger.error(`Error revoking certificate: ${certError.message}`);
        }

        res.status(StatusCodes.OK).json({
            status: 'success',
            message: 'User revoked successfully'
        });
    } catch (error: any) {
        logger.error(`Error revoking user: ${error.message}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error revoking user'
        });
    }
};

/**
 * Get user revocations history
 * Authorized roles: election_commission, auditor
 */
export const getUserRevocations = async (req: Request, res: Response) => {
    try {
        // Get revocation records from blockchain
        const revocations = await withFabricConnection(req.user!.user_id, async (contract) => {
            const userRepo = new UserRepository(contract);
            return await userRepo.getUserRevocations();
        });

        // Format the response

        // Additionally, get the CA certificate revocation list
        try {
            const identityManager = new IdentityManager();
            const admin = await identityManager.enrollAdmin();

            // This is mostly for informational purposes - we wouldn't normally include this in the API response
            // But it shows that we're also tracking revocations in the CA itself
            const crl = await identityManager.getCertificateRevocationList(admin);
            logger.debug(`Certificate Revocation List retrieved: ${crl.substring(0, 100)}...`);
        } catch (certError: any) {
            logger.error(`Error retrieving CRL: ${certError.message}`);
        }

        res.status(StatusCodes.OK).json(revocations);
        return;
    } catch (error: any) {
        logger.error(`Error retrieving user revocations: ${error.message}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error retrieving user revocations'
        });
        return;
    }
};
