import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth-service';
import { CustomError } from '../utils/error-handler';
import logger from '../utils/logger';

const router = Router();

// Email verification
router.post('/resend-verification', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Generate a magic link for email verification
    const token = await authService.instance.generateMagicLink({
      email: user.email,
      redirectUrl: `${process.env.CLIENT_URL}/verify-email`,
      expiresIn: 24 * 60 * 60 // 24 hours
    });

    // In a real implementation, you would send an email with the verification link
    logger.info('Verification email would be sent', { userId: user.id, email: user.email });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error('Failed to send verification email', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      user: req.user
    });
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.query);
    
    // Authenticate with the magic link token
    await authService.instance.authenticateWithMagicLink(token);
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Invalid verification token', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      token: req.query.token
    });
    res.status(400).json({ message: 'Invalid verification token' });
  }
});

// Password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    
    // Check if user exists (without revealing if they do or not)
    try {
      // Generate a magic link that can be used for password reset
      await authService.instance.generateMagicLink({
        email,
        redirectUrl: `${process.env.CLIENT_URL}/reset-password`,
        expiresIn: 1 * 60 * 60 // 1 hour
      });
      
      // In a real implementation, you would send an email with the reset link
      logger.info('Password reset email would be sent', { email });
    } catch (error) {
      // Don't reveal if the email exists or not
      logger.info('Password reset requested for non-existent email', { email });
    }
    
    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists, a reset email has been sent' });
  } catch (error) {
    logger.error('Invalid email address for password reset', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body?.email
    });
    res.status(400).json({ message: 'Invalid email address' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8)
    }).parse(req.body);

    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Verify the magic link token
    // 2. Get the user ID from the token
    // 3. Update the user's password
    // 4. Invalidate all sessions except the current one
    
    logger.info('Password reset functionality not fully implemented');
    res.status(501).json({ message: 'Password reset functionality not fully implemented' });
    
    /* 
    // Implementation would look something like this:
    const { user } = await authService.instance.authenticateWithMagicLink(token);
    
    // Update password logic would go here
    // await authService.instance.updatePassword(user.id, password);
    
    res.json({ message: 'Password reset successfully' });
    */
  } catch (error) {
    logger.error('Invalid or expired reset token', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
});

export default router;
