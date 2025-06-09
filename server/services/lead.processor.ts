import { eq, sql } from "drizzle-orm";
import db from "../db";
import { conversations, messages, personas, leads } from "../../shared/index";
import logger from "../utils/logger";
import { generateResponse } from "./ai-service";
import { handoffService } from "./handoff-service";

export async function processLead(leadId: number): Promise<void> {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead not found");

  let convo = await db.query.conversations.findFirst({
    where: eq(conversations.leadId, lead.id),
  });
  if (!convo) {
    const result = await db
      .insert(conversations)
      .values({
        dealershipId: lead.dealershipId,
        leadId: lead.id,
        customerId: lead.customerId,
        messageCount: 0,
      })
      .returning({ id: conversations.id });
    convo = {
      id: result[0].id,
      dealershipId: lead.dealershipId,
      leadId: lead.id,
      customerId: lead.customerId,
      assignedAgentId: null,
      channel: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: 0,
      status: "open",
      subject: null,
      userId: null,
    } as any;
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(messages.createdAt);
  const persona = lead.aiPersonaId
    ? await db.query.personas.findFirst({
        where: eq(personas.id, lead.aiPersonaId),
      })
    : null;
  const prompt = persona?.systemPrompt || "You are a helpful sales assistant.";
  const userMessage = history.length
    ? history[history.length - 1].content
    : "Hello";

  const aiReply = await generateResponse(`${prompt}\nCustomer: ${userMessage}`);

  await db
    .insert(messages)
    .values({
      conversationId: convo.id,
      sender: "AI",
      senderType: "ai",
      content: aiReply,
    });
  await db
    .update(conversations)
    .set({
      messageCount: sql`${conversations.messageCount} + 1`,
      lastMessageAt: new Date(),
    })
    .where(eq(conversations.id, convo.id));
  await db
    .update(leads)
    .set({ status: "responded" })
    .where(eq(leads.id, lead.id));

  if (await handoffService.shouldHandoff(convo.id)) {
    await handoffService.executeHandoff(convo.id);
  }

  logger.info("Lead processed via AI", { leadId, conversationId: convo.id });
}
