import { db } from "../db/index.js";
import { polls, pollResponses, payouts, users, agentProfiles } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function checkState() {
  console.log("\n=== POLL STATE ===\n");
  
  // Get all active polls with responses
  const allPolls = await db.select().from(polls).where(eq(polls.status, "active"));
  
  for (const poll of allPolls) {
    const responses = await db.select().from(pollResponses).where(eq(pollResponses.pollId, poll.id));
    console.log(`Poll: ${poll.title}`);
    console.log(`  ID: ${poll.id}`);
    console.log(`  Status: ${poll.status}`);
    console.log(`  Contract Poll ID: ${poll.contractPollId}`);
    console.log(`  Cash Pool: ${poll.cashPoolUsdc} USDC`);
    console.log(`  Participant Cap: ${poll.participantCap}`);
    console.log(`  Response Count: ${responses.length}`);
    
    if (responses.length > 0) {
      const rewardPer = (parseFloat(poll.cashPoolUsdc) * 0.9 / poll.participantCap).toFixed(4);
      console.log(`  Reward Per Response: ${rewardPer} USDC`);
      console.log(`  Responses:`);
      for (const resp of responses) {
        console.log(`    - Wallet: ${resp.agentWallet.slice(0, 10)}...${resp.agentWallet.slice(-6)}`);
        console.log(`      Submitted: ${resp.submittedAt.toISOString()}`);
        console.log(`      Attestation: ${resp.attestationHash.slice(0, 20)}...`);
      }
    }
    console.log("");
  }
  
  // Check payouts
  console.log("\n=== PAYOUTS ===\n");
  const allPayouts = await db.select().from(payouts);
  if (allPayouts.length === 0) {
    console.log("No payouts yet (polls need to be closed and distributed)");
  } else {
    for (const payout of allPayouts) {
      console.log(`Payout: ${payout.id}`);
      console.log(`  Poll: ${payout.pollId}`);
      console.log(`  Recipient: ${payout.recipientWallet}`);
      console.log(`  Amount: ${payout.amountUsdc} USDC`);
      console.log(`  Status: ${payout.status}`);
      console.log(`  TX Hash: ${payout.txHash || "pending"}`);
    }
  }
  
  // Check agent profiles for submitted responses
  console.log("\n=== RESPONDING AGENTS ===\n");
  const responseWallets = [...new Set(
    (await db.select({ wallet: pollResponses.agentWallet }).from(pollResponses))
      .map(r => r.wallet.toLowerCase())
  )];
  
  for (const wallet of responseWallets) {
    const user = await db.select().from(users).where(eq(users.walletAddress, wallet));
    if (user.length > 0) {
      const profile = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user[0].id));
      if (profile.length > 0) {
        console.log(`Agent: ${wallet.slice(0, 10)}...${wallet.slice(-6)}`);
        console.log(`  Polls Completed: ${profile[0].pollsCompleted}`);
        console.log(`  Total Earned: ${profile[0].totalEarnedUsdc} USDC`);
        console.log(`  Reliability Score: ${profile[0].reliabilityScore}`);
        console.log(`  Verified Attributes: ${JSON.stringify(profile[0].verifiedAttributes)}`);
      }
    }
  }
}

checkState().catch(console.error).finally(() => process.exit(0));
