/**
 * Clean up test/mock data that doesn't reflect real on-chain activity
 *
 * Keep:
 * - Poll 6 (Nevada Veterans: Career After Service) - our real e2e test
 * - Response from 0x57eEdB73... - real agent
 * - Payout to 0x57eEdB73... - real payout
 *
 * Remove or reset:
 * - Old responses from 0x9df3281f (that was creator wallet being used incorrectly as agent)
 * - Agent profile stats for 0x9df3281f (reset to 0 since it's the creator, not agent)
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
import { eq, and, sql, ne } from "drizzle-orm";

const CREATOR_WALLET = "0x9df3281fe4403f60c99da183eff960458cd251b2";
const REAL_AGENT_WALLET = "0x57eedb735649985a97c49723b8ed4832c81a98aa";
const REAL_POLL_CONTRACT_ID = 6;

async function main() {
  console.log("=== CLEANUP TEST DATA ===\n");

  // 1. Show what we're keeping (real data)
  console.log("📋 KEEPING (Real e2e test data):");
  const realPoll = await db.query.polls.findFirst({
    where: eq(polls.contractPollId, REAL_POLL_CONTRACT_ID),
  });
  console.log(`  Poll: ${realPoll?.title} (contractId: ${realPoll?.contractPollId})`);

  const realResponse = await db.query.pollResponses.findFirst({
    where: eq(pollResponses.agentWallet, REAL_AGENT_WALLET),
  });
  console.log(`  Response: from ${realResponse?.agentWallet.slice(0, 12)}...`);

  const realPayout = await db.query.payouts.findFirst({
    where: eq(payouts.recipientWallet, REAL_AGENT_WALLET),
  });
  console.log(`  Payout: ${realPayout?.amountUsdc} USDC to ${realPayout?.recipientWallet.slice(0, 12)}...`);

  // 2. Remove old test responses from creator wallet (it was incorrectly used as agent)
  console.log("\n🗑️ REMOVING (Old test responses from creator wallet):");

  const oldResponses = await db.select().from(pollResponses).where(
    eq(pollResponses.agentWallet, CREATOR_WALLET)
  );
  console.log(`  Found ${oldResponses.length} responses from creator wallet`);

  if (oldResponses.length > 0) {
    await db.delete(pollResponses).where(eq(pollResponses.agentWallet, CREATOR_WALLET));
    console.log(`  Deleted ${oldResponses.length} incorrect responses`);
  }

  // 3. Reset creator's agent profile stats (it shouldn't have agent stats)
  console.log("\n🔄 RESETTING (Creator wallet agent profile):");

  const creatorUser = await db.query.users.findFirst({
    where: eq(users.walletAddress, CREATOR_WALLET),
  });

  if (creatorUser) {
    const creatorProfile = await db.query.agentProfiles.findFirst({
      where: eq(agentProfiles.userId, creatorUser.id),
    });

    if (creatorProfile && (parseFloat(creatorProfile.totalEarnedUsdc) > 0 || creatorProfile.pollsCompleted > 0)) {
      console.log(`  Current: ${creatorProfile.totalEarnedUsdc} USDC, ${creatorProfile.pollsCompleted} polls`);

      await db.update(agentProfiles).set({
        totalEarnedUsdc: "0",
        pollsCompleted: 0,
      }).where(eq(agentProfiles.userId, creatorUser.id));

      console.log(`  Reset to: 0 USDC, 0 polls`);
    } else {
      console.log(`  Already clean`);
    }
  }

  // 4. Verify final state
  console.log("\n✅ FINAL STATE:");

  const responseCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pollResponses);
  console.log(`  Total responses: ${responseCount[0]?.count}`);

  const payoutTotal = await db
    .select({ total: sql<string>`COALESCE(SUM(amount_usdc), 0)::text` })
    .from(payouts)
    .where(eq(payouts.status, "confirmed"));
  console.log(`  Total distributed: ${parseFloat(payoutTotal[0]?.total || "0").toFixed(2)} USDC`);

  // List all responses
  const allResponses = await db.query.pollResponses.findMany({
    with: { poll: true },
  });
  console.log(`\n  Responses:`);
  for (const r of allResponses) {
    console.log(`    - ${r.poll?.title?.slice(0, 30)}... by ${r.agentWallet.slice(0, 12)}...`);
  }

  // List all payouts
  const allPayouts = await db.query.payouts.findMany({
    with: { poll: true },
  });
  console.log(`\n  Payouts:`);
  for (const p of allPayouts) {
    console.log(`    - ${p.amountUsdc} USDC to ${p.recipientWallet.slice(0, 12)}... (${p.status})`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
