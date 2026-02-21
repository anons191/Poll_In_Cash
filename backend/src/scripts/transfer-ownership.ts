import { db } from "../db/index.js";
import { polls, users } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";

const NEW_OWNER_WALLET = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"; // Hardhat test wallet

async function transferOwnership() {
  // Get or create the new owner user
  let newOwner = await db.select().from(users).where(eq(users.walletAddress, NEW_OWNER_WALLET));
  
  if (newOwner.length === 0) {
    const created = await db.insert(users).values({
      walletAddress: NEW_OWNER_WALLET,
    }).returning();
    newOwner = created;
    console.log("Created new owner user:", newOwner[0].id);
  } else {
    console.log("Found existing owner user:", newOwner[0].id);
  }
  
  const pollIds = [
    "4d50b5f3-7563-4030-87a0-c3fcddac274e", // Veterans in Nevada
    "526e48ae-f497-4491-8d0d-02426fd215da", // Las Vegas Food Service
  ];
  
  // Update poll ownership
  for (const pollId of pollIds) {
    await db.update(polls)
      .set({ creatorId: newOwner[0].id })
      .where(eq(polls.id, pollId));
    console.log(`Transferred ownership of poll ${pollId}`);
  }
  
  console.log("\nOwnership transfer complete!");
}

transferOwnership().catch(console.error).finally(() => process.exit(0));
