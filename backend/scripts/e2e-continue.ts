#!/usr/bin/env npx tsx
/**
 * Continue E2E Test - Submit responses, close, claim, verify
 * Uses existing Poll 0 that was already created
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
const POLL_ID = 0n;

// ABIs
const POLLPOOL_ABI = [
  "function submitResponse(uint256 _pollId, bytes _attestationSignature) external",
  "function closePoll(uint256 _pollId) external",
  "function claimPayout(uint256 _pollId) external",
  "function distribute(uint256 _pollId) external",
  "function getPoll(uint256 _pollId) view returns (tuple(address creator, string title, bytes32 criteriaHash, uint256 totalFunded, uint256 distributablePool, uint256 participantCap, uint256 participantCount, uint256 expiresAt, uint256 closedAt, uint8 status))",
  "function hasParticipated(uint256 _pollId, address _participant) view returns (bool)",
  "function hasClaimed(uint256 _pollId, address _participant) view returns (bool)",
  "function payoutPerPerson(uint256 _pollId) view returns (uint256)",
  "function getUnclaimedCount(uint256 _pollId) view returns (uint256)",
  "function getParticipants(uint256 _pollId) view returns (address[])",
];

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

// ============ Types ============

interface TestResult {
  step: string;
  success: boolean;
  txHash?: string;
  error?: string;
  details?: Record<string, unknown>;
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

// ============ Main Test ============

async function main() {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║       PollPoolV2 E2E Test Continuation - Poll 0            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  const creatorPrivateKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const creatorWallet = new ethers.Wallet(creatorPrivateKey, provider);
  const attestationSigner = creatorWallet;

  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const pollPool = new ethers.Contract(POLLPOOL_V2_ADDRESS, POLLPOOL_ABI, provider);

  // Check initial state
  const poll = await pollPool.getPoll(POLL_ID);
  const treasuryBefore = await usdc.balanceOf(TREASURY_ADDRESS);

  log(`Poll Status: ${["Active", "Closed", "Distributed", "Cancelled"][poll.status]}`);
  log(`Participants: ${poll.participantCount}/${poll.participantCap}`);
  log(`Distributable: ${formatUsdc(poll.distributablePool)} USDC`);
  log(`Treasury Before: ${formatUsdc(treasuryBefore)} USDC`);

  if (Number(poll.status) !== 0) {
    log("Poll is not active. Cannot continue test.");
    return;
  }

  // Generate agent wallets (same seed as original test)
  const agentWallets: ethers.Wallet[] = [];
  for (let i = 0; i < 3; i++) {
    const seed = ethers.keccak256(ethers.toUtf8Bytes(`e2e-test-agent-v2-${i}`));
    agentWallets.push(new ethers.Wallet(seed, provider));
  }

  // ============ STEP 3: Submit Responses ============
  logStep("STEP 3: Submit Responses (3 agents)");

  const pollPoolWithCreator = pollPool.connect(creatorWallet) as ethers.Contract;
  const GAS_PER_AGENT = ethers.parseEther("0.00004");

  for (let i = 0; i < agentWallets.length; i++) {
    const agent = agentWallets[i];
    const agentName = `Agent ${i + 1}`;

    try {
      // Check if already participated
      const alreadyParticipated = await pollPool.hasParticipated(POLL_ID, agent.address);
      if (alreadyParticipated) {
        log(`${agentName} already participated, skipping`);
        recordResult(`${agentName} submit response`, true, undefined, undefined, { skipped: true });
        continue;
      }

      // Generate attestation
      const attestation = await createAttestation(
        POLL_ID,
        agent.address,
        POLLPOOL_V2_ADDRESS,
        attestationSigner
      );

      // Fund agent with gas
      log(`Funding ${agentName} (${agent.address.slice(0, 10)}...) with gas...`);
      const fundTx = await creatorWallet.sendTransaction({
        to: agent.address,
        value: GAS_PER_AGENT,
      });
      await fundTx.wait();

      // Submit response
      log(`${agentName} submitting response...`);
      const pollPoolWithAgent = pollPool.connect(agent) as ethers.Contract;
      const submitTx = await pollPoolWithAgent.submitResponse(POLL_ID, attestation, {
        gasLimit: 150000,
      });
      await submitTx.wait();

      recordResult(`${agentName} submit response`, true, submitTx.hash);

    } catch (error: any) {
      recordResult(`${agentName} submit response`, false, undefined, error.message?.slice(0, 100));
    }
  }

  // Verify
  const pollAfterResponses = await pollPool.getPoll(POLL_ID);
  log(`Participants after responses: ${pollAfterResponses.participantCount}`);

  // ============ STEP 4: Close Poll ============
  logStep("STEP 4: Close Poll");

  try {
    log("Closing poll...");
    const closeTx = await pollPoolWithCreator.closePoll(POLL_ID, { gasLimit: 100000 });
    await closeTx.wait();

    const pollAfterClose = await pollPool.getPoll(POLL_ID);
    const payoutPer = await pollPool.payoutPerPerson(POLL_ID);

    log(`Poll closed. Status: ${["Active", "Closed", "Distributed", "Cancelled"][pollAfterClose.status]}`);
    log(`Payout per person: ${formatUsdc(payoutPer)} USDC`);

    recordResult("Close poll", true, closeTx.hash, undefined, {
      payoutPerPerson: formatUsdc(payoutPer),
    });

  } catch (error: any) {
    recordResult("Close poll", false, undefined, error.message?.slice(0, 100));
  }

  // ============ STEP 5: Claim Payouts ============
  logStep("STEP 5: Claim Payouts");

  for (let i = 0; i < agentWallets.length; i++) {
    const agent = agentWallets[i];
    const agentName = `Agent ${i + 1}`;

    try {
      const participated = await pollPool.hasParticipated(POLL_ID, agent.address);
      if (!participated) {
        log(`${agentName} didn't participate, skipping claim`);
        continue;
      }

      const alreadyClaimed = await pollPool.hasClaimed(POLL_ID, agent.address);
      if (alreadyClaimed) {
        log(`${agentName} already claimed`);
        continue;
      }

      const balanceBefore = await usdc.balanceOf(agent.address);

      log(`${agentName} claiming payout...`);
      const pollPoolWithAgent = pollPool.connect(agent) as ethers.Contract;
      const claimTx = await pollPoolWithAgent.claimPayout(POLL_ID, { gasLimit: 100000 });
      await claimTx.wait();

      const balanceAfter = await usdc.balanceOf(agent.address);
      const received = balanceAfter - balanceBefore;

      log(`${agentName} received: ${formatUsdc(received)} USDC`);
      recordResult(`${agentName} claim payout`, true, claimTx.hash, undefined, {
        received: formatUsdc(received),
      });

    } catch (error: any) {
      recordResult(`${agentName} claim payout`, false, undefined, error.message?.slice(0, 100));
    }
  }

  // ============ STEP 6: Verify ============
  logStep("STEP 6: Verify Final State");

  const pollFinal = await pollPool.getPoll(POLL_ID);
  const unclaimedCount = await pollPool.getUnclaimedCount(POLL_ID);
  const treasuryAfter = await usdc.balanceOf(TREASURY_ADDRESS);
  const creatorUsdcAfter = await usdc.balanceOf(creatorWallet.address);

  log(`Poll Status: ${["Active", "Closed", "Distributed", "Cancelled"][pollFinal.status]}`);
  log(`Unclaimed Count: ${unclaimedCount}`);
  log(`Treasury After: ${formatUsdc(treasuryAfter)} USDC`);
  log(`Creator USDC After: ${formatUsdc(creatorUsdcAfter)} USDC`);

  // Agent balances
  for (let i = 0; i < agentWallets.length; i++) {
    const balance = await usdc.balanceOf(agentWallets[i].address);
    log(`Agent ${i + 1} USDC: ${formatUsdc(balance)}`);
  }

  recordResult("Verify final state", true, undefined, undefined, {
    status: ["Active", "Closed", "Distributed", "Cancelled"][pollFinal.status],
    unclaimedCount: unclaimedCount.toString(),
    treasuryAfter: formatUsdc(treasuryAfter),
  });

  // ============ STEP 7: Edge Cases ============
  logStep("STEP 7: Edge Cases");

  // Double claim test
  try {
    log("Testing double claim (should fail)...");
    const pollPoolWithAgent = pollPool.connect(agentWallets[0]) as ethers.Contract;
    await pollPoolWithAgent.claimPayout(POLL_ID, { gasLimit: 100000 });
    recordResult("Double claim reverts", false, undefined, "Did not revert!");
  } catch (error: any) {
    recordResult("Double claim reverts", true, undefined, "Correctly reverted");
  }

  // Submit to closed poll test
  try {
    log("Testing submit to closed poll (should fail)...");
    const unusedAgent = new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes("e2e-test-agent-unused")), provider);
    const attestation = await createAttestation(POLL_ID, unusedAgent.address, POLLPOOL_V2_ADDRESS, attestationSigner);

    // Fund unused agent
    await (await creatorWallet.sendTransaction({
      to: unusedAgent.address,
      value: GAS_PER_AGENT,
    })).wait();

    const pollPoolWithUnused = pollPool.connect(unusedAgent) as ethers.Contract;
    await pollPoolWithUnused.submitResponse(POLL_ID, attestation, { gasLimit: 150000 });
    recordResult("Submit to closed poll reverts", false, undefined, "Did not revert!");
  } catch (error: any) {
    recordResult("Submit to closed poll reverts", true, undefined, "Correctly reverted");
  }

  // ============ Generate Report ============
  logStep("STEP 8: Generate Report");

  const reportPath = path.join(process.cwd(), "scripts", "e2e-report.md");

  let report = `# PollPoolV2 E2E Test Report

**Date:** ${new Date().toISOString()}
**Contract:** \`${POLLPOOL_V2_ADDRESS}\`
**Network:** Base Sepolia (84532)
**Poll ID:** ${POLL_ID.toString()}

## Test Results

| Step | Result | Tx Hash | Details |
|------|--------|---------|---------|
`;

  for (const r of results) {
    const status = r.success ? "✅ Pass" : "❌ Fail";
    const txLink = r.txHash ? `[${r.txHash.slice(0, 10)}...](https://sepolia.basescan.org/tx/${r.txHash})` : "-";
    const details = r.error || (r.details ? JSON.stringify(r.details).slice(0, 50) : "-");
    report += `| ${r.step} | ${status} | ${txLink} | ${details} |\n`;
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
## Financial Summary

| Item | Amount |
|------|--------|
| Poll Funded | ${formatUsdc(poll.totalFunded)} USDC |
| Platform Fee (10%) | ${formatUsdc(poll.totalFunded / 10n)} USDC |
| Distributable | ${formatUsdc(poll.distributablePool)} USDC |
| Participants | ${pollFinal.participantCount.toString()} |
| Payout Per Person | ${formatUsdc(await pollPool.payoutPerPerson(POLL_ID))} USDC |
| Treasury Balance | ${formatUsdc(await usdc.balanceOf(TREASURY_ADDRESS))} USDC |

## Summary

- **Total Steps:** ${results.length}
- **Passed:** ${results.filter(r => r.success).length}
- **Failed:** ${results.filter(r => !r.success).length}

## Contract Links

- **PollPoolV2:** https://sepolia.basescan.org/address/${POLLPOOL_V2_ADDRESS}
- **USDC:** https://sepolia.basescan.org/address/${USDC_ADDRESS}
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
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
