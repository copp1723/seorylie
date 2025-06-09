import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import logger from "../utils/logger";
import { webSocketServer } from "../websocket";

const router = Router();

router.post("/task-complete", (req: Request, res: Response) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  try {
    jwt.verify(token, process.env.INTERNAL_JWT_SECRET || "dev-jwt-secret");
  } catch (err) {
    logger.warn("Unauthorized vendor callback", err);
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { request_id } = req.body;
  if (!request_id) {
    return res.status(400).json({ error: "Missing request_id" });
  }

  const connectionId = webSocketServer.getPendingConnection(request_id);
  if (connectionId) {
    webSocketServer.notifyTaskComplete(connectionId, request_id);
  }

  res.json({ success: true });
});

export default router;
