import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { logger } from '../logger';

// TODO: Move this to environment variables in production
const JWT_SECRET = 'your-secret-key-should-be-in-env-variables';
const TOKEN_EXPIRATION = '1d'; // Token expires in 1 day

export interface JwtPayload {
    userId: string;
    role?: 'voter' | 'admin' | 'auditor';
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return decoded;
    } catch (error) {
        logger.error(`Error verifying token: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

/**
 * Extract JWT token from request headers
 */
export function extractTokenFromHeader(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.split(' ')[1];
}
