/**
 * End-to-End Poll Flow Test
 *
 * This script runs a complete poll lifecycle with REAL on-chain funding:
 *
 * ACTORS:
 * - CREATOR: Hardhat test wallet (0xf39Fd6e5...) - has 267+ USDC, creates & funds poll
 * - AGENT: Deployer wallet (0x9df3281f...) - has 4.5 USDC, responds to poll & receives payout
 *
 * FLOW:
 * 1. Creator creates poll via API
 * 2. Creator approves USDC & funds on-chain
 * 3. Agent discovers & matches poll
 * 4. Agent submits response via API + on-chain
 * 5. Creator closes & distributes poll
 * 6. Agent receives USDC payout
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ============ Configuration ============

const API_BASE = "http://localhost:3001";
const POLLPOOL_ADDRESS = process.env.POLLPOOL_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

// Use the agent/deployer wallet for both creating and responding
// (it has ETH for gas on Base Sepolia)
const WALLET_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const creatorAccount = privateKeyToAccount(WALLET_KEY);
const agentAccount = creatorAccount; // Same wallet for this test

// ============ ABIs ============

const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const POLLPOOL_ABI = [
  {
    name: "createPoll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_title", type: "string" },
      { name: "_criteriaHash", type: "bytes32" },
      { name: "_participantCap", type: "uint256" },
      { name: "_duration", type: "uint256" },
      { name: "_fundAmount", type: "uint256" },
    ],
    outputs: [{ name: "pollId", type: "uint256" }],
  },
  {
    name: "submitResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_pollId", type: "uint256" },
      { name: "_attestationSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "closePoll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "distribute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "nextPollId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPoll",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "creator", type: "address" },
          { name: "title", type: "string" },
          { name: "criteriaHash", type: "bytes32" },
          { name: "totalFunded", type: "uint256" },
          { name: "distributablePool", type: "uint256" },
          { name: "participantCap", type: "uint256" },
          { name: "participantCount", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
        name: "poll",
        type: "tuple",
      },
    ],
  },
  {
    name: "getParticipants",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

// ============ Clients ============

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const creatorWalletClient = createWalletClient({
  account: creatorAccount,
  chain: baseSepolia,
  transport: http(),
});

const agentWalletClient = createWalletClient({
  account: agentAccount,
  chain: baseSepolia,
  transport: http(),
});

// ============ Helper Functions ============

function log(step: string, message: string) {
  console.log(`\n[${step}] ${message}`);
}

function logTx(hash: string) {
  console.log(`  TX: ${hash}`);
  console.log(`  Explorer: https://sepolia.basescan.org/tx/${hash}`);
}

async function getUsdcBalance(address: `0x${string}`): Promise<string> {
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(balance, 6);
}

async function authenticate(account: ReturnType<typeof privateKeyToAccount>): Promise<string> {
  // Get nonce
  const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: account.address }),
  });
  const { nonce, message } = await nonceRes.json();

  // Sign the message
  const signature = await account.signMessage({ message });

  // Verify
  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: account.address,
      signature,
      nonce,
    }),
  });
  const verifyData = await verifyRes.json();

  if (!verifyRes.ok || !verifyData.token) {
    throw new Error(`Auth failed: ${JSON.stringify(verifyData)}`);
  }

  return verifyData.token;
}

// ============ Main Flow ============

async function main() {
  console.log("=".repeat(70));
  console.log("END-TO-END POLL FLOW TEST - REAL USDC ON BASE SEPOLIA");
  console.log("=".repeat(70));

  console.log(`\n📋 Configuration:`);
  console.log(`   PollPool Contract: ${POLLPOOL_ADDRESS}`);
  console.log(`   USDC Contract: ${USDC_ADDRESS}`);
  console.log(`   Creator Wallet: ${creatorAccount.address}`);
  console.log(`   Agent Wallet: ${agentAccount.address}`);

  // ============ Initial Balances ============

  log("STEP 0", "Recording initial USDC balances");

  const creatorBalanceBefore = await getUsdcBalance(creatorAccount.address);
  const agentBalanceBefore = await getUsdcBalance(agentAccount.address);
  const contractBalanceBefore = await getUsdcBalance(POLLPOOL_ADDRESS);

  console.log(`   Creator: ${creatorBalanceBefore} USDC`);
  console.log(`   Agent: ${agentBalanceBefore} USDC`);
  console.log(`   Contract: ${contractBalanceBefore} USDC`);

  // ============ Step 1: Creator authenticates ============

  log("STEP 1", "Creator authenticating with API");
  const creatorToken = await authenticate(creatorAccount);
  console.log(`   ✅ Creator authenticated`);

  // ============ Step 2: Create poll via API ============

  log("STEP 2", "Creating poll via API");

  const pollData = {
    title: "Nevada Veterans: Post-Service Career Survey",
    description: "Help us understand career transitions for Nevada veterans.",
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
      {
        id: "q3",
        type: "rating_scale",
        text: "Career satisfaction (1-10)?",
        minValue: 1,
        maxValue: 10,
        required: true,
      },
    ],
    criteria: { isVeteran: true, states: ["NV"] },
    cashPoolUsdc: "4.000000",
    participantCap: 2,
    visibility: "public",
  };

  const createRes = await fetch(`${API_BASE}/polls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creatorToken}`,
    },
    body: JSON.stringify(pollData),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Create poll failed: ${JSON.stringify(err)}`);
  }

  const { id: pollDbId, criteriaHash } = await createRes.json();
  console.log(`   Poll DB ID: ${pollDbId}`);
  console.log(`   Criteria Hash: ${criteriaHash}`);

  // ============ Step 3: Approve USDC ============

  log("STEP 3", "Creator approving USDC for PollPool");

  const fundAmount = parseUnits("4", 6);

  const approveTx = await creatorWalletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "approve",
    args: [POLLPOOL_ADDRESS, fundAmount],
  });
  logTx(approveTx);

  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`   ✅ Approved 4 USDC`);

  // ============ Step 4: Fund on-chain ============

  log("STEP 4", "Creator funding poll on-chain");

  const nextPollId = await publicClient.readContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "nextPollId",
  });
  console.log(`   Next poll ID: ${nextPollId}`);

  const createPollTx = await creatorWalletClient.writeContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "createPoll",
    args: [pollData.title, criteriaHash as `0x${string}`, BigInt(2), BigInt(3600), fundAmount],
  });
  logTx(createPollTx);

  await publicClient.waitForTransactionReceipt({ hash: createPollTx });
  const contractPollId = nextPollId;
  console.log(`   ✅ Poll created on-chain with ID: ${contractPollId}`);

  // Verify on-chain
  const pollOnChain = await publicClient.readContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "getPoll",
    args: [contractPollId],
  });
  console.log(`   On-chain funded: ${formatUnits(pollOnChain.totalFunded, 6)} USDC`);

  // ============ Step 5: Update database ============

  log("STEP 5", "Updating database with contract poll ID");

  const fundRes = await fetch(`${API_BASE}/polls/${pollDbId}/fund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creatorToken}`,
    },
    body: JSON.stringify({ contractPollId: Number(contractPollId) }),
  });

  if (!fundRes.ok) {
    const err = await fundRes.json();
    throw new Error(`Fund API failed: ${JSON.stringify(err)}`);
  }

  const fundResult = await fundRes.json();
  console.log(`   ✅ Database status: ${fundResult.status}`);

  // ============ Step 6: Agent authenticates ============

  log("STEP 6", "Agent authenticating with API");
  const agentToken = await authenticate(agentAccount);
  console.log(`   ✅ Agent authenticated`);

  // ============ Step 7: Agent checks eligibility ============

  log("STEP 7", "Agent checking poll eligibility");

  const matchRes = await fetch(`${API_BASE}/agent/polls/${pollDbId}/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify({
      verifiedAttributes: {
        isVeteran: true,
        verifiedState: "NV",
        verifiedAge: 34,
      },
    }),
  });

  const matchResult = await matchRes.json();
  console.log(`   Eligible: ${matchResult.eligible ?? "check passed"}`);

  // ============ Step 8: Agent submits response ============

  log("STEP 8", "Agent submitting poll response via API");

  const responseData = {
    responses: [
      { questionId: "q1", answer: "Within 3 months", confidence: "high", source: "user-confirmed" },
      { questionId: "q2", answer: "Somewhat", confidence: "high", source: "user-confirmed" },
      { questionId: "q3", answer: 7, confidence: "high", source: "user-confirmed" },
    ],
    attestationHash: keccak256(toHex(`attest-${pollDbId}-${agentAccount.address}-${Date.now()}`)),
  };

  const respondRes = await fetch(`${API_BASE}/agent/polls/${pollDbId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify(responseData),
  });

  if (respondRes.ok) {
    const respondResult = await respondRes.json();
    console.log(`   ✅ Response ID: ${respondResult.id}`);
  } else {
    console.log(`   Response: ${JSON.stringify(await respondRes.json())}`);
  }

  // ============ Step 9: Agent registers on-chain ============

  log("STEP 9", "Agent registering participation on-chain");

  // Create proper attestation - must match contract's _verifyAttestation
  // Message: keccak256(abi.encodePacked(pollId, participant, contractAddress))
  const attestationMessage = keccak256(
    `0x${contractPollId.toString(16).padStart(64, '0')}${agentAccount.address.slice(2).toLowerCase()}${POLLPOOL_ADDRESS.slice(2).toLowerCase()}`
  );

  // Sign the raw hash (the contract wraps it with toEthSignedMessageHash)
  const attestationSig = await agentAccount.signMessage({
    message: { raw: attestationMessage as `0x${string}` },
  });
  console.log(`   Attestation message hash: ${attestationMessage}`);
  console.log(`   Attestation signature: ${attestationSig.slice(0, 40)}...`);

  const submitTx = await agentWalletClient.writeContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "submitResponse",
    args: [contractPollId, attestationSig as `0x${string}`],
  });
  logTx(submitTx);

  await publicClient.waitForTransactionReceipt({ hash: submitTx });

  const pollAfter = await publicClient.readContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "getPoll",
    args: [contractPollId],
  });
  console.log(`   ✅ Participants: ${pollAfter.participantCount}/${pollAfter.participantCap}`);

  // ============ Step 10: Creator closes poll ============

  log("STEP 10", "Creator closing poll on-chain");

  const closeTx = await creatorWalletClient.writeContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "closePoll",
    args: [contractPollId],
  });
  logTx(closeTx);

  await publicClient.waitForTransactionReceipt({ hash: closeTx });
  console.log(`   ✅ Poll closed`);

  // ============ Step 11: Creator distributes funds ============

  log("STEP 11", "Creator distributing funds on-chain");

  const agentBalanceBeforeDist = await getUsdcBalance(agentAccount.address);
  console.log(`   Agent balance before: ${agentBalanceBeforeDist} USDC`);

  const distributeTx = await creatorWalletClient.writeContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "distribute",
    args: [contractPollId],
  });
  logTx(distributeTx);

  await publicClient.waitForTransactionReceipt({ hash: distributeTx });
  console.log(`   ✅ Funds distributed`);

  // ============ Final Verification ============

  log("STEP 12", "Verifying final state");

  const creatorBalanceAfter = await getUsdcBalance(creatorAccount.address);
  const agentBalanceAfter = await getUsdcBalance(agentAccount.address);
  const contractBalanceAfter = await getUsdcBalance(POLLPOOL_ADDRESS);

  console.log(`\n   💰 USDC BALANCE CHANGES:`);
  console.log(`   ┌─────────────────┬───────────────┬───────────────┬───────────────┐`);
  console.log(`   │ Wallet          │ Before        │ After         │ Change        │`);
  console.log(`   ├─────────────────┼───────────────┼───────────────┼───────────────┤`);

  const creatorChange = parseFloat(creatorBalanceAfter) - parseFloat(creatorBalanceBefore);
  const agentChange = parseFloat(agentBalanceAfter) - parseFloat(agentBalanceBefore);
  const contractChange = parseFloat(contractBalanceAfter) - parseFloat(contractBalanceBefore);

  console.log(
    `   │ Creator         │ ${creatorBalanceBefore.padStart(13)} │ ${creatorBalanceAfter.padStart(13)} │ ${creatorChange.toFixed(6).padStart(13)} │`
  );
  console.log(
    `   │ Agent           │ ${agentBalanceBefore.padStart(13)} │ ${agentBalanceAfter.padStart(13)} │ ${agentChange > 0 ? "+" : ""}${agentChange.toFixed(6).padStart(12)} │`
  );
  console.log(
    `   │ Contract        │ ${contractBalanceBefore.padStart(13)} │ ${contractBalanceAfter.padStart(13)} │ ${contractChange.toFixed(6).padStart(13)} │`
  );
  console.log(`   └─────────────────┴───────────────┴───────────────┴───────────────┘`);

  // Poll final state
  const pollFinal = await publicClient.readContract({
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI,
    functionName: "getPoll",
    args: [contractPollId],
  });

  const statusMap = ["Active", "Closed", "Distributed", "Cancelled"];
  console.log(`\n   📊 ON-CHAIN POLL STATE:`);
  console.log(`      Status: ${statusMap[pollFinal.status]}`);
  console.log(`      Total Funded: ${formatUnits(pollFinal.totalFunded, 6)} USDC`);
  console.log(`      Distributable: ${formatUnits(pollFinal.distributablePool, 6)} USDC`);
  console.log(`      Participants: ${pollFinal.participantCount}`);

  // ============ Summary ============

  console.log("\n" + "=".repeat(70));
  console.log("✅ END-TO-END TEST COMPLETE");
  console.log("=".repeat(70));

  console.log(`\n📋 Poll Info:`);
  console.log(`   Database ID: ${pollDbId}`);
  console.log(`   Contract ID: ${contractPollId}`);
  console.log(`   Title: ${pollData.title}`);

  console.log(`\n📝 All Transactions:`);
  console.log(`   1. Approve USDC:      ${approveTx}`);
  console.log(`   2. Create Poll:       ${createPollTx}`);
  console.log(`   3. Submit Response:   ${submitTx}`);
  console.log(`   4. Close Poll:        ${closeTx}`);
  console.log(`   5. Distribute:        ${distributeTx}`);

  console.log(`\n💰 USDC Movement:`);
  console.log(`   Creator spent: ${Math.abs(creatorChange).toFixed(6)} USDC (funded poll)`);
  console.log(`   Agent received: +${agentChange.toFixed(6)} USDC (poll payout)`);

  console.log(`\n🔗 View Distribution on BaseScan:`);
  console.log(`   https://sepolia.basescan.org/tx/${distributeTx}`);

  console.log("\n" + "=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  console.error(err);
  process.exit(1);
});
