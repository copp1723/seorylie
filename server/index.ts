import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { log, setupVite, serveStatic } from "./vite.js";
import { setupRoutes } from "./routes.js";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Setup routes
setupRoutes(app);

// Setup Vite in development or serve static files in production
if (process.env.NODE_ENV === "production") {
  serveStatic(app);
} else {
  await setupVite(app, server);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
