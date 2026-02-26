import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  decimal,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============ Enums ============

export const pollStatusEnum = pgEnum("poll_status", [
  "draft",
  "active",
  "closed",
  "finalized",  // Payouts calculated, claims open (90 day window)
  "distributed",
  "cancelled",
]);

export const visibilityEnum = pgEnum("visibility", ["public", "private"]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "confirmed",
  "failed",
]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const withdrawalDestinationEnum = pgEnum("withdrawal_destination", [
  "wallet",
  "cashapp",
  "venmo",
  "bank",
]);

// ============ Tables ============

/**
 * Users table - wallet address is the primary identity
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_wallet_address_idx").on(table.walletAddress)]
);

/**
 * Polls table - stores poll metadata and links to on-chain poll ID
 */
export const polls = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .references(() => users.id)
      .notNull(),
    contractPollId: integer("contract_poll_id"), // on-chain poll ID, null until funded
    title: text("title").notNull(),
    description: text("description"),
    questions: jsonb("questions").notNull().$type<Question[]>(),
    criteria: jsonb("criteria").notNull().$type<PollCriteria>(),
    criteriaHash: text("criteria_hash").notNull(), // bytes32, matches on-chain
    cashPoolUsdc: decimal("cash_pool_usdc", { precision: 18, scale: 6 }).notNull(),
    participantCap: integer("participant_cap").notNull(),
    status: pollStatusEnum("status").default("draft").notNull(),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("polls_creator_id_idx").on(table.creatorId),
    index("polls_status_idx").on(table.status),
    index("polls_contract_poll_id_idx").on(table.contractPollId),
  ]
);

/**
 * Poll responses table - stores agent submissions
 */
export const pollResponses = pgTable(
  "poll_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .references(() => polls.id)
      .notNull(),
    agentWallet: text("agent_wallet").notNull(),
    responses: jsonb("responses").notNull().$type<ResponseAnswer[]>(),
    confidenceScores: jsonb("confidence_scores").$type<ConfidenceScore[]>(),
    attestationHash: text("attestation_hash").notNull(),
    onChainTxHash: text("on_chain_tx_hash"), // Transaction hash when agent submitted on-chain
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => [
    index("poll_responses_poll_id_idx").on(table.pollId),
    index("poll_responses_agent_wallet_idx").on(table.agentWallet),
    // Unique constraint to prevent double submissions
    uniqueIndex("poll_responses_poll_agent_unique").on(
      table.pollId,
      table.agentWallet
    ),
  ]
);

/**
 * Payouts table - tracks USDC distributions and claims
 * In claim model: records created when poll is finalized, updated when agent claims
 */
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .references(() => polls.id)
      .notNull(),
    recipientWallet: text("recipient_wallet").notNull(),
    amountUsdc: decimal("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    txHash: text("tx_hash"), // on-chain transaction hash (claim tx or push distribution tx)
    status: payoutStatusEnum("status").default("pending").notNull(),
    claimDeadline: timestamp("claim_deadline"), // 90 days after poll finalized
    claimedAt: timestamp("claimed_at"), // When agent claimed on-chain
    distributedAt: timestamp("distributed_at"), // Legacy: when push distributed
  },
  (table) => [
    index("payouts_poll_id_idx").on(table.pollId),
    index("payouts_recipient_wallet_idx").on(table.recipientWallet),
    index("payouts_status_idx").on(table.status),
    index("payouts_claim_deadline_idx").on(table.claimDeadline),
  ]
);

/**
 * Agent profiles table - stores verified attributes and stats
 */
export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    verifiedAttributes: jsonb("verified_attributes")
      .default({})
      .notNull()
      .$type<VerifiedAttributes>(),
    reliabilityScore: decimal("reliability_score", { precision: 3, scale: 2 })
      .default("1.00")
      .notNull(),
    pollsCompleted: integer("polls_completed").default(0).notNull(),
    totalEarnedUsdc: decimal("total_earned_usdc", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("agent_profiles_user_id_idx").on(table.userId)]
);

/**
 * Withdrawals table - tracks USDC withdrawals from agent wallets
 */
export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentWallet: text("agent_wallet").notNull(),
    destinationType: withdrawalDestinationEnum("destination_type").notNull(),
    destinationAddress: text("destination_address").notNull(), // wallet address or bridge wallet
    destinationHandle: text("destination_handle"), // e.g., $cashtag, @venmo, bank account hint
    amountUsdc: decimal("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    feeUsdc: decimal("fee_usdc", { precision: 18, scale: 6 }).default("0").notNull(),
    txHash: text("tx_hash"), // on-chain transaction hash
    status: withdrawalStatusEnum("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("withdrawals_agent_wallet_idx").on(table.agentWallet),
    index("withdrawals_status_idx").on(table.status),
    index("withdrawals_requested_at_idx").on(table.requestedAt),
  ]
);

/**
 * Auth nonces table - stores nonces for wallet signature verification
 */
export const authNonces = pgTable(
  "auth_nonces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    nonce: text("nonce").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("auth_nonces_wallet_address_idx").on(table.walletAddress),
    index("auth_nonces_nonce_idx").on(table.nonce),
  ]
);

// ============ Relations ============

export const usersRelations = relations(users, ({ many, one }) => ({
  polls: many(polls),
  agentProfile: one(agentProfiles, {
    fields: [users.id],
    references: [agentProfiles.userId],
  }),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  creator: one(users, {
    fields: [polls.creatorId],
    references: [users.id],
  }),
  responses: many(pollResponses),
  payouts: many(payouts),
}));

export const pollResponsesRelations = relations(pollResponses, ({ one }) => ({
  poll: one(polls, {
    fields: [pollResponses.pollId],
    references: [polls.id],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  poll: one(polls, {
    fields: [payouts.pollId],
    references: [polls.id],
  }),
}));

export const agentProfilesRelations = relations(agentProfiles, ({ one }) => ({
  user: one(users, {
    fields: [agentProfiles.userId],
    references: [users.id],
  }),
}));

// ============ TypeScript Types ============

/**
 * Question types supported in polls
 */
export type QuestionType =
  | "multiple_choice"
  | "rating_scale"
  | "yes_no"
  | "short_text"
  | "ranking";

/**
 * Individual question in a poll
 */
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  options?: string[]; // for multiple_choice, ranking
  minValue?: number; // for rating_scale
  maxValue?: number; // for rating_scale
}

/**
 * Targeting criteria for poll eligibility
 */
export interface PollCriteria {
  minAge?: number;
  maxAge?: number;
  states?: string[]; // US state codes
  isVeteran?: boolean;
  isRegisteredVoter?: boolean;
  isPropertyOwner?: boolean;
  occupations?: string[];
  incomeRange?: { min?: number; max?: number };
  customAttributes?: Record<string, unknown>;
}

/**
 * Source of an answer - where the confidence comes from
 */
export type AnswerSource =
  | "verified"       // From verified attributes (age, state, veteran status)
  | "profile"        // From self-reported profile data
  | "learned"        // From opinions section (previously answered)
  | "user-confirmed" // User answered this specific question
  | "inferred";      // Agent inferred from context (lowest confidence)

/**
 * Individual response answer with optional confidence and source
 */
export interface ResponseAnswer {
  questionId: string;
  answer: string | number | string[];
  /** Confidence level for this answer */
  confidence?: "high" | "medium" | "low";
  /** Source of this answer */
  source?: AnswerSource;
}

/**
 * Confidence score for a response
 */
export interface ConfidenceScore {
  questionId: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Verified attributes from agent attestations
 */
export interface VerifiedAttributes {
  // Verified (from document scanning)
  verifiedName?: string;
  verifiedAge?: number;
  verifiedState?: string;
  verifiedCity?: string;
  verifiedZipCode?: string;
  isVeteran?: boolean;
  isRegisteredVoter?: boolean;
  isPropertyOwner?: boolean;
  // Self-reported (from profile) - used as fallback
  state?: string;
  age?: number;
  occupation?: string;
  // Extensible for other attributes
  [key: string]: unknown;
}

// ============ Inferred Types ============

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;

export type PollResponse = typeof pollResponses.$inferSelect;
export type NewPollResponse = typeof pollResponses.$inferInsert;

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;

export type AgentProfile = typeof agentProfiles.$inferSelect;
export type NewAgentProfile = typeof agentProfiles.$inferInsert;

export type AuthNonce = typeof authNonces.$inferSelect;
export type NewAuthNonce = typeof authNonces.$inferInsert;

export type Withdrawal = typeof withdrawals.$inferSelect;
export type NewWithdrawal = typeof withdrawals.$inferInsert;
