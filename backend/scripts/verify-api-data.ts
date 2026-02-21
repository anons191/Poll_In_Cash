/**
 * Verify what the API endpoints would return
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { db } from "../src/db/index.js";
import {
  polls,
  pollResponses,
  payouts,
  users,
  agentProfiles,
} from "../src/db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

async function main() {
  console.log("=== API DATA VERIFICATION ===\n");

  // 1. Platform Stats (what /dashboard/stats returns)
  console.log("📊 PLATFORM STATS (GET /dashboard/stats):");

  const pollCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(polls);
  const totalPolls = pollCountResult[0]?.count ?? 0;

  const distributedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(amount_usdc), 0)::text` })
    .from(payouts)
    .where(eq(payouts.status, "confirmed"));
  const totalDistributed = distributedResult[0]?.total ?? "0";

  const activeAgentsResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT agent_wallet)::int` })
    .from(pollResponses)
    .where(sql`submitted_at > NOW() - INTERVAL '30 days'`);
  const activeAgents = activeAgentsResult[0]?.count ?? 0;

  console.log(`  Total Polls: ${totalPolls}`);
  console.log(`  Total Distributed: ${parseFloat(totalDistributed).toFixed(2)} USDC`);
  console.log(`  Active Agents: ${activeAgents}`);

  // 2. Discoverable Polls (what /polls with status=active returns)
  console.log("\n📋 DISCOVERABLE POLLS (GET /polls?status=active):");
  const activePolls = await db.query.polls.findMany({
    where: and(eq(polls.status, "active"), eq(polls.visibility, "public")),
    orderBy: desc(polls.createdAt),
  });

  if (activePolls.length === 0) {
    console.log("  (No active public polls)");
  } else {
    for (const poll of activePolls) {
      console.log(`  - ${poll.title}`);
      console.log(`    Contract ID: ${poll.contractPollId}, Status: ${poll.status}`);
      console.log(`    Pool: ${poll.cashPoolUsdc} USDC, Cap: ${poll.participantCap}`);
    }
  }

  // 3. All Polls by status
  console.log("\n📋 ALL POLLS BY STATUS:");
  const allPolls = await db.select().from(polls);
  const statusCounts: Record<string, number> = {
    draft: 0,
    active: 0,
    closed: 0,
    distributed: 0,
    cancelled: 0,
  };
  for (const poll of allPolls) {
    statusCounts[poll.status]++;
  }
  console.log(`  Draft: ${statusCounts.draft}`);
  console.log(`  Active: ${statusCounts.active}`);
  console.log(`  Closed: ${statusCounts.closed}`);
  console.log(`  Distributed: ${statusCounts.distributed}`);
  console.log(`  Cancelled: ${statusCounts.cancelled}`);

  // 4. All Payouts
  console.log("\n💰 ALL PAYOUTS:");
  const allPayouts = await db.query.payouts.findMany({
    with: { poll: true },
  });
  if (allPayouts.length === 0) {
    console.log("  (No payouts)");
  } else {
    for (const payout of allPayouts) {
      console.log(`  - ${payout.amountUsdc} USDC to ${payout.recipientWallet.slice(0, 10)}...`);
      console.log(`    Poll: ${payout.poll?.title || "Unknown"}`);
      console.log(`    Status: ${payout.status}, TX: ${payout.txHash?.slice(0, 20) || "null"}...`);
    }
  }

  // 5. Agent profiles with earnings
  console.log("\n👤 AGENT PROFILES:");
  const profiles = await db.query.agentProfiles.findMany({
    with: { user: true },
  });
  for (const profile of profiles) {
    const earned = parseFloat(profile.totalEarnedUsdc);
    if (earned > 0 || profile.pollsCompleted > 0) {
      console.log(`  - Wallet: ${profile.user?.walletAddress.slice(0, 10)}...`);
      console.log(`    Earned: ${profile.totalEarnedUsdc} USDC`);
      console.log(`    Polls Completed: ${profile.pollsCompleted}`);
    }
  }

  // 6. Check specific agent earnings (what /dashboard/summary returns for agent 0x57ee...)
  console.log("\n🔍 AGENT 0x57eEdB73... EARNINGS:");
  const agentWallet = "0x57eedb735649985a97c49723b8ed4832c81a98aa";
  const earningsResult = await db
    .select({
      totalEarned: sql<string>`COALESCE(SUM(${payouts.amountUsdc}), '0')`,
      confirmedCount: sql<number>`COUNT(*) FILTER (WHERE ${payouts.status} = 'confirmed')::int`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${payouts.status} = 'pending')::int`,
    })
    .from(payouts)
    .where(eq(payouts.recipientWallet, agentWallet));

  console.log(`  Total Earned: ${earningsResult[0]?.totalEarned ?? "0"} USDC`);
  console.log(`  Confirmed Payouts: ${earningsResult[0]?.confirmedCount ?? 0}`);
  console.log(`  Pending Payouts: ${earningsResult[0]?.pendingCount ?? 0}`);
}

main().catch(console.error).finally(() => process.exit(0));
