import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../src/db/schema.js";

const sql = neon(process.env.DATABASE_URL as string);
const db = drizzle(sql, { schema });

async function main() {
  console.log("=== CURRENT DATABASE STATE ===\n");

  // Check polls
  const polls = await db.select().from(schema.polls);
  console.log("📋 POLLS (" + polls.length + " total):");
  polls.forEach((p) => {
    console.log("  ID:", p.id.slice(0, 8) + "...");
    console.log("  Title:", p.title);
    console.log("  Contract Poll ID:", p.contractPollId);
    console.log("  Status:", p.status);
    console.log("  Cash Pool:", p.cashPoolUsdc, "USDC");
    console.log("  Participant Cap:", p.participantCap);
    console.log("  ---");
  });

  // Check poll responses
  const responses = await db.select().from(schema.pollResponses);
  console.log("\n📝 POLL RESPONSES (" + responses.length + " total):");
  responses.forEach((r) => {
    console.log("  ID:", r.id.slice(0, 8) + "...");
    console.log("  Poll ID:", r.pollId.slice(0, 8) + "...");
    console.log("  Agent Wallet:", r.agentWallet);
    console.log("  Submitted:", r.submittedAt);
    console.log("  ---");
  });

  // Check payouts
  const payouts = await db.select().from(schema.payouts);
  console.log("\n💰 PAYOUTS (" + payouts.length + " total):");
  payouts.forEach((p) => {
    console.log("  ID:", p.id.slice(0, 8) + "...");
    console.log("  Poll ID:", p.pollId.slice(0, 8) + "...");
    console.log("  Recipient:", p.recipientWallet);
    console.log("  Amount:", p.amountUsdc, "USDC");
    console.log("  Status:", p.status);
    console.log("  TX Hash:", p.txHash || "null");
    console.log("  ---");
  });

  // Check agent profiles
  const profiles = await db.select().from(schema.agentProfiles);
  console.log("\n👤 AGENT PROFILES (" + profiles.length + " total):");
  profiles.forEach((p) => {
    console.log("  ID:", p.id.slice(0, 8) + "...");
    console.log("  User ID:", p.userId.slice(0, 8) + "...");
    console.log("  Total Earned:", p.totalEarnedUsdc, "USDC");
    console.log("  Polls Completed:", p.pollsCompleted);
    console.log("  ---");
  });

  // Check users
  const users = await db.select().from(schema.users);
  console.log("\n👥 USERS (" + users.length + " total):");
  users.forEach((u) => {
    console.log("  ID:", u.id.slice(0, 8) + "...");
    console.log("  Wallet:", u.walletAddress);
    console.log("  ---");
  });
}

main().catch(console.error);
