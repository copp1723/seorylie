import { eq, sql } from 'drizzle-orm';
import db from '../db';
import { conversations, messages, handovers, leads } from '../../shared/index';
import logger from '../utils/logger';
import { sendHandoverEmail } from './email-service';

interface HandoffServiceOptions {
  messageThreshold?: number;
}

export class HandoffService {
  private messageThreshold: number;

  constructor(options: HandoffServiceOptions = {}) {
    this.messageThreshold = options.messageThreshold || parseInt(process.env.HANDOFF_MESSAGE_COUNT || '5', 10);
  }

  async shouldHandoff(conversationId: number): Promise<boolean> {
    const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
    return !!convo && (convo.messageCount || 0) >= this.messageThreshold;
  }

  async executeHandoff(conversationId: number): Promise<void> {
    const convo = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
    if (!convo) return;
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, convo.leadId) });
    const dossier = { conversationId, lead };
    const inserted = await db.insert(handovers).values({
      conversationId,
      leadId: convo.leadId,
      reason: 'auto',
      status: 'pending',
      dossier
    }).returning({ id: handovers.id });

    await sendHandoverEmail(process.env.SALES_TEAM_EMAIL || 'sales@example.com', dossier);

    await db.update(leads).set({ status: 'handed_off' }).where(eq(leads.id, convo.leadId));
    logger.info('Handoff executed', { handoverId: inserted[0].id, conversationId });
  }
}

export const handoffService = new HandoffService();
