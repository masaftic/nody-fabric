import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyToken, extractTokenFromHeader, JwtPayload } from '../utils/jwt.utils';
import { logger } from '../logger';

// Extend Express Request to include user context
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * Authentication middleware to protect routes
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = extractTokenFromHeader(req);

    if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
        return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid or expired token' });
        return;
    }

    // Attach user info to request object
    req.user = decoded;
    next();
}

/**
 * Role-based authorization middleware
 * @param roles Array of allowed roles for the route
 */
export function authorize(roles: ('voter' | 'admin' | 'auditor')[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
            return;
        }

        const userRole = req.user.role || 'voter'; // Default to 'voter' if no role is specified
        if (!roles.includes(userRole)) {
            res.status(StatusCodes.FORBIDDEN).json({ message: 'Insufficient permissions' });
            return;
        }

        next();
    };
}
