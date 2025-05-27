
import { Router } from 'express';
import { z } from 'zod';
import { sendVerificationEmail, verifyEmail, sendPasswordReset, resetPassword } from '../services/auth';

const router = Router();

// Email verification
router.post('/resend-verification', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    await sendVerificationEmail(user.id, user.email);
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.query);
    await verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid verification token' });
  }
});

// Password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await sendPasswordReset(email);
    res.json({ message: 'If an account exists, a reset email has been sent' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid email address' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8)
    }).parse(req.body);

    await resetPassword(token, password);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
});

export default router;
