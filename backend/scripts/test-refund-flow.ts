/**
 * Poll Refund/Cancel Flow Test on Base Sepolia
 *
 * This script tests the poll cancellation and refund flow:
 * 1. Create a poll with 50 USDC funding
 * 2. Have 1 agent submit a response
 * 3. Creator calls refund() to cancel the poll
 * 4. Verify creator gets remaining funds back
 *
 * Run with: npx tsx scripts/test-refund-flow.ts
 *
 * Prerequisites:
 * - Set CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET in .env
 * - Creator wallet needs USDC (get from https://faucet.circle.com/)
 * - Creator wallet needs ETH for gas (get from https://www.coinbase.com/faucets/base-sepolia)
 */

import "dotenv/config";
import { createHash } from "crypto";
import { CdpEvmWalletProvider } from "@coinbase/agentkit";
import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  decodeEventLog,
  type Hex,
  type Address,
  keccak256,
  toBytes,
  concat,
  numberToHex,
  pad,
} from "viem";
import { baseSepolia } from "viem/chains";

/**
 * Generate a deterministic UUID v4 from a string seed.
 * This allows us to get the same wallet on repeated runs.
 */
function deterministicUUID(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex");
  // Format as UUID v4: 8-4-4-4-12, with version bits set
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16), // Version 4
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // Variant bits
    hash.slice(20, 32),
  ].join("-");
}

// ============ Contract Addresses ============

const POLL_POOL_ADDRESS = "0xf6fea61ac2d3bfc57bb63048594a203970580bd6" as const;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

// ============ Contract ABIs ============

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
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

const POLL_POOL_ABI = [
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
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getPoll",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
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
  {
    name: "attestationSigner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "nextPollId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const POLL_POOL_EVENTS = [
  {
    name: "PollCreated",
    type: "event",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "title", type: "string", indexed: false },
      { name: "criteriaHash", type: "bytes32", indexed: false },
      { name: "totalFunded", type: "uint256", indexed: false },
      { name: "distributablePool", type: "uint256", indexed: false },
      { name: "participantCap", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ResponseSubmitted",
    type: "event",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "participant", type: "address", indexed: true },
      { name: "participantNumber", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PollCancelled",
    type: "event",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "refundedAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

// ============ Helper Functions ============

function baseScanLink(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

function baseScanAddressLink(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

function formatUSDC(amount: bigint): string {
  return formatUnits(amount, 6);
}

function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}

/**
 * Create CDP wallet provider
 */
async function createCdpWallet(
  idempotencyKey?: string
): Promise<CdpEvmWalletProvider> {
  return CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: "base-sepolia",
    idempotencyKey,
  });
}

/**
 * Create attestation signature for a participant
 * The message format: keccak256(abi.encodePacked(pollId, participant, contractAddress))
 */
async function createAttestation(
  signerWallet: CdpEvmWalletProvider,
  pollId: bigint,
  participant: Address,
  contractAddress: Address
): Promise<Hex> {
  // Create the message hash that the contract expects
  // keccak256(abi.encodePacked(pollId, participant, contractAddress))
  const pollIdHex = pad(numberToHex(pollId), { size: 32 });
  const messageHash = keccak256(
    concat([pollIdHex, participant as Hex, contractAddress as Hex])
  );

  // Sign the message using EIP-191 personal sign (which adds the Ethereum prefix)
  const signature = await signerWallet.signMessage(messageHash);

  return signature as Hex;
}

// ============ Main Test Flow ============

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           POLL IN CASH - REFUND/CANCEL FLOW TEST             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Validate environment variables
  if (
    !process.env.CDP_API_KEY_ID ||
    !process.env.CDP_API_KEY_SECRET ||
    !process.env.CDP_WALLET_SECRET
  ) {
    console.error(
      "ERROR: Missing required environment variables.\n" +
        "Please set CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET in .env"
    );
    process.exit(1);
  }

  // Create public client for reading chain state
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // Transaction hash collector for summary
  const txHashes: Record<string, string> = {};

  // ============ Step 1: Create Creator Wallet ============
  console.log("=== STEP 1: Create Creator Wallet ===\n");

  const creatorWallet = await createCdpWallet(deterministicUUID("poll-refund-test-creator-v1"));
  const creatorAddress = (await creatorWallet.getAddress()) as Address;

  console.log(`Creator Wallet: ${creatorAddress}`);
  console.log(`BaseScan: ${baseScanAddressLink(creatorAddress)}\n`);

  // ============ Step 2: Check Balances ============
  console.log("=== STEP 2: Check Initial Balances ===\n");

  const ethBalance = await publicClient.getBalance({ address: creatorAddress });
  const usdcBalanceInitial = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log(`ETH Balance: ${formatUnits(ethBalance, 18)} ETH`);
  console.log(`USDC Balance: ${formatUSDC(usdcBalanceInitial)} USDC\n`);

  // Check if we have enough for the test
  const requiredUSDC = parseUSDC("50"); // 50 USDC for the test poll

  if (ethBalance < parseUnits("0.001", 18)) {
    console.error(
      "ERROR: Insufficient ETH for gas.\n" +
        "Please get test ETH from: https://www.coinbase.com/faucets/base-sepolia\n" +
        `Send to: ${creatorAddress}`
    );
    process.exit(1);
  }

  if (usdcBalanceInitial < requiredUSDC) {
    console.error(
      `ERROR: Insufficient USDC. Have ${formatUSDC(usdcBalanceInitial)}, need ${formatUSDC(requiredUSDC)}.\n` +
        "Please get test USDC from: https://faucet.circle.com/\n" +
        `Send to: ${creatorAddress}`
    );
    process.exit(1);
  }

  // ============ Step 3: Check Attestation Signer ============
  console.log("=== STEP 3: Check Contract Configuration ===\n");

  const attestationSigner = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "attestationSigner",
  });

  console.log(`Attestation Signer: ${attestationSigner}`);

  const isAttestationSigner =
    attestationSigner.toLowerCase() === creatorAddress.toLowerCase();

  if (!isAttestationSigner) {
    console.log(
      "\nNOTE: Creator is not attestation signer. Will skip agent response submission."
    );
    console.log("The refund test will still work with 0 participants.\n");
  } else {
    console.log("Creator is attestation signer - can sign attestations for test.\n");
  }

  // ============ Step 4: Approve USDC ============
  console.log("=== STEP 4: Approve USDC for PollPool ===\n");

  const approveData = encodeFunctionData({
    abi: USDC_ABI,
    functionName: "approve",
    args: [POLL_POOL_ADDRESS, requiredUSDC],
  });

  console.log(`Approving ${formatUSDC(requiredUSDC)} USDC...`);

  const approveTxHash = await creatorWallet.sendTransaction({
    to: USDC_ADDRESS,
    data: approveData,
  });
  txHashes.approve = approveTxHash;

  console.log(`Approve TX: ${approveTxHash}`);
  console.log(`BaseScan: ${baseScanLink(approveTxHash)}\n`);

  await publicClient.waitForTransactionReceipt({
    hash: approveTxHash as Hex,
  });
  console.log("Approval confirmed.\n");

  // ============ Step 5: Create Poll with 50 USDC ============
  console.log("=== STEP 5: Create Poll with 50 USDC ===\n");

  const pollTitle = `Refund Test Poll ${Date.now()}`;
  const criteriaHash = keccak256(toBytes("test:refund-flow"));
  const participantCap = 10n;
  const duration = 3600n; // 1 hour
  const fundAmount = requiredUSDC;

  const platformFee = (fundAmount * 10n) / 100n; // 10% fee = 5 USDC
  const distributablePool = fundAmount - platformFee; // 45 USDC

  console.log(`Title: ${pollTitle}`);
  console.log(`Fund Amount: ${formatUSDC(fundAmount)} USDC`);
  console.log(`Platform Fee (10%): ${formatUSDC(platformFee)} USDC`);
  console.log(`Distributable Pool: ${formatUSDC(distributablePool)} USDC`);
  console.log(`Participant Cap: ${participantCap}\n`);

  const createPollData = encodeFunctionData({
    abi: POLL_POOL_ABI,
    functionName: "createPoll",
    args: [pollTitle, criteriaHash, participantCap, duration, fundAmount],
  });

  const createPollTxHash = await creatorWallet.sendTransaction({
    to: POLL_POOL_ADDRESS,
    data: createPollData,
  });
  txHashes.createPoll = createPollTxHash;

  console.log(`Create Poll TX: ${createPollTxHash}`);
  console.log(`BaseScan: ${baseScanLink(createPollTxHash)}\n`);

  const createPollReceipt = await publicClient.waitForTransactionReceipt({
    hash: createPollTxHash as Hex,
  });

  // Parse PollCreated event
  let pollId: bigint | undefined;

  for (const log of createPollReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLL_POOL_EVENTS,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PollCreated") {
        pollId = (decoded.args as { pollId: bigint }).pollId;
        console.log(`Poll Created! ID: ${pollId}\n`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  if (pollId === undefined) {
    console.error("ERROR: Could not find PollCreated event");
    process.exit(1);
  }

  // Record balance after poll creation (should be reduced by 50 USDC)
  const usdcBalanceAfterCreate = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log(`Creator USDC after poll creation: ${formatUSDC(usdcBalanceAfterCreate)} USDC`);
  console.log(
    `USDC spent: ${formatUSDC(usdcBalanceInitial - usdcBalanceAfterCreate)} USDC\n`
  );

  // ============ Step 6: Create Agent and Submit Response (Optional) ============
  console.log("=== STEP 6: Agent Submits Response (if possible) ===\n");

  let agentAddress: Address | undefined;
  let agentWallet: CdpEvmWalletProvider | undefined;

  if (isAttestationSigner) {
    // Create agent wallet
    console.log("Creating agent wallet...");
    agentWallet = await createCdpWallet(deterministicUUID("poll-refund-test-agent-v1"));
    agentAddress = (await agentWallet.getAddress()) as Address;

    console.log(`Agent Wallet: ${agentAddress}`);
    console.log(`BaseScan: ${baseScanAddressLink(agentAddress)}\n`);

    // Fund agent with ETH for gas
    console.log("Funding agent with ETH for gas...");
    const ethToSend = parseUnits("0.0005", 18);

    const fundTxHash = await creatorWallet.sendTransaction({
      to: agentAddress,
      value: ethToSend,
    });
    txHashes.fundAgent = fundTxHash;

    console.log(`Fund TX: ${fundTxHash}`);
    console.log(`BaseScan: ${baseScanLink(fundTxHash)}\n`);

    await publicClient.waitForTransactionReceipt({ hash: fundTxHash as Hex });

    // Submit response
    console.log("Agent submitting response...");

    const attestation = await createAttestation(
      creatorWallet,
      pollId,
      agentAddress,
      POLL_POOL_ADDRESS
    );

    const submitData = encodeFunctionData({
      abi: POLL_POOL_ABI,
      functionName: "submitResponse",
      args: [pollId, attestation],
    });

    const submitTxHash = await agentWallet.sendTransaction({
      to: POLL_POOL_ADDRESS,
      data: submitData,
    });
    txHashes.submitResponse = submitTxHash;

    console.log(`Submit Response TX: ${submitTxHash}`);
    console.log(`BaseScan: ${baseScanLink(submitTxHash)}\n`);

    const submitReceipt = await publicClient.waitForTransactionReceipt({
      hash: submitTxHash as Hex,
    });

    for (const log of submitReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: POLL_POOL_EVENTS,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "ResponseSubmitted") {
          const args = decoded.args as { participantNumber: bigint };
          console.log(`Response recorded! Participant #${args.participantNumber}\n`);
          break;
        }
      } catch {
        // Not our event
      }
    }
  } else {
    console.log("Skipping agent response - creator is not attestation signer.");
    console.log("Poll will be refunded with 0 participants.\n");
  }

  // ============ Step 7: Check Poll State Before Refund ============
  console.log("=== STEP 7: Poll State Before Refund ===\n");

  const pollDataBeforeRefund = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "getPoll",
    args: [pollId],
  });

  const statusNames = ["Active", "Closed", "Distributed", "Cancelled"];

  console.log(`Poll ID: ${pollId}`);
  console.log(`Status: ${statusNames[pollDataBeforeRefund.status]}`);
  console.log(`Participant Count: ${pollDataBeforeRefund.participantCount}`);
  console.log(`Total Funded: ${formatUSDC(pollDataBeforeRefund.totalFunded)} USDC`);
  console.log(`Distributable Pool: ${formatUSDC(pollDataBeforeRefund.distributablePool)} USDC`);

  const participants = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "getParticipants",
    args: [pollId],
  });

  if (participants.length > 0) {
    console.log(`\nParticipants:`);
    participants.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p}`);
    });
  }
  console.log();

  // ============ Step 8: Call Refund ============
  console.log("=== STEP 8: Creator Calls Refund ===\n");

  const usdcBalanceBeforeRefund = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log(`Creator USDC before refund: ${formatUSDC(usdcBalanceBeforeRefund)} USDC`);
  console.log(`Expected refund: ${formatUSDC(pollDataBeforeRefund.distributablePool)} USDC\n`);

  const refundData = encodeFunctionData({
    abi: POLL_POOL_ABI,
    functionName: "refund",
    args: [pollId],
  });

  const refundTxHash = await creatorWallet.sendTransaction({
    to: POLL_POOL_ADDRESS,
    data: refundData,
  });
  txHashes.refund = refundTxHash;

  console.log(`Refund TX: ${refundTxHash}`);
  console.log(`BaseScan: ${baseScanLink(refundTxHash)}\n`);

  const refundReceipt = await publicClient.waitForTransactionReceipt({
    hash: refundTxHash as Hex,
  });

  // Parse PollCancelled event
  for (const log of refundReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLL_POOL_EVENTS,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PollCancelled") {
        const args = decoded.args as { refundedAmount: bigint };
        console.log(`Poll Cancelled!`);
        console.log(`Refunded Amount: ${formatUSDC(args.refundedAmount)} USDC\n`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  // ============ Step 9: Verify Final Balances ============
  console.log("=== STEP 9: Verify Final Balances ===\n");

  const usdcBalanceAfterRefund = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log("Creator USDC Balance Summary:");
  console.log(`  Initial:          ${formatUSDC(usdcBalanceInitial)} USDC`);
  console.log(`  After Poll Create: ${formatUSDC(usdcBalanceAfterCreate)} USDC`);
  console.log(`  After Refund:     ${formatUSDC(usdcBalanceAfterRefund)} USDC`);
  console.log();

  const actualRefund = usdcBalanceAfterRefund - usdcBalanceBeforeRefund;
  const platformFeePaid = usdcBalanceInitial - usdcBalanceAfterRefund;

  console.log("Financial Summary:");
  console.log(`  Amount Funded:    ${formatUSDC(fundAmount)} USDC`);
  console.log(`  Platform Fee:     ${formatUSDC(platformFee)} USDC (non-refundable)`);
  console.log(`  Refund Received:  ${formatUSDC(actualRefund)} USDC`);
  console.log(`  Net Cost:         ${formatUSDC(platformFeePaid)} USDC`);
  console.log();

  // Verify the refund math
  const expectedNetCost = platformFee; // Only the 10% platform fee is non-refundable
  const tolerance = parseUSDC("0.01"); // Allow tiny rounding

  if (platformFeePaid <= expectedNetCost + tolerance) {
    console.log("PASS: Refund amount is correct!");
    console.log(`  Creator only lost the platform fee (${formatUSDC(platformFee)} USDC)`);
  } else {
    console.log("WARNING: Refund amount differs from expected");
    console.log(`  Expected net cost: ${formatUSDC(expectedNetCost)} USDC`);
    console.log(`  Actual net cost: ${formatUSDC(platformFeePaid)} USDC`);
  }

  // ============ Step 10: Verify Poll State After Refund ============
  console.log("\n=== STEP 10: Poll State After Refund ===\n");

  const pollDataAfterRefund = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "getPoll",
    args: [pollId],
  });

  console.log(`Poll ID: ${pollId}`);
  console.log(`Status: ${statusNames[pollDataAfterRefund.status]}`);
  console.log(`Participant Count: ${pollDataAfterRefund.participantCount}`);

  if (pollDataAfterRefund.status === 3) {
    // Cancelled
    console.log("\nPASS: Poll status is Cancelled as expected");
  } else {
    console.log("\nWARNING: Poll status is not Cancelled");
  }

  // ============ Summary ============
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    REFUND TEST SUMMARY                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("Poll Details:");
  console.log(`  Poll ID: ${pollId}`);
  console.log(`  Title: ${pollTitle}`);
  console.log(`  Funded Amount: ${formatUSDC(fundAmount)} USDC`);
  console.log(`  Participants: ${pollDataAfterRefund.participantCount}`);

  console.log("\nFinancial Result:");
  console.log(`  Platform Fee Paid: ${formatUSDC(platformFee)} USDC`);
  console.log(`  Refunded: ${formatUSDC(actualRefund)} USDC`);

  console.log("\nTransaction Hashes:");
  Object.entries(txHashes).forEach(([name, hash]) => {
    console.log(`  ${name}: ${hash}`);
  });

  console.log("\nBaseScan Links:");
  Object.entries(txHashes).forEach(([name, hash]) => {
    console.log(`  ${name}: ${baseScanLink(hash)}`);
  });

  console.log("\nWallets:");
  console.log(`  Creator: ${baseScanAddressLink(creatorAddress)}`);
  if (agentAddress) {
    console.log(`  Agent: ${baseScanAddressLink(agentAddress)}`);
  }

  console.log("\nContract:");
  console.log(`  PollPool: ${baseScanAddressLink(POLL_POOL_ADDRESS)}`);

  console.log("\n=== REFUND TEST COMPLETE ===\n");
}

main().catch((error) => {
  console.error("Test failed with error:", error);
  process.exit(1);
});
