import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./index.js";
import {
  users,
  polls,
  pollResponses,
  payouts,
  agentProfiles,
  authNonces,
  type NewPoll,
  type NewPollResponse,
  type NewPayout,
  type Poll,
  type VerifiedAttributes,
} from "./schema.js";

// ============ User Queries ============

/**
 * Create a new user with wallet address
 */
export async function createUser(walletAddress: string) {
  const [user] = await db
    .insert(users)
    .values({ walletAddress: walletAddress.toLowerCase() })
    .returning();
  return user;
}

/**
 * Get user by wallet address
 */
export async function getUserByWallet(walletAddress: string) {
  return db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress.toLowerCase()),
  });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

/**
 * Get or create user by wallet address
 */
export async function getOrCreateUser(walletAddress: string) {
  const normalizedAddress = walletAddress.toLowerCase();
  let user = await getUserByWallet(normalizedAddress);
  if (!user) {
    user = await createUser(normalizedAddress);
  }
  return user;
}

// ============ Poll Queries ============

/**
 * Create a new poll
 */
export async function createPoll(data: NewPoll) {
  const [poll] = await db.insert(polls).values(data).returning();
  return poll;
}

/**
 * Get poll by ID with optional relations
 */
export async function getPollById(
  pollId: string,
  options?: { withCreator?: boolean; withResponses?: boolean }
) {
  return db.query.polls.findFirst({
    where: eq(polls.id, pollId),
    with: {
      creator: options?.withCreator ? true : undefined,
      responses: options?.withResponses ? true : undefined,
    },
  });
}

/**
 * Get poll by on-chain contract poll ID
 */
export async function getPollByContractId(contractPollId: number) {
  return db.query.polls.findFirst({
    where: eq(polls.contractPollId, contractPollId),
  });
}

/**
 * Get polls by status
 */
export async function getPollsByStatus(
  status: Poll["status"],
  options?: { limit?: number; offset?: number }
) {
  return db.query.polls.findMany({
    where: eq(polls.status, status),
    orderBy: desc(polls.createdAt),
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  });
}

/**
 * Get polls by creator
 */
export async function getPollsByCreator(
  creatorId: string,
  options?: { status?: Poll["status"]; limit?: number }
) {
  const conditions = [eq(polls.creatorId, creatorId)];
  if (options?.status) {
    conditions.push(eq(polls.status, options.status));
  }

  return db.query.polls.findMany({
    where: and(...conditions),
    orderBy: desc(polls.createdAt),
    limit: options?.limit ?? 50,
  });
}

/**
 * Get active public polls for discovery
 */
export async function getDiscoverablePolls(options?: {
  limit?: number;
  offset?: number;
}) {
  return db.query.polls.findMany({
    where: and(eq(polls.status, "active"), eq(polls.visibility, "public")),
    orderBy: desc(polls.createdAt),
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  });
}

/**
 * Update poll status
 */
export async function updatePollStatus(
  pollId: string,
  status: Poll["status"]
) {
  const [updated] = await db
    .update(polls)
    .set({ status })
    .where(eq(polls.id, pollId))
    .returning();
  return updated;
}

/**
 * Update poll with contract poll ID after on-chain funding
 */
export async function setPollContractId(
  pollId: string,
  contractPollId: number
) {
  const [updated] = await db
    .update(polls)
    .set({ contractPollId, status: "active" })
    .where(eq(polls.id, pollId))
    .returning();
  return updated;
}

// ============ Poll Response Queries ============

/**
 * Record a poll response
 */
export async function recordResponse(data: NewPollResponse) {
  const [response] = await db.insert(pollResponses).values(data).returning();
  return response;
}

/**
 * Get responses for a poll
 */
export async function getResponsesByPoll(
  pollId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.query.pollResponses.findMany({
    where: eq(pollResponses.pollId, pollId),
    orderBy: desc(pollResponses.submittedAt),
    limit: options?.limit ?? 100,
    offset: options?.offset ?? 0,
  });
}

/**
 * Check if agent has already responded to a poll
 */
export async function hasAgentResponded(pollId: string, agentWallet: string) {
  const response = await db.query.pollResponses.findFirst({
    where: and(
      eq(pollResponses.pollId, pollId),
      eq(pollResponses.agentWallet, agentWallet.toLowerCase())
    ),
  });
  return !!response;
}

/**
 * Get response count for a poll
 */
export async function getResponseCount(pollId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pollResponses)
    .where(eq(pollResponses.pollId, pollId));
  return result[0]?.count ?? 0;
}

/**
 * Get all responses by an agent wallet
 */
export async function getResponsesByAgent(
  agentWallet: string,
  options?: { limit?: number }
) {
  return db.query.pollResponses.findMany({
    where: eq(pollResponses.agentWallet, agentWallet.toLowerCase()),
    with: { poll: true },
    orderBy: desc(pollResponses.submittedAt),
    limit: options?.limit ?? 50,
  });
}

// ============ Payout Queries ============

/**
 * Record a payout
 */
export async function recordPayout(data: NewPayout) {
  const [payout] = await db.insert(payouts).values(data).returning();
  return payout;
}

/**
 * Record multiple payouts (batch insert)
 */
export async function recordPayouts(data: NewPayout[]) {
  return db.insert(payouts).values(data).returning();
}

/**
 * Update payout status with transaction hash
 */
export async function updatePayoutStatus(
  payoutId: string,
  status: "pending" | "confirmed" | "failed",
  txHash?: string
) {
  const [updated] = await db
    .update(payouts)
    .set({
      status,
      txHash,
      distributedAt: status === "confirmed" ? new Date() : undefined,
    })
    .where(eq(payouts.id, payoutId))
    .returning();
  return updated;
}

/**
 * Get payouts for a poll
 */
export async function getPayoutsByPoll(pollId: string) {
  return db.query.payouts.findMany({
    where: eq(payouts.pollId, pollId),
    orderBy: desc(payouts.distributedAt),
  });
}

/**
 * Get user's total earnings
 */
export async function getUserEarnings(walletAddress: string) {
  const result = await db
    .select({
      totalEarned: sql<string>`COALESCE(SUM(${payouts.amountUsdc}), '0')`,
      confirmedCount: sql<number>`COUNT(*) FILTER (WHERE ${payouts.status} = 'confirmed')::int`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${payouts.status} = 'pending')::int`,
    })
    .from(payouts)
    .where(eq(payouts.recipientWallet, walletAddress.toLowerCase()));

  return {
    totalEarned: result[0]?.totalEarned ?? "0",
    confirmedCount: result[0]?.confirmedCount ?? 0,
    pendingCount: result[0]?.pendingCount ?? 0,
  };
}

/**
 * Get recent payouts for a user
 */
export async function getRecentPayouts(
  walletAddress: string,
  options?: { limit?: number }
) {
  return db.query.payouts.findMany({
    where: eq(payouts.recipientWallet, walletAddress.toLowerCase()),
    with: { poll: true },
    orderBy: desc(payouts.distributedAt),
    limit: options?.limit ?? 20,
  });
}

// ============ Agent Profile Queries ============

/**
 * Get agent profile by user ID
 */
export async function getAgentProfile(userId: string) {
  return db.query.agentProfiles.findFirst({
    where: eq(agentProfiles.userId, userId),
  });
}

/**
 * Get agent profile by wallet address
 */
export async function getAgentProfileByWallet(walletAddress: string) {
  const user = await getUserByWallet(walletAddress);
  if (!user) return null;

  return db.query.agentProfiles.findFirst({
    where: eq(agentProfiles.userId, user.id),
  });
}

/**
 * Create or get agent profile for a user
 */
export async function getOrCreateAgentProfile(userId: string) {
  let profile = await getAgentProfile(userId);
  if (!profile) {
    [profile] = await db
      .insert(agentProfiles)
      .values({ userId })
      .returning();
  }
  return profile;
}

/**
 * Update agent profile
 */
export async function updateAgentProfile(
  userId: string,
  data: Partial<{
    verifiedAttributes: VerifiedAttributes;
    reliabilityScore: string;
    pollsCompleted: number;
    totalEarnedUsdc: string;
  }>
) {
  const [updated] = await db
    .update(agentProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agentProfiles.userId, userId))
    .returning();
  return updated;
}

/**
 * Increment agent stats after completing a poll
 */
export async function incrementAgentStats(userId: string, earnedUsdc: string) {
  const [updated] = await db
    .update(agentProfiles)
    .set({
      pollsCompleted: sql`${agentProfiles.pollsCompleted} + 1`,
      totalEarnedUsdc: sql`${agentProfiles.totalEarnedUsdc} + ${earnedUsdc}::decimal`,
      updatedAt: new Date(),
    })
    .where(eq(agentProfiles.userId, userId))
    .returning();
  return updated;
}

// ============ Auth Nonce Queries ============

/**
 * Create a nonce for wallet signature verification
 */
export async function createAuthNonce(walletAddress: string, nonce: string) {
  // Expires in 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const [authNonce] = await db
    .insert(authNonces)
    .values({
      walletAddress: walletAddress.toLowerCase(),
      nonce,
      expiresAt,
    })
    .returning();
  return authNonce;
}

/**
 * Get valid (unused, unexpired) nonce for wallet
 */
export async function getValidNonce(walletAddress: string, nonce: string) {
  return db.query.authNonces.findFirst({
    where: and(
      eq(authNonces.walletAddress, walletAddress.toLowerCase()),
      eq(authNonces.nonce, nonce),
      sql`${authNonces.expiresAt} > NOW()`,
      sql`${authNonces.usedAt} IS NULL`
    ),
  });
}

/**
 * Mark nonce as used
 */
export async function markNonceUsed(nonceId: string) {
  await db
    .update(authNonces)
    .set({ usedAt: new Date() })
    .where(eq(authNonces.id, nonceId));
}

/**
 * Clean up expired nonces (run periodically)
 */
export async function cleanupExpiredNonces() {
  await db
    .delete(authNonces)
    .where(sql`${authNonces.expiresAt} < NOW()`);
}

// ============ Public Stats Queries ============

/**
 * Get platform-wide statistics for public landing page
 */
export async function getPlatformStats() {
  // Total polls created
  const pollCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(polls);
  const totalPolls = pollCountResult[0]?.count ?? 0;

  // Total USDC distributed
  const distributedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(amount_usdc), 0)::text` })
    .from(payouts)
    .where(eq(payouts.status, "confirmed"));
  const totalDistributed = distributedResult[0]?.total ?? "0";

  // Active agents (unique wallets that responded in last 30 days)
  const activeAgentsResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT agent_wallet)::int` })
    .from(pollResponses)
    .where(sql`submitted_at > NOW() - INTERVAL '30 days'`);
  const activeAgents = activeAgentsResult[0]?.count ?? 0;

  // Polls completed today
  const todayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(polls)
    .where(sql`status IN ('closed', 'distributed') AND DATE(created_at) = CURRENT_DATE`);
  const completedToday = todayResult[0]?.count ?? 0;

  return {
    totalPolls,
    totalDistributed: parseFloat(totalDistributed).toFixed(2),
    activeAgents,
    completedToday,
  };
}

/**
 * Get recent public activity for landing page
 * Combines: new polls, and real confirmed payouts
 */
export async function getPublicActivity(limit = 10) {
  // Get recently created active polls
  const recentPolls = await db
    .select({
      id: polls.id,
      title: polls.title,
      cashPoolUsdc: polls.cashPoolUsdc,
      createdAt: polls.createdAt,
    })
    .from(polls)
    .where(eq(polls.status, "active"))
    .orderBy(desc(polls.createdAt))
    .limit(limit);

  // Get recent confirmed payouts
  const recentPayouts = await db
    .select({
      id: payouts.id,
      recipientWallet: payouts.recipientWallet,
      amountUsdc: payouts.amountUsdc,
      distributedAt: payouts.distributedAt,
      pollTitle: polls.title,
    })
    .from(payouts)
    .leftJoin(polls, eq(payouts.pollId, polls.id))
    .where(eq(payouts.status, "confirmed"))
    .orderBy(desc(payouts.distributedAt))
    .limit(limit);

  // Combine and format activities
  type ActivityItem = {
    id: string;
    type: "new_poll" | "payout";
    title: string;
    amount: string;
    walletAddress?: string;
    timestamp: string;
  };

  const activities: ActivityItem[] = [];

  // Add polls as "new_poll" activities
  for (const poll of recentPolls) {
    activities.push({
      id: poll.id,
      type: "new_poll",
      title: poll.title,
      amount: poll.cashPoolUsdc,
      timestamp: poll.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  // Add payouts as "payout" activities
  for (const payout of recentPayouts) {
    activities.push({
      id: payout.id,
      type: "payout",
      title: payout.pollTitle ?? "Poll",
      amount: payout.amountUsdc,
      walletAddress: payout.recipientWallet,
      timestamp: payout.distributedAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  // Sort by timestamp descending and return top N
  activities.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return activities.slice(0, limit);
}

/**
 * Get recent confirmed payouts (public, no auth required)
 * Returns payouts with confirmed status for landing page display
 */
export async function getPublicRecentPayouts(limit = 10) {
  const recentPayouts = await db
    .select({
      id: payouts.id,
      recipientWallet: payouts.recipientWallet,
      amountUsdc: payouts.amountUsdc,
      txHash: payouts.txHash,
      distributedAt: payouts.distributedAt,
      pollId: payouts.pollId,
      pollTitle: polls.title,
    })
    .from(payouts)
    .leftJoin(polls, eq(payouts.pollId, polls.id))
    .where(eq(payouts.status, "confirmed"))
    .orderBy(desc(payouts.distributedAt))
    .limit(limit);

  return recentPayouts.map((payout) => ({
    id: payout.id,
    agentAddress: payout.recipientWallet,
    amount: payout.amountUsdc,
    pollTitle: payout.pollTitle ?? "Unknown Poll",
    txHash: payout.txHash ?? "",
    timestamp: payout.distributedAt?.toISOString() ?? new Date().toISOString(),
  }));
}
