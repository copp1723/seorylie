import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/simpleAuth';
import { supabaseAdmin } from '../config/supabase';
import { sendOnboardingEmails } from '../services/emailService';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all users for the agency
router.get('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { search, role, status } = req.query;
    const user = (req as any).user;

    // Build query
    let query = supabaseAdmin
      .from('users')
      .select(`
        *,
        dealerships (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // Format response
    const formattedUsers = users?.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.email.split('@')[0],
      role: user.role || 'viewer',
      status: user.status || 'active',
      dealership_id: user.dealership_id,
      dealership_name: user.dealerships?.name || 'No Dealership',
      created_at: user.created_at,
      last_login: user.last_login,
      permissions: user.permissions || []
    })) || [];

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users'
    });
  }
});

// Create new user
router.post('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { email, full_name, role, dealership_id, send_invite } = req.body;
    const user = (req as any).user;

    // Validate input
    if (!email || !role || !dealership_id) {
      return res.status(400).json({
        error: 'Email, role, and dealership are required'
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        id: uuidv4(),
        email,
        full_name: full_name || email.split('@')[0],
        role,
        dealership_id,
        status: 'pending',
        password_hash: hashedPassword,
        created_by: user.id,
        permissions: getDefaultPermissions(role)
      })
      .select()
      .single();

    if (createError) throw createError;

    // Send invitation email if requested
    if (send_invite) {
      await sendUserInvitationEmail({
        email,
        full_name: full_name || email.split('@')[0],
        temp_password: tempPassword,
        login_url: `${process.env.CLIENT_URL}/login`
      });
    }

    res.json({
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      status: newUser.status,
      dealership_id: newUser.dealership_id
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Failed to create user'
    });
  }
});

// Update user
router.put('/users/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const user = (req as any).user;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.email;
    delete updates.created_at;
    delete updates.password_hash;

    // Update permissions based on role if role changed
    if (updates.role) {
      updates.permissions = getDefaultPermissions(updates.role);
    }

    // Update user
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Failed to update user'
    });
  }
});

// Delete user
router.delete('/users/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = (req as any).user;

    // Don't allow users to delete themselves
    if (userId === user.id) {
      return res.status(400).json({
        error: 'You cannot delete your own account'
      });
    }

    // Soft delete by setting status to 'deleted'
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user'
    });
  }
});

// Reset user password
router.post('/users/:userId/reset-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get user email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 24); // 24 hour expiry

    // Store reset token
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetExpiry.toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send reset email
    await sendPasswordResetEmail({
      email: user.email,
      full_name: user.full_name,
      reset_url: `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Failed to reset password'
    });
  }
});

// Helper function to get default permissions based on role
function getDefaultPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    admin: [
      'users.create',
      'users.read',
      'users.update',
      'users.delete',
      'tasks.create',
      'tasks.read',
      'tasks.update',
      'tasks.delete',
      'deliverables.read',
      'deliverables.update',
      'analytics.read',
      'settings.update'
    ],
    manager: [
      'tasks.create',
      'tasks.read',
      'tasks.update',
      'deliverables.read',
      'analytics.read'
    ],
    viewer: [
      'tasks.read',
      'deliverables.read'
    ],
    seowerks: [
      'tasks.read',
      'tasks.update',
      'deliverables.create',
      'deliverables.update'
    ]
  };

  return permissions[role] || permissions.viewer;
}

// Send user invitation email
async function sendUserInvitationEmail(data: {
  email: string;
  full_name: string;
  temp_password: string;
  login_url: string;
}) {
  // Use the existing email service
  const emailHtml = `
    <h1>Welcome to RylieSEO!</h1>
    <p>Hi ${data.full_name},</p>
    <p>You've been invited to join RylieSEO. Here are your login credentials:</p>
    <p><strong>Email:</strong> ${data.email}<br>
    <strong>Temporary Password:</strong> ${data.temp_password}</p>
    <p>Please log in and change your password immediately.</p>
    <a href="${data.login_url}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Log In Now</a>
  `;

  // TODO: Use actual email service
  console.log('Sending invitation email to:', data.email);
}

// Send password reset email
async function sendPasswordResetEmail(data: {
  email: string;
  full_name: string;
  reset_url: string;
}) {
  const emailHtml = `
    <h1>Password Reset Request</h1>
    <p>Hi ${data.full_name},</p>
    <p>We received a request to reset your password. Click the link below to create a new password:</p>
    <a href="${data.reset_url}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  // TODO: Use actual email service
  console.log('Sending password reset email to:', data.email);
}

export default router;