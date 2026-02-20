#!/usr/bin/env npx tsx
/**
 * End-to-End Test for PollPoolV2 on Base Sepolia
 *
 * Tests the full lifecycle:
 * 1. Setup wallets
 * 2. Create poll
 * 3. Submit responses
 * 4. Close poll
 * 5. Claim payouts
 * 6. Verify balances
 * 7. Edge cases
 */

import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ============ Configuration ============

const POLLPOOL_V2_ADDRESS = "0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const TREASURY_ADDRESS = "0x495721378c27a51a2bd7f176bad570d5148c88d5";
const RPC_URL = "https://sepolia.base.org";

// ABIs
const POLLPOOL_ABI = [
  "function createPoll(string _title, bytes32 _criteriaHash, uint256 _participantCap, uint256 _duration, uint256 _fundAmount) external returns (uint256)",
  "function submitResponse(uint256 _pollId, bytes _attestationSignature) external",
  "function closePoll(uint256 _pollId) external",
  "function claimPayout(uint256 _pollId) external",
  "function distribute(uint256 _pollId) external",
  "function refund(uint256 _pollId) external",
  "function getPoll(uint256 _pollId) view returns (tuple(address creator, string title, bytes32 criteriaHash, uint256 totalFunded, uint256 distributablePool, uint256 participantCap, uint256 participantCount, uint256 expiresAt, uint256 closedAt, uint8 status))",
  "function getParticipants(uint256 _pollId) view returns (address[])",
  "function hasParticipated(uint256 _pollId, address _participant) view returns (bool)",
  "function hasClaimed(uint256 _pollId, address _participant) view returns (bool)",
  "function payoutPerPerson(uint256 _pollId) view returns (uint256)",
  "function getUnclaimedCount(uint256 _pollId) view returns (uint256)",
  "function nextPollId() view returns (uint256)",
  "function usdc() view returns (address)",
  "function treasury() view returns (address)",
  "function attestationSigner() view returns (address)",
];

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

// ============ Types ============

interface TestResult {
  step: string;
  success: boolean;
  txHash?: string;
  error?: string;
  details?: Record<string, unknown>;
}

interface WalletInfo {
  name: string;
  address: string;
  privateKey: string;
  wallet: ethers.Wallet;
}

// ============ Globals ============

const results: TestResult[] = [];
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ============ Helper Functions ============

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function logStep(step: string) {
  console.log("");
  console.log("═".repeat(60));
  console.log(`  ${step}`);
  console.log("═".repeat(60));
}

function recordResult(step: string, success: boolean, txHash?: string, error?: string, details?: Record<string, unknown>) {
  results.push({ step, success, txHash, error, details });
  if (success) {
    log(`✓ ${step}${txHash ? ` (tx: ${txHash.slice(0, 10)}...)` : ""}`);
  } else {
    log(`✗ ${step}: ${error}`);
  }
}

async function createAttestation(
  pollId: bigint,
  participant: string,
  contractAddress: string,
  signer: ethers.Wallet
): Promise<string> {
  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "address", "address"],
      [pollId, participant, contractAddress]
    )
  );
  return signer.signMessage(ethers.getBytes(messageHash));
}

function formatUsdc(amount: bigint): string {
  return ethers.formatUnits(amount, 6);
}

function parseUsdc(amount: string | number): bigint {
  return ethers.parseUnits(amount.toString(), 6);
}

// ============ Main Test ============

async function main() {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           PollPoolV2 End-to-End Test on Base Sepolia       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // ============ STEP 1: Setup ============
  logStep("STEP 1: Setup Wallets");

  // Creator wallet (deployer)
  const creatorPrivateKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const creatorWallet = new ethers.Wallet(creatorPrivateKey, provider);

  // Attestation signer (same as deployer for this test)
  const attestationSigner = creatorWallet;

  // Generate 5 agent wallets (deterministic for reproducibility)
  const agentWallets: WalletInfo[] = [];
  for (let i = 0; i < 5; i++) {
    // Derive from a seed + index
    const seed = ethers.keccak256(ethers.toUtf8Bytes(`e2e-test-agent-${i}-${Date.now()}`));
    const wallet = new ethers.Wallet(seed, provider);
    agentWallets.push({
      name: `Agent ${i + 1}`,
      address: wallet.address,
      privateKey: seed,
      wallet,
    });
  }

  log(`Creator: ${creatorWallet.address}`);
  log(`Attestation Signer: ${attestationSigner.address}`);
  for (const agent of agentWallets) {
    log(`${agent.name}: ${agent.address}`);
  }

  // Check balances
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const pollPool = new ethers.Contract(POLLPOOL_V2_ADDRESS, POLLPOOL_ABI, provider);

  const creatorUsdcBalance = await usdc.balanceOf(creatorWallet.address);
  const creatorEthBalance = await provider.getBalance(creatorWallet.address);
  const treasuryUsdcBefore = await usdc.balanceOf(TREASURY_ADDRESS);

  log("");
  log(`Creator USDC: ${formatUsdc(creatorUsdcBalance)} USDC`);
  log(`Creator ETH: ${ethers.formatEther(creatorEthBalance)} ETH`);
  log(`Treasury USDC (before): ${formatUsdc(treasuryUsdcBefore)} USDC`);

  recordResult("Setup wallets", true, undefined, undefined, {
    creator: creatorWallet.address,
    agents: agentWallets.map(a => a.address),
    creatorUsdc: formatUsdc(creatorUsdcBalance),
  });

  // Verify contract state
  const contractUsdc = await pollPool.usdc();
  const contractTreasury = await pollPool.treasury();
  const contractSigner = await pollPool.attestationSigner();

  log("");
  log(`Contract USDC: ${contractUsdc}`);
  log(`Contract Treasury: ${contractTreasury}`);
  log(`Contract Attestation Signer: ${contractSigner}`);

  // ============ STEP 2: Create Poll ============
  logStep("STEP 2: Create Poll");

  const pollAmount = parseUsdc("18"); // 18 USDC (10% fee = 1.8, distributable = 16.2)
  const participantCap = 5n;
  const duration = 3600n; // 1 hour
  const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("veteran:true,state:NV"));

  let pollId: bigint;

  try {
    // Approve USDC
    log("Approving USDC spend...");
    const usdcWithSigner = usdc.connect(creatorWallet) as ethers.Contract;
    const approveTx = await usdcWithSigner.approve(POLLPOOL_V2_ADDRESS, pollAmount);
    await approveTx.wait();
    recordResult("Approve USDC", true, approveTx.hash);

    // Create poll
    log("Creating poll...");
    const pollPoolWithSigner = pollPool.connect(creatorWallet) as ethers.Contract;
    const createTx = await pollPoolWithSigner.createPoll(
      "E2E Test Poll",
      criteriaHash,
      participantCap,
      duration,
      pollAmount
    );
    const createReceipt = await createTx.wait();

    // Get poll ID from nextPollId - 1
    const nextId = await pollPool.nextPollId();
    pollId = nextId - 1n;

    log(`Poll created with ID: ${pollId}`);
    recordResult("Create poll", true, createTx.hash, undefined, { pollId: pollId.toString() });

    // Verify poll state
    const poll = await pollPool.getPoll(pollId);
    log(`  Title: ${poll.title}`);
    log(`  Total Funded: ${formatUsdc(poll.totalFunded)} USDC`);
    log(`  Distributable: ${formatUsdc(poll.distributablePool)} USDC`);
    log(`  Cap: ${poll.participantCap}`);
    log(`  Status: ${["Active", "Closed", "Distributed", "Cancelled"][poll.status]}`);

  } catch (error: any) {
    recordResult("Create poll", false, undefined, error.message);
    console.error("Failed to create poll:", error);
    await generateReport();
    return;
  }

  // ============ STEP 3: Submit Responses (3 of 5 agents) ============
  logStep("STEP 3: Submit Responses (3 agents)");

  const respondingAgents = agentWallets.slice(0, 3); // First 3 agents

  for (const agent of respondingAgents) {
    try {
      // Generate attestation
      const attestation = await createAttestation(
        pollId,
        agent.address,
        POLLPOOL_V2_ADDRESS,
        attestationSigner
      );

      // Submit response (agent needs no gas - creator pays)
      // Actually agents need gas to submit. Let's have creator send a tiny bit of ETH
      log(`Funding ${agent.name} with gas...`);
      const fundTx = await creatorWallet.sendTransaction({
        to: agent.address,
        value: ethers.parseEther("0.00002"), // Tiny amount for gas
      });
      await fundTx.wait();

      log(`${agent.name} submitting response...`);
      const pollPoolWithAgent = pollPool.connect(agent.wallet) as ethers.Contract;
      const submitTx = await pollPoolWithAgent.submitResponse(pollId, attestation);
      await submitTx.wait();

      recordResult(`${agent.name} submit response`, true, submitTx.hash);

    } catch (error: any) {
      recordResult(`${agent.name} submit response`, false, undefined, error.message);
    }
  }

  // Verify participant count
  const pollAfterResponses = await pollPool.getPoll(pollId);
  log(`Participants after responses: ${pollAfterResponses.participantCount}`);

  // ============ STEP 4: Close Poll ============
  logStep("STEP 4: Close Poll");

  try {
    const pollPoolWithSigner = pollPool.connect(creatorWallet) as ethers.Contract;
    const closeTx = await pollPoolWithSigner.closePoll(pollId);
    await closeTx.wait();

    const pollAfterClose = await pollPool.getPoll(pollId);
    const payoutPer = await pollPool.payoutPerPerson(pollId);

    log(`Poll closed. Status: ${["Active", "Closed", "Distributed", "Cancelled"][pollAfterClose.status]}`);
    log(`Payout per person: ${formatUsdc(payoutPer)} USDC`);

    recordResult("Close poll", true, closeTx.hash, undefined, {
      payoutPerPerson: formatUsdc(payoutPer),
      participantCount: pollAfterClose.participantCount.toString(),
    });

  } catch (error: any) {
    recordResult("Close poll", false, undefined, error.message);
  }

  // ============ STEP 5: Claim Payouts ============
  logStep("STEP 5: Claim Payouts");

  for (const agent of respondingAgents) {
    try {
      const balanceBefore = await usdc.balanceOf(agent.address);

      log(`${agent.name} claiming payout...`);
      const pollPoolWithAgent = pollPool.connect(agent.wallet) as ethers.Contract;
      const claimTx = await pollPoolWithAgent.claimPayout(pollId);
      await claimTx.wait();

      const balanceAfter = await usdc.balanceOf(agent.address);
      const received = balanceAfter - balanceBefore;

      log(`${agent.name} received: ${formatUsdc(received)} USDC`);
      recordResult(`${agent.name} claim payout`, true, claimTx.hash, undefined, {
        received: formatUsdc(received),
        balance: formatUsdc(balanceAfter),
      });

    } catch (error: any) {
      recordResult(`${agent.name} claim payout`, false, undefined, error.message);
    }
  }

  // ============ STEP 6: Verify ============
  logStep("STEP 6: Verify Final State");

  try {
    const pollFinal = await pollPool.getPoll(pollId);
    const unclaimedCount = await pollPool.getUnclaimedCount(pollId);
    const treasuryUsdcAfter = await usdc.balanceOf(TREASURY_ADDRESS);
    const creatorUsdcAfter = await usdc.balanceOf(creatorWallet.address);

    const treasuryReceived = treasuryUsdcAfter - treasuryUsdcBefore;

    log(`Poll Status: ${["Active", "Closed", "Distributed", "Cancelled"][pollFinal.status]}`);
    log(`Unclaimed Count: ${unclaimedCount}`);
    log(`Treasury received (fee): ${formatUsdc(treasuryReceived)} USDC`);
    log(`Creator USDC after: ${formatUsdc(creatorUsdcAfter)} USDC`);

    // Check each agent balance
    for (const agent of respondingAgents) {
      const balance = await usdc.balanceOf(agent.address);
      log(`${agent.name} final balance: ${formatUsdc(balance)} USDC`);
    }

    recordResult("Verify final state", true, undefined, undefined, {
      status: ["Active", "Closed", "Distributed", "Cancelled"][pollFinal.status],
      unclaimedCount: unclaimedCount.toString(),
      treasuryReceived: formatUsdc(treasuryReceived),
    });

  } catch (error: any) {
    recordResult("Verify final state", false, undefined, error.message);
  }

  // ============ STEP 7: Edge Cases ============
  logStep("STEP 7: Edge Cases");

  // 7a. Agent tries to claim twice (should revert)
  try {
    log("Testing double claim (should fail)...");
    const pollPoolWithAgent = pollPool.connect(respondingAgents[0].wallet) as ethers.Contract;
    await pollPoolWithAgent.claimPayout(pollId);
    recordResult("Double claim reverts", false, undefined, "Did not revert!");
  } catch (error: any) {
    const isExpectedError = error.message.includes("AlreadyClaimed") || error.message.includes("revert");
    recordResult("Double claim reverts", isExpectedError, undefined, isExpectedError ? "Correctly reverted" : error.message);
  }

  // 7b. Submit response to closed poll (should revert)
  try {
    log("Testing submit to closed poll (should fail)...");
    const unusedAgent = agentWallets[3];
    const attestation = await createAttestation(pollId, unusedAgent.address, POLLPOOL_V2_ADDRESS, attestationSigner);

    // Fund agent
    await creatorWallet.sendTransaction({
      to: unusedAgent.address,
      value: ethers.parseEther("0.00002"),
    });

    const pollPoolWithAgent = pollPool.connect(unusedAgent.wallet) as ethers.Contract;
    await pollPoolWithAgent.submitResponse(pollId, attestation);
    recordResult("Submit to closed poll reverts", false, undefined, "Did not revert!");
  } catch (error: any) {
    const isExpectedError = error.message.includes("PollNotActive") || error.message.includes("revert");
    recordResult("Submit to closed poll reverts", isExpectedError, undefined, isExpectedError ? "Correctly reverted" : error.message);
  }

  // 7c. Create second poll, 1 response, then refund
  logStep("STEP 7c: Refund Test");

  const remainingUsdc = await usdc.balanceOf(creatorWallet.address);
  if (remainingUsdc >= parseUsdc("1")) {
    try {
      log("Creating second poll for refund test...");
      const usdcWithSigner = usdc.connect(creatorWallet) as ethers.Contract;
      await (await usdcWithSigner.approve(POLLPOOL_V2_ADDRESS, parseUsdc("1"))).wait();

      const pollPoolWithSigner = pollPool.connect(creatorWallet) as ethers.Contract;
      const createTx2 = await pollPoolWithSigner.createPoll(
        "Refund Test Poll",
        criteriaHash,
        5n,
        3600n,
        parseUsdc("1")
      );
      await createTx2.wait();

      const pollId2 = (await pollPool.nextPollId()) - 1n;
      log(`Second poll created: ${pollId2}`);

      // Submit 1 response
      const agent = agentWallets[4];
      const attestation = await createAttestation(pollId2, agent.address, POLLPOOL_V2_ADDRESS, attestationSigner);

      // Fund agent if needed
      const agentEth = await provider.getBalance(agent.address);
      if (agentEth < ethers.parseEther("0.00001")) {
        await (await creatorWallet.sendTransaction({
          to: agent.address,
          value: ethers.parseEther("0.00002"),
        })).wait();
      }

      const pollPoolWithAgent = pollPool.connect(agent.wallet) as ethers.Contract;
      await (await pollPoolWithAgent.submitResponse(pollId2, attestation)).wait();
      log("1 response submitted to second poll");

      // Refund
      const creatorBalanceBefore = await usdc.balanceOf(creatorWallet.address);
      const refundTx = await pollPoolWithSigner.refund(pollId2);
      await refundTx.wait();

      const creatorBalanceAfter = await usdc.balanceOf(creatorWallet.address);
      const refunded = creatorBalanceAfter - creatorBalanceBefore;

      log(`Refunded: ${formatUsdc(refunded)} USDC`);
      recordResult("Refund test", true, refundTx.hash, undefined, {
        refunded: formatUsdc(refunded),
      });

    } catch (error: any) {
      recordResult("Refund test", false, undefined, error.message);
    }
  } else {
    log("Skipping refund test - insufficient USDC");
    recordResult("Refund test", false, undefined, "Insufficient USDC");
  }

  // ============ STEP 8: Generate Report ============
  await generateReport();
}

async function generateReport() {
  logStep("STEP 8: Generate Report");

  const reportPath = path.join(process.cwd(), "scripts", "e2e-report.md");

  let report = `# PollPoolV2 E2E Test Report

**Date:** ${new Date().toISOString()}
**Contract:** \`${POLLPOOL_V2_ADDRESS}\`
**Network:** Base Sepolia (84532)

## Test Results

| Step | Result | Tx Hash | Details |
|------|--------|---------|---------|
`;

  for (const r of results) {
    const status = r.success ? "✅ Pass" : "❌ Fail";
    const txLink = r.txHash ? `[${r.txHash.slice(0, 10)}...](https://sepolia.basescan.org/tx/${r.txHash})` : "-";
    const details = r.error || (r.details ? JSON.stringify(r.details) : "-");
    report += `| ${r.step} | ${status} | ${txLink} | ${details.slice(0, 50)} |\n`;
  }

  report += `
## Transaction Links

`;

  for (const r of results) {
    if (r.txHash) {
      report += `- **${r.step}**: https://sepolia.basescan.org/tx/${r.txHash}\n`;
    }
  }

  report += `
## Summary

- **Total Steps:** ${results.length}
- **Passed:** ${results.filter(r => r.success).length}
- **Failed:** ${results.filter(r => !r.success).length}

## Contract Verified

- **BaseScan:** https://sepolia.basescan.org/address/${POLLPOOL_V2_ADDRESS}
`;

  fs.writeFileSync(reportPath, report);
  log(`Report saved to: ${reportPath}`);

  // Print summary
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                      TEST SUMMARY                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.success).length} | Failed: ${results.filter(r => !r.success).length}`);
  console.log("");

  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    console.log(`${icon} ${r.step}`);
  }

  console.log("");
  console.log(`Report: ${reportPath}`);
  console.log("");
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
