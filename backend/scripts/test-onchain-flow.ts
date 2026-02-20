/**
 * Full Poll Lifecycle Test on Base Sepolia
 *
 * This script tests the complete poll lifecycle:
 * 1. Create a poll with USDC funding
 * 2. Provision agent wallets
 * 3. Agents submit responses with attestations
 * 4. Close the poll
 * 5. Distribute rewards to participants
 *
 * Run with: npx tsx scripts/test-onchain-flow.ts
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
  {
    name: "calculatePayout",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [{ name: "payoutPerPerson", type: "uint256" }],
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
    name: "PollClosed",
    type: "event",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "closedBy", type: "address", indexed: true },
      { name: "finalParticipantCount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "FundsDistributed",
    type: "event",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "participantCount", type: "uint256", indexed: false },
      { name: "payoutPerPerson", type: "uint256", indexed: false },
      { name: "returnedToCreator", type: "uint256", indexed: false },
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
  console.log("║          POLL IN CASH - FULL ON-CHAIN LIFECYCLE TEST         ║");
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

  // ============ Step 1: Create Creator Wallet ============
  console.log("=== STEP 1: Create Creator Wallet ===\n");

  const creatorWallet = await createCdpWallet(deterministicUUID("poll-test-creator-wallet-v1"));
  const creatorAddress = (await creatorWallet.getAddress()) as Address;

  console.log(`Creator Wallet: ${creatorAddress}`);
  console.log(`BaseScan: ${baseScanAddressLink(creatorAddress)}\n`);

  // ============ Step 2: Check Balances ============
  console.log("=== STEP 2: Check Balances ===\n");

  const ethBalance = await publicClient.getBalance({ address: creatorAddress });
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log(`ETH Balance: ${formatUnits(ethBalance, 18)} ETH`);
  console.log(`USDC Balance: ${formatUSDC(usdcBalance)} USDC\n`);

  // Check if we have enough for the test
  const requiredUSDC = parseUSDC("10"); // 10 USDC for the test poll

  if (ethBalance < parseUnits("0.001", 18)) {
    console.error(
      "ERROR: Insufficient ETH for gas.\n" +
        "Please get test ETH from: https://www.coinbase.com/faucets/base-sepolia\n" +
        `Send to: ${creatorAddress}`
    );
    process.exit(1);
  }

  if (usdcBalance < requiredUSDC) {
    console.error(
      `ERROR: Insufficient USDC. Have ${formatUSDC(usdcBalance)}, need ${formatUSDC(requiredUSDC)}.\n` +
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
  console.log(
    `Note: For this test, we'll use the creator wallet as the attestation signer.`
  );
  console.log(
    `In production, the backend service would sign attestations.\n`
  );

  // Check if creator is the attestation signer (for testing purposes)
  const isAttestationSigner =
    attestationSigner.toLowerCase() === creatorAddress.toLowerCase();

  if (!isAttestationSigner) {
    console.warn(
      "WARNING: Creator wallet is not the attestation signer.\n" +
        "Responses will fail attestation verification.\n" +
        "For testing, ensure the contract's attestation signer matches the test wallet.\n"
    );
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

  console.log(`Approve TX: ${approveTxHash}`);
  console.log(`BaseScan: ${baseScanLink(approveTxHash)}\n`);

  // Wait for approval confirmation
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveTxHash as Hex,
  });
  console.log(`Approval confirmed in block ${approveReceipt.blockNumber}\n`);

  // ============ Step 5: Create Poll ============
  console.log("=== STEP 5: Create Poll ===\n");

  const pollTitle = `Test Poll ${Date.now()}`;
  const criteriaHash = keccak256(toBytes("age:18-35,location:USA"));
  const participantCap = 3n;
  const duration = 3600n; // 1 hour
  const fundAmount = requiredUSDC;

  console.log(`Title: ${pollTitle}`);
  console.log(`Participant Cap: ${participantCap}`);
  console.log(`Duration: ${duration} seconds`);
  console.log(`Fund Amount: ${formatUSDC(fundAmount)} USDC`);
  console.log(
    `Distributable (after 10% fee): ${formatUSDC((fundAmount * 90n) / 100n)} USDC\n`
  );

  const createPollData = encodeFunctionData({
    abi: POLL_POOL_ABI,
    functionName: "createPoll",
    args: [pollTitle, criteriaHash, participantCap, duration, fundAmount],
  });

  const createPollTxHash = await creatorWallet.sendTransaction({
    to: POLL_POOL_ADDRESS,
    data: createPollData,
  });

  console.log(`Create Poll TX: ${createPollTxHash}`);
  console.log(`BaseScan: ${baseScanLink(createPollTxHash)}\n`);

  // Wait for confirmation and get poll ID from event
  const createPollReceipt = await publicClient.waitForTransactionReceipt({
    hash: createPollTxHash as Hex,
  });

  // Parse PollCreated event to get pollId
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
        console.log(`Poll Created! ID: ${pollId}`);
        console.log(`Block: ${createPollReceipt.blockNumber}\n`);
        break;
      }
    } catch {
      // Not a PollCreated event, skip
    }
  }

  if (pollId === undefined) {
    console.error("ERROR: Could not find PollCreated event");
    process.exit(1);
  }

  // ============ Step 6: Create Agent Wallets ============
  console.log("=== STEP 6: Create Agent Wallets ===\n");

  const agentWallets: CdpEvmWalletProvider[] = [];
  const agentAddresses: Address[] = [];

  for (let i = 0; i < 3; i++) {
    console.log(`Creating Agent Wallet ${i + 1}...`);
    const agentWallet = await createCdpWallet(deterministicUUID(`poll-test-agent-${i}-v1`));
    const agentAddress = (await agentWallet.getAddress()) as Address;

    agentWallets.push(agentWallet);
    agentAddresses.push(agentAddress);

    console.log(`  Address: ${agentAddress}`);
    console.log(`  BaseScan: ${baseScanAddressLink(agentAddress)}\n`);
  }

  // ============ Step 7: Fund Agent Wallets with ETH for Gas ============
  console.log("=== STEP 7: Fund Agent Wallets with ETH ===\n");

  const ethToSend = parseUnits("0.0005", 18); // 0.0005 ETH each for gas

  for (let i = 0; i < agentAddresses.length; i++) {
    console.log(`Funding Agent ${i + 1} with ${formatUnits(ethToSend, 18)} ETH...`);

    const fundTxHash = await creatorWallet.sendTransaction({
      to: agentAddresses[i],
      value: ethToSend,
    });

    console.log(`  TX: ${fundTxHash}`);
    console.log(`  BaseScan: ${baseScanLink(fundTxHash)}\n`);

    await publicClient.waitForTransactionReceipt({ hash: fundTxHash as Hex });
  }

  // ============ Step 8: Agents Submit Responses ============
  console.log("=== STEP 8: Agents Submit Responses ===\n");

  if (!isAttestationSigner) {
    console.log("SKIPPING: Creator is not attestation signer, cannot create valid attestations.\n");
    console.log("To test response submission, ensure the contract's attestation signer");
    console.log("is set to the test wallet address.\n");
  } else {
    for (let i = 0; i < agentWallets.length; i++) {
      console.log(`Agent ${i + 1} submitting response...`);

      // Create attestation signature
      const attestation = await createAttestation(
        creatorWallet, // Attestation signer
        pollId,
        agentAddresses[i],
        POLL_POOL_ADDRESS
      );

      console.log(`  Attestation: ${attestation.slice(0, 20)}...`);

      const submitData = encodeFunctionData({
        abi: POLL_POOL_ABI,
        functionName: "submitResponse",
        args: [pollId, attestation],
      });

      const submitTxHash = await agentWallets[i].sendTransaction({
        to: POLL_POOL_ADDRESS,
        data: submitData,
      });

      console.log(`  TX: ${submitTxHash}`);
      console.log(`  BaseScan: ${baseScanLink(submitTxHash)}\n`);

      const submitReceipt = await publicClient.waitForTransactionReceipt({
        hash: submitTxHash as Hex,
      });

      // Parse event
      for (const log of submitReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: POLL_POOL_EVENTS,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "ResponseSubmitted") {
            const args = decoded.args as { participantNumber: bigint };
            console.log(`  Response recorded! Participant #${args.participantNumber}\n`);
            break;
          }
        } catch {
          // Not our event
        }
      }
    }
  }

  // ============ Step 9: Check Poll State ============
  console.log("=== STEP 9: Check Poll State ===\n");

  const pollData = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "getPoll",
    args: [pollId],
  });

  const statusNames = ["Active", "Closed", "Distributed", "Cancelled"];

  console.log(`Poll ID: ${pollId}`);
  console.log(`Title: ${pollData.title}`);
  console.log(`Status: ${statusNames[pollData.status]}`);
  console.log(`Participant Count: ${pollData.participantCount}`);
  console.log(`Participant Cap: ${pollData.participantCap}`);
  console.log(`Total Funded: ${formatUSDC(pollData.totalFunded)} USDC`);
  console.log(`Distributable Pool: ${formatUSDC(pollData.distributablePool)} USDC`);
  console.log(`Expires At: ${new Date(Number(pollData.expiresAt) * 1000).toISOString()}\n`);

  // Get participants
  const participantsList = await publicClient.readContract({
    address: POLL_POOL_ADDRESS,
    abi: POLL_POOL_ABI,
    functionName: "getParticipants",
    args: [pollId],
  });

  console.log(`Participants (${participantsList.length}):`);
  participantsList.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p}`);
  });
  console.log();

  // ============ Step 10: Close Poll ============
  console.log("=== STEP 10: Close Poll ===\n");

  const closeData = encodeFunctionData({
    abi: POLL_POOL_ABI,
    functionName: "closePoll",
    args: [pollId],
  });

  const closeTxHash = await creatorWallet.sendTransaction({
    to: POLL_POOL_ADDRESS,
    data: closeData,
  });

  console.log(`Close Poll TX: ${closeTxHash}`);
  console.log(`BaseScan: ${baseScanLink(closeTxHash)}\n`);

  const closeReceipt = await publicClient.waitForTransactionReceipt({
    hash: closeTxHash as Hex,
  });

  for (const log of closeReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLL_POOL_EVENTS,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PollClosed") {
        const args = decoded.args as { finalParticipantCount: bigint };
        console.log(`Poll closed with ${args.finalParticipantCount} participants\n`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  // ============ Step 11: Distribute Rewards ============
  console.log("=== STEP 11: Distribute Rewards ===\n");

  // Record balances before distribution
  const creatorBalanceBefore = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  const agentBalancesBefore: bigint[] = [];
  for (const addr of agentAddresses) {
    const bal = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [addr],
    });
    agentBalancesBefore.push(bal);
  }

  const distributeData = encodeFunctionData({
    abi: POLL_POOL_ABI,
    functionName: "distribute",
    args: [pollId],
  });

  const distributeTxHash = await creatorWallet.sendTransaction({
    to: POLL_POOL_ADDRESS,
    data: distributeData,
  });

  console.log(`Distribute TX: ${distributeTxHash}`);
  console.log(`BaseScan: ${baseScanLink(distributeTxHash)}\n`);

  const distributeReceipt = await publicClient.waitForTransactionReceipt({
    hash: distributeTxHash as Hex,
  });

  for (const log of distributeReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLL_POOL_EVENTS,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "FundsDistributed") {
        const args = decoded.args as {
          participantCount: bigint;
          payoutPerPerson: bigint;
          returnedToCreator: bigint;
        };
        console.log(`Funds Distributed!`);
        console.log(`  Participants: ${args.participantCount}`);
        console.log(`  Payout Per Person: ${formatUSDC(args.payoutPerPerson)} USDC`);
        console.log(`  Returned to Creator: ${formatUSDC(args.returnedToCreator)} USDC\n`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  // ============ Step 12: Verify Final Balances ============
  console.log("=== STEP 12: Verify Final Balances ===\n");

  const creatorBalanceAfter = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [creatorAddress],
  });

  console.log(`Creator USDC Balance:`);
  console.log(`  Before Distribution: ${formatUSDC(creatorBalanceBefore)} USDC`);
  console.log(`  After Distribution:  ${formatUSDC(creatorBalanceAfter)} USDC`);
  console.log(
    `  Change: ${formatUSDC(creatorBalanceAfter - creatorBalanceBefore)} USDC\n`
  );

  console.log(`Agent USDC Balances:`);
  for (let i = 0; i < agentAddresses.length; i++) {
    const balanceAfter = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [agentAddresses[i]],
    });

    console.log(`  Agent ${i + 1} (${agentAddresses[i].slice(0, 10)}...):`);
    console.log(`    Before: ${formatUSDC(agentBalancesBefore[i])} USDC`);
    console.log(`    After:  ${formatUSDC(balanceAfter)} USDC`);
    console.log(`    Received: ${formatUSDC(balanceAfter - agentBalancesBefore[i])} USDC`);
  }

  // ============ Summary ============
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                      TEST SUMMARY                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("Transaction Hashes:");
  console.log(`  1. Approve USDC:     ${approveTxHash}`);
  console.log(`  2. Create Poll:      ${createPollTxHash}`);
  console.log(`  3. Close Poll:       ${closeTxHash}`);
  console.log(`  4. Distribute:       ${distributeTxHash}`);

  console.log("\nBaseScan Links:");
  console.log(`  Approve:    ${baseScanLink(approveTxHash)}`);
  console.log(`  Create:     ${baseScanLink(createPollTxHash)}`);
  console.log(`  Close:      ${baseScanLink(closeTxHash)}`);
  console.log(`  Distribute: ${baseScanLink(distributeTxHash)}`);

  console.log("\nContract:");
  console.log(`  PollPool: ${baseScanAddressLink(POLL_POOL_ADDRESS)}`);

  console.log("\nWallets:");
  console.log(`  Creator: ${baseScanAddressLink(creatorAddress)}`);
  agentAddresses.forEach((addr, i) => {
    console.log(`  Agent ${i + 1}: ${baseScanAddressLink(addr)}`);
  });

  console.log("\n=== TEST COMPLETE ===\n");
}

main().catch((error) => {
  console.error("Test failed with error:", error);
  process.exit(1);
});
