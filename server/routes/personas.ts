import { Router } from "express";
import { body, param } from "express-validator";
import db from "../db";
import { personas } from "../../shared/index";
import { eq } from "drizzle-orm";
import { authenticationMiddleware } from "../middleware/authentication";

const router = Router();
router.use(authenticationMiddleware);

router.post(
  "/api/v1/customers/:customerId/personas",
  body("name").isString(),
  body("promptTemplate").isString(),
  async (req, res) => {
    const { customerId } = req.params;
    const { name, promptTemplate, description } = req.body;
    const result = await db
      .insert(personas)
      .values({
        name,
        promptTemplate,
        description: description || null,
        dealershipId: parseInt(customerId, 10),
      })
      .returning({ id: personas.id });
    res.json({ id: result[0].id });
  },
);

router.get("/api/v1/customers/:customerId/personas", async (req, res) => {
  const { customerId } = req.params;
  const items = await db
    .select()
    .from(personas)
    .where(eq(personas.dealershipId, parseInt(customerId, 10)));
  res.json({ personas: items });
});

router.patch("/api/v1/personas/:personaId", async (req, res) => {
  const { personaId } = req.params;
  const update = req.body;
  await db
    .update(personas)
    .set(update)
    .where(eq(personas.id, parseInt(personaId, 10)));
  res.json({ success: true });
});

router.delete("/api/v1/personas/:personaId", async (req, res) => {
  const { personaId } = req.params;
  await db.delete(personas).where(eq(personas.id, parseInt(personaId, 10)));
  res.json({ success: true });
});

export default router;
