/**
 * Routes for user management, invitations, and audit logs
 */
import express from "express";
import {
  createUserInvitation,
  acceptUserInvitation,
  getPendingInvitations,
  cancelInvitation,
  getAuditLogs,
} from "../services/user-management";
import { hasDealershipAccess } from "../utils/helpers/permissions";

const router = express.Router();

// Create a user invitation
router.post("/dealerships/:dealershipId/invitations", async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);

    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check if user has permission to invite users
    if (
      req.user.role !== "super_admin" &&
      req.user.role !== "dealership_admin"
    ) {
      return res.status(403).json({ error: "Only admins can invite users" });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    // Validate role
    const validRoles = ["dealership_admin", "manager", "user"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Prevent non-super-admins from creating dealership_admin users
    if (role === "dealership_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        error: "Only super admins can create dealership admin accounts",
      });
    }

    const invitation = await createUserInvitation({
      email,
      role,
      dealershipId,
      invitedBy: req.user.id,
    });

    res.status(201).json({ invitation });
  } catch (error) {
    console.error("Error creating invitation:", error);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// Accept a user invitation
router.post("/invitations/accept", async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      return res
        .status(400)
        .json({ error: "Token, name, and password are required" });
    }

    // Password validation
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const user = await acceptUserInvitation(token, { name, password });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dealership_id: user.dealership_id,
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);

    if (error.message === "Invalid or expired invitation") {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// Get pending invitations for a dealership
router.get("/dealerships/:dealershipId/invitations", async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);

    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const invitations = await getPendingInvitations(dealershipId);

    res.json({ invitations });
  } catch (error) {
    console.error("Error getting invitations:", error);
    res.status(500).json({ error: "Failed to get invitations" });
  }
});

// Cancel an invitation
router.delete(
  "/dealerships/:dealershipId/invitations/:invitationId",
  async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const invitationId = parseInt(req.params.invitationId);

      // Check permissions
      if (!hasDealershipAccess(req.user, dealershipId)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Check if user has permission to cancel invitations
      if (
        req.user.role !== "super_admin" &&
        req.user.role !== "dealership_admin"
      ) {
        return res
          .status(403)
          .json({ error: "Only admins can cancel invitations" });
      }

      await cancelInvitation(invitationId, req.user.id);

      res.json({ success: true });
    } catch (error) {
      console.error("Error canceling invitation:", error);
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  },
);

// Get audit logs for a dealership
router.get("/dealerships/:dealershipId/audit-logs", async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);

    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check if user has permission to view audit logs
    if (
      req.user.role !== "super_admin" &&
      req.user.role !== "dealership_admin"
    ) {
      return res.status(403).json({ error: "Only admins can view audit logs" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const logs = await getAuditLogs(dealershipId, limit);

    res.json({ logs });
  } catch (error) {
    console.error("Error getting audit logs:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

export default router;
