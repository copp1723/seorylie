import { Router } from "express";
import pg from "pg";

const router = Router();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API_KEY = process.env.SEO_WORKS_API_KEY || "CHANGE_ME";

/* POST  /api/seoworks/task */
router.post("/seoworks/task", async (req, res) => {
  if (req.headers["x-api-key"] !== API_KEY)
    return res.status(401).json({ error: "Invalid API key" });

  const { id, task_type, status, completion_notes, payload } = req.body;
  if (!id || !task_type || !status)
    return res.status(400).json({ error: "id, task_type, status required" });

  try {
    await pool.query(
      `INSERT INTO seoworks_tasks
       (id, task_type, status, completion_notes, payload)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id)
       DO UPDATE SET status=$3,
                     completion_notes=$4,
                     payload=$5,
                     updated_at = now()`,
      [id, task_type, status, completion_notes || null, payload || null]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db_error" });
  }
});

/* GET  /api/seoworks/health */
router.get("/seoworks/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;