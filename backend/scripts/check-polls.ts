import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { db } from "../src/db/index.js";
import { polls } from "../src/db/schema.js";

async function main() {
  console.log("Checking polls in database...\n");

  const allPolls = await db.select().from(polls);

  for (const p of allPolls) {
    console.log(`Poll: ${p.title}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Contract Poll ID: ${p.contractPollId ?? "NOT SET"}`);
    console.log(`  Cash Pool: ${p.cashPoolUsdc} USDC`);
    console.log("");
  }

  console.log("Environment check:");
  console.log(`  POLLPOOL_CONTRACT_ADDRESS: ${process.env.POLLPOOL_CONTRACT_ADDRESS ?? "NOT SET"}`);
  console.log(`  THIRDWEB_SECRET_KEY: ${process.env.THIRDWEB_SECRET_KEY ? "SET" : "NOT SET"}`);
  console.log(`  SERVER_WALLET_PRIVATE_KEY: ${process.env.SERVER_WALLET_PRIVATE_KEY ? "SET" : "NOT SET"}`);
  console.log(`  DEPLOYER_PRIVATE_KEY: ${process.env.DEPLOYER_PRIVATE_KEY ? "SET" : "NOT SET"}`);

  process.exit(0);
}

main().catch(console.error);
