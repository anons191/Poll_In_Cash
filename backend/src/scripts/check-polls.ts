import { db } from "../db/index.js";
import { polls, pollResponses, users } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";

async function checkPolls() {
  const pollIds = [
    "4d50b5f3-7563-4030-87a0-c3fcddac274e", // Veterans in Nevada
    "526e48ae-f497-4491-8d0d-02426fd215da", // Las Vegas Food Service
  ];
  
  for (const pollId of pollIds) {
    const poll = await db.select().from(polls).where(eq(polls.id, pollId));
    if (poll.length === 0) continue;
    
    const creator = await db.select().from(users).where(eq(users.id, poll[0].creatorId));
    const responses = await db.select().from(pollResponses).where(eq(pollResponses.pollId, pollId));
    
    console.log(`\n=== ${poll[0].title} ===`);
    console.log(`Poll ID: ${poll[0].id}`);
    console.log(`Contract Poll ID: ${poll[0].contractPollId}`);
    console.log(`Status: ${poll[0].status}`);
    console.log(`Creator wallet: ${creator[0]?.walletAddress}`);
    console.log(`Cash Pool: ${poll[0].cashPoolUsdc} USDC`);
    console.log(`Responses: ${responses.length}`);
    
    for (const resp of responses) {
      console.log(`  - Respondent: ${resp.agentWallet}`);
    }
  }
}

checkPolls().catch(console.error).finally(() => process.exit(0));
