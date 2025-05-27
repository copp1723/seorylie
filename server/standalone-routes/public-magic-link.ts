import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { verifyMagicLinkToken } from '../services/magic-link-auth';
import logger from '../utils/logger';

export const publicMagicLinkRouter = Router();

/**
 * Verify a magic link token
 * This endpoint checks if a magic link token is valid without requiring authentication
 */
publicMagicLinkRouter.get(
  '/verify',
  [
    query('token').isString().notEmpty().withMessage('Valid token is required'),
    query('email').isEmail().notEmpty().withMessage('Valid email is required'),
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, email } = req.query as { token: string, email: string };
    
    try {
      // Verify the token
      const result = await verifyMagicLinkToken(email, token);
      
      if (!result.success) {
        logger.warn(`Invalid magic link attempt for ${email}`, {
          reason: result.error,
        });
        
        return res.status(400).json({
          success: false,
          message: result.error || 'Invalid or expired magic link',
        });
      }
      
      logger.info(`Magic link verified successfully for ${email}`);
      
      // Return success with any user data needed for the frontend
      return res.status(200).json({
        success: true,
        message: 'Magic link verification successful',
        userId: result.userId,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      logger.error('Error verifying magic link:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while verifying the magic link',
      });
    }
  }
);