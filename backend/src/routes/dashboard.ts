import { Hono } from "hono";
import {
  getUserEarnings,
  getRecentPayouts,
  getPollsByCreator,
  getResponsesByAgent,
  getAgentProfile,
  getPlatformStats,
  getPublicActivity,
} from "../db/queries.js";
import { requireAuth, getUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const dashboard = new Hono<AppEnv>();

/**
 * GET /dashboard/stats
 * Public platform statistics for landing page (no auth required)
 */
dashboard.get("/stats", async (c) => {
  try {
    const stats = await getPlatformStats();
    return c.json(stats);
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    // Return default stats on error
    return c.json({
      totalPolls: 0,
      totalDistributed: "0.00",
      activeAgents: 0,
      completedToday: 0,
    });
  }
});

/**
 * GET /dashboard/public-activity
 * Public activity feed for landing page (no auth required)
 */
dashboard.get("/public-activity", async (c) => {
  try {
    const activities = await getPublicActivity(10);
    return c.json({ activities });
  } catch (error) {
    console.error("Error fetching public activity:", error);
    return c.json({ activities: [] });
  }
});

/**
 * GET /dashboard/summary
 * Get dashboard summary: earnings, polls created, polls taken, active counts
 */
dashboard.get("/summary", requireAuth, async (c) => {
  const user = getUser(c);

  // Fetch all data in parallel
  const [earnings, createdPolls, agentResponses, profile] = await Promise.all([
    getUserEarnings(user.walletAddress),
    getPollsByCreator(user.userId),
    getResponsesByAgent(user.walletAddress, { limit: 1000 }),
    getAgentProfile(user.userId),
  ]);

  // Count polls by status
  const pollCounts = {
    total: createdPolls.length,
    draft: 0,
    active: 0,
    closed: 0,
    distributed: 0,
    cancelled: 0,
  };

  for (const poll of createdPolls) {
    pollCounts[poll.status]++;
  }

  return c.json({
    earnings: {
      totalEarned: earnings.totalEarned,
      confirmedPayouts: earnings.confirmedCount,
      pendingPayouts: earnings.pendingCount,
    },
    pollsCreated: pollCounts,
    pollsTaken: agentResponses.length,
    profile: profile
      ? {
          reliabilityScore: profile.reliabilityScore,
          pollsCompleted: profile.pollsCompleted,
          verifiedAttributes: profile.verifiedAttributes,
        }
      : null,
  });
});

/**
 * GET /dashboard/activity
 * Get recent activity feed (responses, payouts, polls created)
 */
dashboard.get("/activity", requireAuth, async (c) => {
  const user = getUser(c);

  // Fetch recent activity in parallel
  const [recentPayouts, recentResponses, recentPolls] = await Promise.all([
    getRecentPayouts(user.walletAddress, { limit: 10 }),
    getResponsesByAgent(user.walletAddress, { limit: 10 }),
    getPollsByCreator(user.userId, { limit: 10 }),
  ]);

  // Build activity feed
  type ActivityItem = {
    type: "payout" | "response" | "poll_created";
    timestamp: string;
    data: Record<string, unknown>;
  };

  const activities: ActivityItem[] = [];

  // Add payouts
  for (const payout of recentPayouts) {
    activities.push({
      type: "payout",
      timestamp: payout.distributedAt?.toISOString() ?? new Date().toISOString(),
      data: {
        id: payout.id,
        pollId: payout.pollId,
        pollTitle: payout.poll?.title ?? "Unknown Poll",
        amountUsdc: payout.amountUsdc,
        status: payout.status,
        txHash: payout.txHash,
      },
    });
  }

  // Add responses
  for (const response of recentResponses) {
    activities.push({
      type: "response",
      timestamp: response.submittedAt.toISOString(),
      data: {
        id: response.id,
        pollId: response.pollId,
        pollTitle: response.poll?.title ?? "Unknown Poll",
      },
    });
  }

  // Add created polls
  for (const poll of recentPolls) {
    activities.push({
      type: "poll_created",
      timestamp: poll.createdAt.toISOString(),
      data: {
        id: poll.id,
        title: poll.title,
        status: poll.status,
        cashPoolUsdc: poll.cashPoolUsdc,
        participantCap: poll.participantCap,
      },
    });
  }

  // Sort by timestamp descending
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Return top 20
  return c.json({
    activities: activities.slice(0, 20),
  });
});

export default dashboard;
