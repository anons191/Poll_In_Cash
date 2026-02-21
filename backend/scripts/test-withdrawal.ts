/**
 * Test Withdrawal Flow
 *
 * Tests the complete withdrawal flow:
 * 1. Authenticate as the agent wallet
 * 2. Check balance
 * 3. Request withdrawal to creator wallet
 * 4. Verify transaction
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY!;
const CREATOR_WALLET = "0x9df3281Fe4403f60c99Da183efF960458Cd251b2";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getUsdcBalance(address: string): Promise<string> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  return formatUnits(balance, 6);
}

async function authenticate(walletAddress: string, privateKey: string): Promise<string> {
  // Step 1: Get nonce
  const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!nonceRes.ok) {
    throw new Error(`Nonce request failed: ${await nonceRes.text()}`);
  }

  const nonceData = await nonceRes.json() as { nonce: string; message: string };
  console.log(`  Got nonce: ${nonceData.nonce.slice(0, 40)}...`);

  // Step 2: Sign the full message (not just the nonce)
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signature = await account.signMessage({ message: nonceData.message });
  console.log(`  Signed: ${signature.slice(0, 20)}...`);

  // Step 3: Verify signature (send nonce, not message)
  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, signature, nonce: nonceData.nonce }),
  });

  if (!verifyRes.ok) {
    throw new Error(`Verify failed: ${await verifyRes.text()}`);
  }

  const { token } = await verifyRes.json() as { token: string };
  console.log(`  Got JWT token`);

  return token;
}

async function main() {
  console.log("=== WITHDRAWAL FLOW TEST ===\n");

  const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY as `0x${string}`);
  const agentWallet = agentAccount.address;

  console.log(`Agent Wallet: ${agentWallet}`);
  console.log(`Creator Wallet: ${CREATOR_WALLET}`);

  // Step 1: Check current balances
  console.log("\n📊 STEP 1: Check Initial Balances");
  const agentBalance = await getUsdcBalance(agentWallet);
  const creatorBalance = await getUsdcBalance(CREATOR_WALLET);
  console.log(`  Agent USDC: ${agentBalance}`);
  console.log(`  Creator USDC: ${creatorBalance}`);

  const agentBalanceNum = parseFloat(agentBalance);
  if (agentBalanceNum < 0.5) {
    console.log("\n❌ Agent has insufficient balance (need at least 0.50 USDC)");
    console.log("   Top up the agent wallet with testnet USDC first.");
    return;
  }

  // Step 2: Authenticate
  console.log("\n🔐 STEP 2: Authenticate as Agent");
  const token = await authenticate(agentWallet, AGENT_PRIVATE_KEY);

  // Step 3: Check balance via API
  console.log("\n💰 STEP 3: Check Balance via API");
  const balanceRes = await fetch(`${API_BASE}/agent/withdraw/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!balanceRes.ok) {
    console.log(`  Error: ${await balanceRes.text()}`);
    return;
  }

  const balanceData = await balanceRes.json();
  console.log(`  API Balance: ${JSON.stringify(balanceData)}`);

  // Step 4: Request withdrawal
  const withdrawAmount = "1.00"; // Withdraw 1.00 USDC
  console.log(`\n💸 STEP 4: Request Withdrawal of ${withdrawAmount} USDC`);

  const withdrawRes = await fetch(`${API_BASE}/agent/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: withdrawAmount,
      destinationAddress: CREATOR_WALLET,
      destinationType: "wallet",
    }),
  });

  const withdrawData = await withdrawRes.json();

  if (!withdrawRes.ok) {
    console.log(`  Error: ${JSON.stringify(withdrawData)}`);
    return;
  }

  console.log(`  Success: ${JSON.stringify(withdrawData, null, 2)}`);

  // Step 5: Verify final balances
  console.log("\n✅ STEP 5: Verify Final Balances");
  const finalAgentBalance = await getUsdcBalance(agentWallet);
  const finalCreatorBalance = await getUsdcBalance(CREATOR_WALLET);
  console.log(`  Agent USDC: ${finalAgentBalance} (was ${agentBalance})`);
  console.log(`  Creator USDC: ${finalCreatorBalance} (was ${creatorBalance})`);

  // Step 6: Check withdrawal history
  console.log("\n📋 STEP 6: Check Withdrawal History");
  const historyRes = await fetch(`${API_BASE}/agent/withdraw/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const historyData = await historyRes.json();
  console.log(`  History: ${JSON.stringify(historyData, null, 2)}`);

  console.log("\n=== TEST COMPLETE ===");
}

main().catch(console.error);
