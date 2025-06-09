import { handoffService } from "../../server/services/handoff-service";
import db from "../../server/db";
import { conversations } from "../../shared/index";

describe("HandoffService", () => {
  test("shouldHandoff returns true when message count threshold met", async () => {
    const inserted = await db
      .insert(conversations)
      .values({ dealershipId: 1, leadId: 1, customerId: 1, messageCount: 6 })
      .returning({ id: conversations.id });
    const result = await handoffService.shouldHandoff(inserted[0].id);
    expect(result).toBe(true);
    await db.delete(conversations).where(conversations.id.eq(inserted[0].id));
  });
});
