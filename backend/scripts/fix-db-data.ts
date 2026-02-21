/**
 * Fix database data to reflect real on-chain state
 *
 * This script:
 * 1. Shows current database state
 * 2. Cleans up mock/test data
 * 3. Adds real Poll 6 data from our e2e test
 * 4. Creates proper payout records
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { db } from "../src/db/index.js";
import { polls, pollResponses, payouts, users, agentProfiles } from "../src/db/schema.js";
import { eq, sql } from "drizzle-orm";

// Real data from our e2e test
const POLL_6_DATA = {
  contractPollId: 6,
  title: "Nevada Veterans: Career After Service",
  criteriaHash: "0x22fcf0191f42c9feeee076bfa787f20e657687a98278fac15da4e0d8b12dfd43",
  cashPoolUsdc: "2.000000",
  participantCap: 2,
  agentWallet: "0x57eEdB735649985a97c49723B8eD4832c81a98AA",
  creatorWallet: "0x9df3281Fe4403f60c99Da183efF960458Cd251b2",
  distributedAmount: "1.8",
  distributeTxHash: "0xcd62d850d18e8368548dea15fa967cbc60ebd643fe7ca96a2d73fc50701c7bdf",
  submitResponseTxHash: "0x7411ea806f651dafcdc8a923c2b8012603ed22d3a1ffed271763d3f313970cd2",
};

async function showCurrentState() {
  console.log("=== CURRENT DATABASE STATE ===\n");

  const allPolls = await db.select().from(polls);
  console.log(`📋 POLLS (${allPolls.length}):`);
  for (const p of allPolls) {
    console.log(`  - ${p.title} (contractId: ${p.contractPollId}, status: ${p.status})`);
  }

  const allResponses = await db.select().from(pollResponses);
  console.log(`\n📝 RESPONSES (${allResponses.length}):`);
  for (const r of allResponses) {
    console.log(`  - Poll ${r.pollId.slice(0, 8)}... by ${r.agentWallet.slice(0, 10)}...`);
  }

  const allPayouts = await db.select().from(payouts);
  console.log(`\n💰 PAYOUTS (${allPayouts.length}):`);
  for (const p of allPayouts) {
    console.log(`  - ${p.amountUsdc} USDC to ${p.recipientWallet.slice(0, 10)}... (${p.status})`);
  }

  const allUsers = await db.select().from(users);
  console.log(`\n👥 USERS (${allUsers.length}):`);
  for (const u of allUsers) {
    console.log(`  - ${u.walletAddress}`);
  }

  const allProfiles = await db.select().from(agentProfiles);
  console.log(`\n👤 PROFILES (${allProfiles.length}):`);
  for (const p of allProfiles) {
    console.log(`  - User ${p.userId.slice(0, 8)}...: ${p.totalEarnedUsdc} USDC earned, ${p.pollsCompleted} polls`);
  }
}

async function fixData() {
  console.log("\n=== FIXING DATABASE DATA ===\n");

  // 1. Check if creator user exists
  let creatorUser = await db.select().from(users).where(eq(users.walletAddress, POLL_6_DATA.creatorWallet.toLowerCase()));
  if (creatorUser.length === 0) {
    console.log("Creating creator user...");
    creatorUser = await db.insert(users).values({
      walletAddress: POLL_6_DATA.creatorWallet.toLowerCase(),
    }).returning();
  }
  const creatorId = creatorUser[0].id;
  console.log(`Creator user ID: ${creatorId}`);

  // 2. Check if agent user exists
  let agentUser = await db.select().from(users).where(eq(users.walletAddress, POLL_6_DATA.agentWallet.toLowerCase()));
  if (agentUser.length === 0) {
    console.log("Creating agent user...");
    agentUser = await db.insert(users).values({
      walletAddress: POLL_6_DATA.agentWallet.toLowerCase(),
    }).returning();
  }
  const agentUserId = agentUser[0].id;
  console.log(`Agent user ID: ${agentUserId}`);

  // 3. Check if poll exists (by contractPollId)
  let poll6 = await db.select().from(polls).where(eq(polls.contractPollId, POLL_6_DATA.contractPollId));
  if (poll6.length === 0) {
    console.log("Creating Poll 6...");
    poll6 = await db.insert(polls).values({
      creatorId: creatorId,
      contractPollId: POLL_6_DATA.contractPollId,
      title: POLL_6_DATA.title,
      description: "Survey about career transitions for Nevada veterans",
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          text: "How long after leaving the military did you find stable employment?",
          options: ["Already had a job", "Within 3 months", "3-6 months", "6-12 months", "Over a year"],
          required: true,
        },
        {
          id: "q2",
          type: "multiple_choice",
          text: "Did your military skills transfer to your civilian career?",
          options: ["Yes completely", "Somewhat", "Not really", "Had to retrain"],
          required: true,
        },
      ],
      criteria: { isVeteran: true, states: ["NV"] },
      criteriaHash: POLL_6_DATA.criteriaHash,
      cashPoolUsdc: POLL_6_DATA.cashPoolUsdc,
      participantCap: POLL_6_DATA.participantCap,
      status: "distributed",
      visibility: "public",
      expiresAt: new Date(Date.now() + 3600000),
    }).returning();
    console.log(`Poll 6 created with ID: ${poll6[0].id}`);
  } else {
    // Update existing poll to distributed status
    console.log("Updating Poll 6 status to distributed...");
    await db.update(polls).set({ status: "distributed" }).where(eq(polls.contractPollId, POLL_6_DATA.contractPollId));
  }
  const poll6Id = poll6[0].id;

  // 4. Create/update poll response
  let response = await db.select().from(pollResponses).where(
    eq(pollResponses.pollId, poll6Id)
  );
  if (response.length === 0) {
    console.log("Creating poll response...");
    await db.insert(pollResponses).values({
      pollId: poll6Id,
      agentWallet: POLL_6_DATA.agentWallet.toLowerCase(),
      responses: [
        { questionId: "q1", answer: "Within 3 months", confidence: "high", source: "user-confirmed" },
        { questionId: "q2", answer: "Somewhat", confidence: "high", source: "user-confirmed" },
      ],
      confidenceScores: [
        { questionId: "q1", confidence: "high" },
        { questionId: "q2", confidence: "high" },
      ],
      attestationHash: POLL_6_DATA.submitResponseTxHash,
    });
    console.log("Poll response created");
  }

  // 5. Create payout record
  let payout = await db.select().from(payouts).where(eq(payouts.pollId, poll6Id));
  if (payout.length === 0) {
    console.log("Creating payout record...");
    await db.insert(payouts).values({
      pollId: poll6Id,
      recipientWallet: POLL_6_DATA.agentWallet.toLowerCase(),
      amountUsdc: POLL_6_DATA.distributedAmount,
      txHash: POLL_6_DATA.distributeTxHash,
      status: "confirmed",
      distributedAt: new Date(),
    });
    console.log("Payout created");
  }

  // 6. Create/update agent profile
  let profile = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentUserId));
  if (profile.length === 0) {
    console.log("Creating agent profile...");
    await db.insert(agentProfiles).values({
      userId: agentUserId,
      verifiedAttributes: { isVeteran: true, verifiedState: "NV" },
      reliabilityScore: "1.00",
      pollsCompleted: 1,
      totalEarnedUsdc: POLL_6_DATA.distributedAmount,
    });
    console.log("Agent profile created");
  } else {
    console.log("Updating agent profile...");
    await db.update(agentProfiles).set({
      pollsCompleted: 1,
      totalEarnedUsdc: POLL_6_DATA.distributedAmount,
    }).where(eq(agentProfiles.userId, agentUserId));
  }

  // 7. Clean up old mock payouts (there shouldn't be any but just in case)
  console.log("\nCleaning up any mock payouts...");
  const deletedPayouts = await db.delete(payouts).where(
    sql`${payouts.txHash} IS NULL OR ${payouts.txHash} = ''`
  ).returning();
  console.log(`Deleted ${deletedPayouts.length} mock payouts`);
}

async function main() {
  await showCurrentState();
  await fixData();
  console.log("\n=== UPDATED DATABASE STATE ===\n");
  await showCurrentState();
}

main().catch(console.error).finally(() => process.exit(0));
