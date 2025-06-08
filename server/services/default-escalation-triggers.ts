import {
  createEscalationTrigger,
  type TriggerCondition,
} from "./escalation-triggers";
import logger from "../utils/logger";

export interface DefaultTrigger {
  name: string;
  description: string;
  conditions: TriggerCondition[];
}

/**
 * Default escalation triggers for production readiness
 */
export const DEFAULT_ESCALATION_TRIGGERS: DefaultTrigger[] = [
  {
    name: "Customer Requests Human",
    description:
      "Automatically escalate when customer explicitly asks to speak with a human",
    conditions: [
      {
        type: "keyword",
        value: [
          "speak to a person",
          "talk to human",
          "human agent",
          "real person",
          "human representative",
          "speak to someone",
          "talk to agent",
          "human help",
        ],
      },
    ],
  },
  {
    name: "Legal or Compliance Inquiry",
    description: "Escalate legal questions that require human expertise",
    conditions: [
      {
        type: "keyword",
        value: [
          "lawsuit",
          "legal action",
          "attorney",
          "lawyer",
          "sue",
          "court",
          "legal issue",
          "discrimination",
          "harassment",
          "fraud",
          "warranty claim",
        ],
      },
    ],
  },
  {
    name: "Negative Sentiment",
    description: "Escalate when customer sentiment is very negative",
    conditions: [
      {
        type: "sentiment",
        threshold: 0.2, // Very negative sentiment
      },
    ],
  },
  {
    name: "Repeated Questions",
    description: "Escalate when customer asks the same question multiple times",
    conditions: [
      {
        type: "repeated_questions",
        threshold: 3, // 3 or more repeated questions
      },
    ],
  },
  {
    name: "Angry or Upset Customer",
    description: "Escalate when customer uses angry language",
    conditions: [
      {
        type: "keyword",
        value: [
          "angry",
          "furious",
          "pissed",
          "mad",
          "outraged",
          "disgusted",
          "terrible service",
          "worst experience",
          "never again",
          "hate this",
          "scam",
          "rip off",
        ],
      },
    ],
  },
  {
    name: "Complex Technical Issues",
    description: "Escalate complex technical problems beyond AI capability",
    conditions: [
      {
        type: "keyword",
        value: [
          "technical problem",
          "system error",
          "bug",
          "malfunction",
          "not working",
          "broken feature",
          "website issue",
          "app crash",
        ],
      },
    ],
  },
  {
    name: "Pricing Negotiations",
    description: "Escalate when customer wants to negotiate pricing",
    conditions: [
      {
        type: "keyword",
        value: [
          "negotiate price",
          "best price",
          "discount",
          "deal",
          "lower price",
          "price match",
          "better offer",
          "cheaper",
          "price negotiation",
        ],
      },
    ],
  },
  {
    name: "Complaint or Feedback",
    description: "Escalate formal complaints or serious feedback",
    conditions: [
      {
        type: "keyword",
        value: [
          "complaint",
          "complain about",
          "file complaint",
          "poor service",
          "bad experience",
          "disappointed",
          "manager",
          "supervisor",
          "corporate",
          "feedback",
        ],
      },
    ],
  },
  {
    name: "Urgency Indicators",
    description: "Escalate urgent time-sensitive requests",
    conditions: [
      {
        type: "keyword",
        value: [
          "urgent",
          "emergency",
          "asap",
          "immediately",
          "right now",
          "time sensitive",
          "deadline",
          "today only",
          "expires soon",
        ],
      },
    ],
  },
  {
    name: "Financial or Credit Issues",
    description: "Escalate financial and credit-related discussions",
    conditions: [
      {
        type: "keyword",
        value: [
          "financing",
          "credit score",
          "loan approval",
          "payment plan",
          "interest rate",
          "down payment",
          "trade-in value",
          "lease terms",
          "monthly payment",
        ],
      },
    ],
  },
];

/**
 * Install default escalation triggers for a dealership
 */
export async function installDefaultEscalationTriggers(
  dealershipId: number,
): Promise<void> {
  try {
    logger.info("Installing default escalation triggers", { dealershipId });

    for (const trigger of DEFAULT_ESCALATION_TRIGGERS) {
      await createEscalationTrigger({
        dealershipId,
        name: trigger.name,
        description: trigger.description,
        conditions: trigger.conditions,
        isActive: true,
      });

      logger.info("Installed escalation trigger", {
        dealershipId,
        triggerName: trigger.name,
      });
    }

    logger.info("Default escalation triggers installation completed", {
      dealershipId,
      triggerCount: DEFAULT_ESCALATION_TRIGGERS.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to install default escalation triggers", {
      error: err.message,
      dealershipId,
    });
    throw err;
  }
}

/**
 * Check if dealership has any escalation triggers
 */
export async function hasEscalationTriggers(
  dealershipId: number,
): Promise<boolean> {
  try {
    const { getEscalationTriggers } = await import("./escalation-triggers");
    const triggers = await getEscalationTriggers(dealershipId);
    return triggers.length > 0;
  } catch (error) {
    logger.error("Failed to check escalation triggers", {
      error,
      dealershipId,
    });
    return false;
  }
}

/**
 * Ensure dealership has escalation triggers installed
 */
export async function ensureEscalationTriggers(
  dealershipId: number,
): Promise<void> {
  try {
    const hasTriggers = await hasEscalationTriggers(dealershipId);

    if (!hasTriggers) {
      logger.info("No escalation triggers found, installing defaults", {
        dealershipId,
      });
      await installDefaultEscalationTriggers(dealershipId);
    } else {
      logger.info("Escalation triggers already exist", { dealershipId });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to ensure escalation triggers", {
      error: err.message,
      dealershipId,
    });
  }
}
