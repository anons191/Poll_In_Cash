import { ethers, network } from "hardhat";

/**
 * End-to-end test for PollPoolV2 claim-based model on testnet
 *
 * Flow:
 * 1. Mint test USDC
 * 2. Approve PollPoolV2 to spend USDC
 * 3. Create a poll
 * 4. Submit response (with attestation)
 * 5. Close poll
 * 6. Finalize payouts
 * 7. Claim payout
 */

const POLLPOOL_V2_ADDRESS = "0x85EB12A68246B4bBe63CE4b75F2796bf37D7CEA4";
const MOCK_USDC_ADDRESS = "0xE2C09F7D5baF6926FF0A4c350793AA19eBf46c28";

// Helper to create attestation signature
async function createAttestation(
  pollId: bigint,
  participant: string,
  contractAddress: string,
  signer: any
): Promise<string> {
  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "address", "address"],
      [pollId, participant, contractAddress]
    )
  );
  return signer.signMessage(ethers.getBytes(messageHash));
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=== E2E TEST: PollPoolV2 Claim Model ===\n");
  console.log("Network:", network.name);
  console.log("Tester address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("ETH Balance:", ethers.formatEther(balance), "ETH\n");

  // Get contract instances
  const mockUSDC = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
  const pollPool = await ethers.getContractAt("PollPoolV2", POLLPOOL_V2_ADDRESS);

  // ============ Step 1: Mint Test USDC ============
  console.log("--- Step 1: Mint Test USDC ---");
  const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDC

  let usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("Current USDC balance:", ethers.formatUnits(usdcBalance, 6));

  if (usdcBalance < mintAmount) {
    console.log("Minting 1000 USDC...");
    const mintTx = await mockUSDC.mint(deployer.address, mintAmount);
    await mintTx.wait();
    console.log("Mint tx:", mintTx.hash);
  }

  usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("USDC balance after mint:", ethers.formatUnits(usdcBalance, 6), "\n");

  // ============ Step 2: Approve PollPoolV2 ============
  console.log("--- Step 2: Approve PollPoolV2 ---");
  const allowance = await mockUSDC.allowance(deployer.address, POLLPOOL_V2_ADDRESS);
  console.log("Current allowance:", ethers.formatUnits(allowance, 6));

  if (allowance < mintAmount) {
    console.log("Approving PollPoolV2...");
    const approveTx = await mockUSDC.approve(POLLPOOL_V2_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    console.log("Approve tx:", approveTx.hash);
  }
  console.log("Approval complete\n");

  // ============ Step 3: Create Poll ============
  console.log("--- Step 3: Create Poll ---");
  const pollTitle = "E2E Test Poll " + Date.now();
  const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("test criteria"));
  const participantCap = 5;
  const duration = 7 * 24 * 60 * 60; // 7 days
  const fundAmount = ethers.parseUnits("100", 6); // 100 USDC

  console.log("Creating poll with 100 USDC...");
  const createTx = await pollPool.createPoll(
    pollTitle,
    criteriaHash,
    participantCap,
    duration,
    fundAmount
  );
  const createReceipt = await createTx.wait();
  console.log("Create tx:", createTx.hash);

  // Get poll ID from event
  const pollCreatedEvent = createReceipt?.logs.find(
    (log: any) => log.fragment?.name === "PollCreated"
  );
  const pollId = pollCreatedEvent?.args?.[0] || 0n;
  console.log("Poll ID:", pollId.toString());

  // Verify poll state
  const poll = await pollPool.getPoll(pollId);
  console.log("Poll status:", poll.status, "(0=Active)");
  console.log("Distributable pool:", ethers.formatUnits(poll.distributablePool, 6), "USDC\n");

  // ============ Step 4: Submit Response ============
  console.log("--- Step 4: Submit Response ---");

  // Create attestation signature (deployer is attestation signer)
  const attestation = await createAttestation(
    pollId,
    deployer.address,
    POLLPOOL_V2_ADDRESS,
    deployer
  );
  console.log("Attestation created");

  console.log("Submitting response...");
  const submitTx = await pollPool.submitResponse(pollId, attestation);
  await submitTx.wait();
  console.log("Submit tx:", submitTx.hash);

  const hasParticipated = await pollPool.hasParticipated(pollId, deployer.address);
  console.log("Has participated:", hasParticipated);

  const pollAfterSubmit = await pollPool.getPoll(pollId);
  console.log("Participant count:", pollAfterSubmit.participantCount.toString(), "\n");

  // ============ Step 5: Close Poll ============
  console.log("--- Step 5: Close Poll ---");
  console.log("Closing poll...");
  const closeTx = await pollPool.closePoll(pollId);
  await closeTx.wait();
  console.log("Close tx:", closeTx.hash);

  const pollAfterClose = await pollPool.getPoll(pollId);
  console.log("Poll status:", pollAfterClose.status, "(1=Closed)\n");

  // ============ Step 6: Finalize Payouts ============
  console.log("--- Step 6: Finalize Payouts ---");
  console.log("Finalizing payouts...");
  const finalizeTx = await pollPool.finalizePayouts(pollId);
  await finalizeTx.wait();
  console.log("Finalize tx:", finalizeTx.hash);

  const pollAfterFinalize = await pollPool.getPoll(pollId);
  console.log("Poll status:", pollAfterFinalize.status, "(2=Finalized)");

  const payoutPerPerson = await pollPool.payoutPerPerson(pollId);
  console.log("Payout per person:", ethers.formatUnits(payoutPerPerson, 6), "USDC");

  const claimDeadline = await pollPool.getClaimDeadline(pollId);
  console.log("Claim deadline:", new Date(Number(claimDeadline) * 1000).toISOString(), "\n");

  // ============ Step 7: Claim Payout ============
  console.log("--- Step 7: Claim Payout ---");

  const usdcBefore = await mockUSDC.balanceOf(deployer.address);
  console.log("USDC before claim:", ethers.formatUnits(usdcBefore, 6));

  const claimable = await pollPool.getClaimableAmount(pollId, deployer.address);
  console.log("Claimable amount:", ethers.formatUnits(claimable, 6), "USDC");

  console.log("Claiming payout...");
  const claimTx = await pollPool.claimPayout(pollId);
  await claimTx.wait();
  console.log("Claim tx:", claimTx.hash);

  const usdcAfter = await mockUSDC.balanceOf(deployer.address);
  console.log("USDC after claim:", ethers.formatUnits(usdcAfter, 6));
  console.log("USDC received:", ethers.formatUnits(usdcAfter - usdcBefore, 6), "\n");

  // Final state
  const pollFinal = await pollPool.getPoll(pollId);
  console.log("--- Final State ---");
  console.log("Poll status:", pollFinal.status, "(3=Swept - all claimed)");

  const hasClaimed = await pollPool.hasClaimed(pollId, deployer.address);
  console.log("Has claimed:", hasClaimed);

  const [distributed, total, isComplete] = await pollPool.getDistributionProgress(pollId);
  console.log("Distribution progress:", distributed.toString(), "/", total.toString(), "complete:", isComplete);

  console.log("\n=== E2E TEST COMPLETE ===");
  console.log("All steps passed successfully!");

  // Summary
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("\nGas used (ETH spent):", ethers.formatEther(balance - finalBalance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nE2E TEST FAILED:");
    console.error(error);
    process.exit(1);
  });
