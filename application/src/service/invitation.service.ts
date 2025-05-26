import { logger } from '../logger';
import InvitationCodeModel, { IInvitationCode } from '../models/invitation.model';
import crypto from 'crypto';
import { UserRole } from '../models/user.model';

/**
 * Service to handle invitation code operations
 */
export class InvitationService {
  /**
   * Generate a new invitation code
   * @param role The role for which the invitation code is being generated
   * @param expirationDays Number of days until the code expires (optional)
   * @returns The generated invitation code
   */
  async generateInvitationCode(
    role: UserRole,
    expirationDays?: number
  ): Promise<IInvitationCode> {
    try {
      // Generate a random code (8 characters alphanumeric)
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      // Create expiration date if provided
      const expiresAt = expirationDays 
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) 
        : undefined;

      // Create the invitation code in the database
      const invitationCode = await InvitationCodeModel.create({
        code,
        role,
        isUsed: false,
        expiresAt
      });

      logger.info(`Generated invitation code ${code} for role ${role}`);
      return invitationCode;
    } catch (error) {
      logger.error(`Error generating invitation code: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Validate and mark an invitation code as used
   * @param code The invitation code to validate
   * @param userId The user ID using the code
   * @returns The role associated with the code if valid, null otherwise
   */
  async validateAndUseCode(code: string, userId: string): Promise<UserRole | null> {
    try {
      // Find the invitation code
      const invitationCode = await InvitationCodeModel.findOne({ code });

      // Check if the code exists
      if (!invitationCode) {
        logger.warn(`Invalid invitation code attempt: ${code}`);
        return null;
      }

      // Check if the code is already used
      if (invitationCode.isUsed) {
        logger.warn(`Attempt to use already used invitation code: ${code}`);
        return null;
      }

      // Check if the code is expired
      if (invitationCode.expiresAt && invitationCode.expiresAt < new Date()) {
        logger.warn(`Attempt to use expired invitation code: ${code}`);
        return null;
      }

      // Mark the code as used
      invitationCode.isUsed = true;
      invitationCode.usedBy = userId;
      invitationCode.usedAt = new Date();
      await invitationCode.save();

      logger.info(`Invitation code ${code} used by user ${userId}`);
      return invitationCode.role;
    } catch (error) {
      logger.error(`Error validating invitation code: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List all invitation codes
   * @param filter Optional filter criteria
   * @returns List of invitation codes
   */
  async listInvitationCodes(filter: Partial<IInvitationCode> = {}): Promise<IInvitationCode[]> {
    try {
      return await InvitationCodeModel.find(filter as import('mongoose').FilterQuery<IInvitationCode>);
    } catch (error) {
      logger.error(`Error listing invitation codes: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Create a singleton instance
export const invitationService = new InvitationService();
