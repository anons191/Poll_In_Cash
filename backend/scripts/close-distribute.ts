import { config } from "dotenv";
config();

const API_BASE = "http://localhost:3001";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRBZGRyZXNzIjoiMHhmMzlmZDZlNTFhYWQ4OGY2ZjRjZTZhYjg4MjcyNzljZmZmYjkyMjY2IiwidXNlcklkIjoiMjJmNThiOWUtZTg1Yi00ODcyLWExNjktMmJkODA4ZmM2ODk1IiwiaWF0IjoxNzcxNjQwOTM0LCJleHAiOjE3NzIyNDU3MzR9.fS7l3x2BR-3ptEmp5Y9mOdxs0cAx8C5ts_HHtBUwIds";

const POLL_1_ID = "4d50b5f3-7563-4030-87a0-c3fcddac274e";
const POLL_3_ID = "526e48ae-f497-4491-8d0d-02426fd215da";

async function closePoll(pollId: string, name: string) {
  console.log(`\n🔒 Closing ${name} (${pollId})...`);

  const response = await fetch(`${API_BASE}/polls/${pollId}/close`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();
  console.log(`Status: ${response.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));

  return response.ok;
}

async function distributePoll(pollId: string, name: string) {
  console.log(`\n💰 Distributing ${name} (${pollId})...`);

  const response = await fetch(`${API_BASE}/polls/${pollId}/distribute`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();
  console.log(`Status: ${response.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));

  return { ok: response.ok, data };
}

async function main() {
  console.log("=".repeat(60));
  console.log("POLL CLOSE & DISTRIBUTE FLOW");
  console.log("=".repeat(60));

  // Step 1: Close both polls
  console.log("\n📋 STEP 1: CLOSING POLLS");
  console.log("-".repeat(40));

  const poll1Closed = await closePoll(POLL_1_ID, "Poll 1 (Veterans in Nevada)");
  const poll3Closed = await closePoll(POLL_3_ID, "Poll 3 (Las Vegas Food Service)");

  if (!poll1Closed || !poll3Closed) {
    console.log("\n⚠️ Some polls may already be closed or there was an error.");
  }

  // Step 2: Distribute funds
  console.log("\n📋 STEP 2: DISTRIBUTING FUNDS");
  console.log("-".repeat(40));

  const dist1 = await distributePoll(POLL_1_ID, "Poll 1");
  const dist3 = await distributePoll(POLL_3_ID, "Poll 3");

  // Step 3: Summary
  console.log("\n📋 STEP 3: DISTRIBUTION SUMMARY");
  console.log("-".repeat(40));

  if (dist1.ok && dist1.data.payouts) {
    console.log("\nPoll 1 Payouts:");
    for (const payout of dist1.data.payouts) {
      console.log(`  - ${payout.recipientWallet}: ${payout.amountUsdc} USDC`);
      if (payout.txHash) {
        console.log(`    TX: https://sepolia.basescan.org/tx/${payout.txHash}`);
      }
    }
  }

  if (dist3.ok && dist3.data.payouts) {
    console.log("\nPoll 3 Payouts:");
    for (const payout of dist3.data.payouts) {
      console.log(`  - ${payout.recipientWallet}: ${payout.amountUsdc} USDC`);
      if (payout.txHash) {
        console.log(`    TX: https://sepolia.basescan.org/tx/${payout.txHash}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("DONE");
}

main().catch(console.error);
