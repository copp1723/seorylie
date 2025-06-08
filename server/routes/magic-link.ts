import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { sendInvitation } from "../services/magic-link-auth";
import { logger } from "../logger";

const router = Router();

/**
 * Request a magic link for an email address
 * This endpoint generates and sends a magic link for authentication
 */
router.post(
  "/request",
  [
    body("email").isEmail().notEmpty().withMessage("Valid email is required"),
    body("baseUrl").isString().notEmpty().withMessage("Base URL is required"),
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, baseUrl } = req.body;
    const user = req.session?.user;

    try {
      // Prepare invitation options
      const inviteOptions: {
        invitedBy?: string;
        dealershipId?: number;
        role?: string;
        expirationHours?: number;
      } = {};

      // If this is sent by an authenticated user (admin sending invite)
      if (user) {
        inviteOptions.invitedBy = user.id;
        inviteOptions.dealershipId = user.dealershipId || undefined;

        // Only admins can set custom roles
        if (req.body.role && user.role === "admin") {
          inviteOptions.role = req.body.role;
        }
      }

      // Custom expiration if provided and valid
      if (
        req.body.expirationHours &&
        !isNaN(parseInt(req.body.expirationHours))
      ) {
        inviteOptions.expirationHours = parseInt(req.body.expirationHours);
      }

      // Send the invitation
      const result = await sendInvitation(email, baseUrl, inviteOptions);

      if (!result.success) {
        logger.error(`Failed to send magic link to ${email}`, {
          error: result.error,
        });

        return res.status(500).json({
          success: false,
          message: result.error || "Failed to send magic link",
        });
      }

      logger.info(
        `Magic link sent to ${email}${user ? " by " + user.email : ""}`,
      );

      return res.status(200).json({
        success: true,
        message: "Magic link sent successfully",
      });
    } catch (error) {
      logger.error("Error sending magic link:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while sending the magic link",
      });
    }
  },
);

/**
 * Invite a new user with a magic link
 * This endpoint is used by admins to invite new users to the platform
 */
router.post(
  "/invite",
  [
    body("email").isEmail().notEmpty().withMessage("Valid email is required"),
    body("baseUrl").isString().notEmpty().withMessage("Base URL is required"),
    body("role").isString().optional(),
    body("dealershipId").isNumeric().optional(),
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, baseUrl, role, dealershipId } = req.body;
    const user = req.session?.user;

    // Check if user is admin
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can send invitations",
      });
    }

    try {
      // Prepare invitation options
      const inviteOptions = {
        invitedBy: user.id,
        dealershipId: dealershipId || user.dealershipId,
        role: role || "user",
      };

      // Send the invitation
      const result = await sendInvitation(email, baseUrl, inviteOptions);

      if (!result.success) {
        logger.error(`Failed to send invitation to ${email}`, {
          error: result.error,
        });

        return res.status(500).json({
          success: false,
          message: result.error || "Failed to send invitation",
        });
      }

      logger.info(`User invitation sent to ${email} by ${user.email}`);

      return res.status(200).json({
        success: true,
        message: "Invitation sent successfully",
      });
    } catch (error) {
      logger.error("Error sending invitation:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while sending the invitation",
      });
    }
  },
);

export default router;
