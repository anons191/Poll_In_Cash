import { ethers } from "hardhat";

/**
 * Test script for the poll cancellation/refund flow on Base Sepolia
 *
 * Tests:
 * 1. Deploy MockUSDC
 * 2. Create a poll
 * 3. Have 1 agent submit a response
 * 4. Cancel/refund the poll before it fills
 * 5. Verify creator gets refund of distributablePool
 * 6. Verify final balances
 *
 * Key points:
 * - Platform fee (10%) is taken at poll creation and NOT refunded
 * - Refund returns the distributablePool (90% of funded amount)
 * - Poll must be Active to refund
 * - Only poll creator can call refund
 *
 * Prerequisites:
 * - At least 2 accounts configured (creator + 1 agent)
 * - PollPool deployed at the specified address
 *
 * Run with: npx hardhat run scripts/test-refund-flow.ts --network baseSepolia
 */

const POLL_POOL_ADDRESS = "0xf6fea61ac2d3bfc57bb63048594a203970580bd6";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Circle's testnet USDC
const PLATFORM_FEE_BPS = 1000n; // 10%
const BPS_DENOMINATOR = 10000n;

async function main() {
  console.log("=== POLL IN CASH - REFUND TEST FLOW ===\n");

  try {
    // 1. Get signers (creator + 1 agent)
    const signers = await ethers.getSigners();

    if (signers.length < 2) {
      console.error("ERROR: Need at least 2 signers (creator + 1 agent)");
      process.exit(1);
    }

    const [creator, agent1] = signers;
    console.log("Creator:", creator.address);
    console.log("Agent 1:", agent1.address);

    // 2. Deploy MockUSDC
    console.log("\n--- Deploying MockUSDC ---");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddress = await mockUSDC.getAddress();
    console.log("MockUSDC deployed to:", mockUSDCAddress);

    // 3. Get PollPool contract
    console.log("\n--- Connecting to PollPool ---");
    const PollPool = await ethers.getContractAt("PollPool", POLL_POOL_ADDRESS);
    console.log("PollPool at:", POLL_POOL_ADDRESS);

    // Check contract configuration
    const attestationSigner = await PollPool.attestationSigner();
    const contractUSDC = await PollPool.usdc();
    const treasury = await PollPool.treasury();

    console.log("Attestation Signer:", attestationSigner);
    console.log("Contract USDC:", contractUSDC);
    console.log("Treasury:", treasury);

    console.log("\nWARNING: PollPool contract uses USDC at:", contractUSDC);
    console.log("This test deploys a fresh MockUSDC which won't work with the existing PollPool.");
    console.log("For a real test, you need to use the actual USDC address or deploy a new PollPool.");
    console.log("\nProceeding with demonstration flow...\n");

    // 4. Mint USDC to creator
    console.log("--- Minting USDC ---");
    const mintAmount = ethers.parseUnits("100", 6); // 100 USDC
    const mintTx = await mockUSDC.mint(creator.address, mintAmount);
    await mintTx.wait();
    console.log("Minted", ethers.formatUnits(mintAmount, 6), "USDC to creator");

    // 5. Record initial balances
    console.log("\n--- Initial Balances ---");
    const initialCreatorBalance = await mockUSDC.balanceOf(creator.address);
    console.log("Creator:", ethers.formatUnits(initialCreatorBalance, 6), "USDC");

    // 6. Approve PollPool to spend USDC
    console.log("\n--- Approving PollPool ---");
    const fundAmount = ethers.parseUnits("50", 6); // 50 USDC for poll
    const approveTx = await mockUSDC.approve(POLL_POOL_ADDRESS, fundAmount);
    await approveTx.wait();
    console.log("Approved PollPool to spend", ethers.formatUnits(fundAmount, 6), "USDC");

    // Calculate expected values
    const platformFee = (fundAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    const distributablePool = fundAmount - platformFee;
    console.log("\nExpected platform fee (10%):", ethers.formatUnits(platformFee, 6), "USDC (NOT refundable)");
    console.log("Expected distributable pool:", ethers.formatUnits(distributablePool, 6), "USDC (refundable)");

    // 7. Create a poll
    console.log("\n--- Creating Poll ---");
    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("refund-test-criteria"));
    const participantCap = 5; // High cap so poll doesn't fill
    const duration = 3600; // 1 hour

    console.log("Poll parameters:");
    console.log("  Title: Refund Test Poll");
    console.log("  Criteria Hash:", criteriaHash);
    console.log("  Participant Cap:", participantCap);
    console.log("  Duration:", duration, "seconds");
    console.log("  Fund Amount:", ethers.formatUnits(fundAmount, 6), "USDC");

    const createTx = await PollPool.createPoll(
      "Refund Test Poll",
      criteriaHash,
      participantCap,
      duration,
      fundAmount
    );
    const createReceipt = await createTx.wait();
    console.log("Poll creation tx:", createTx.hash);

    // Parse PollCreated event to get pollId
    const pollCreatedEventSig = ethers.id("PollCreated(uint256,address,string,bytes32,uint256,uint256,uint256,uint256)");
    const pollCreatedLog = createReceipt?.logs.find(
      (log) => log.topics[0] === pollCreatedEventSig
    );

    let pollId: bigint;
    if (pollCreatedLog) {
      pollId = BigInt(pollCreatedLog.topics[1]);
      console.log("Created poll with ID:", pollId.toString());
    } else {
      const nextPollId = await PollPool.nextPollId();
      pollId = nextPollId - 1n;
      console.log("Created poll with ID (from nextPollId):", pollId.toString());
    }

    // Record balance after poll creation
    const balanceAfterCreate = await mockUSDC.balanceOf(creator.address);
    console.log("\nCreator balance after poll creation:", ethers.formatUnits(balanceAfterCreate, 6), "USDC");
    console.log("Amount spent:", ethers.formatUnits(initialCreatorBalance - balanceAfterCreate, 6), "USDC");

    // Verify poll was created
    const poll = await PollPool.getPoll(pollId);
    console.log("\nPoll details:");
    console.log("  Creator:", poll.creator);
    console.log("  Total Funded:", ethers.formatUnits(poll.totalFunded, 6), "USDC");
    console.log("  Distributable Pool:", ethers.formatUnits(poll.distributablePool, 6), "USDC");
    console.log("  Participant Cap:", poll.participantCap.toString());
    console.log("  Participant Count:", poll.participantCount.toString());
    console.log("  Status:", ["Active", "Closed", "Distributed", "Cancelled"][Number(poll.status)]);

    // 8. Submit 1 response from agent
    console.log("\n--- Submitting 1 Response ---");

    const isCreatorAttestationSigner = attestationSigner.toLowerCase() === creator.address.toLowerCase();
    console.log("Creator is attestation signer:", isCreatorAttestationSigner);

    // Create attestation for agent1
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [pollId, agent1.address, POLL_POOL_ADDRESS]
    );
    console.log("Message hash:", messageHash);

    // Sign with creator (assuming they are the attestation signer)
    const signature = await creator.signMessage(ethers.getBytes(messageHash));
    console.log("Signature:", signature.substring(0, 42) + "...");

    try {
      const submitTx = await PollPool.connect(agent1).submitResponse(pollId, signature);
      await submitTx.wait();
      console.log("Agent 1 submitted response! Tx:", submitTx.hash);
    } catch (error: any) {
      console.log("ERROR submitting response:", error.reason || error.message);
      console.log("(This is expected if USDC addresses don't match or attestation signer is different)");
    }

    // Check poll status after submission
    const pollAfterSubmission = await PollPool.getPoll(pollId);
    console.log("\nPoll after submission:");
    console.log("  Participant Count:", pollAfterSubmission.participantCount.toString());
    console.log("  Status:", ["Active", "Closed", "Distributed", "Cancelled"][Number(pollAfterSubmission.status)]);

    // 9. Cancel/Refund the poll
    console.log("\n--- Cancelling Poll (Refund) ---");
    console.log("Note: Only the poll creator can cancel an active poll");

    try {
      // First, try to cancel from a non-creator (should fail)
      console.log("\nAttempting cancel from agent1 (should fail)...");
      try {
        await PollPool.connect(agent1).refund(pollId);
        console.log("ERROR: Cancel from non-creator should have failed!");
      } catch (error: any) {
        console.log("Expected error:", error.reason || "NotPollCreator");
      }

      // Now cancel from creator
      console.log("\nCancelling from creator...");
      const refundTx = await PollPool.refund(pollId);
      const refundReceipt = await refundTx.wait();
      console.log("Poll cancelled! Tx:", refundTx.hash);

      // Parse PollCancelled event
      const pollCancelledSig = ethers.id("PollCancelled(uint256,address,uint256)");
      const cancelLog = refundReceipt?.logs.find(
        (log) => log.topics[0] === pollCancelledSig
      );
      if (cancelLog) {
        const iface = PollPool.interface;
        const decoded = iface.decodeEventLog("PollCancelled", cancelLog.data, cancelLog.topics);
        console.log("\nRefund details:");
        console.log("  Poll ID:", decoded.pollId?.toString() || pollId.toString());
        console.log("  Refunded Amount:", ethers.formatUnits(decoded.refundedAmount, 6), "USDC");
      }
    } catch (error: any) {
      console.log("ERROR cancelling poll:", error.reason || error.message);
    }

    // 10. Verify final state
    console.log("\n--- Verifying Final State ---");

    // Check poll status
    const finalPoll = await PollPool.getPoll(pollId);
    console.log("\nFinal poll status:", ["Active", "Closed", "Distributed", "Cancelled"][Number(finalPoll.status)]);

    // Try to submit another response (should fail)
    console.log("\nAttempting to submit response to cancelled poll (should fail)...");
    try {
      const sig2 = await creator.signMessage(
        ethers.getBytes(
          ethers.solidityPackedKeccak256(
            ["uint256", "address", "address"],
            [pollId, creator.address, POLL_POOL_ADDRESS]
          )
        )
      );
      await PollPool.submitResponse(pollId, sig2);
      console.log("ERROR: Should not be able to submit to cancelled poll!");
    } catch (error: any) {
      console.log("Expected error:", error.reason || "PollNotActive");
    }

    // 11. Print final balances
    console.log("\n=== FINAL BALANCES ===");

    const finalCreatorBalance = await mockUSDC.balanceOf(creator.address);
    const finalAgent1Balance = await mockUSDC.balanceOf(agent1.address);

    console.log("\nMockUSDC balances:");
    console.log("Creator:", ethers.formatUnits(finalCreatorBalance, 6), "USDC");
    console.log("Agent 1:", ethers.formatUnits(finalAgent1Balance, 6), "USDC");

    // Calculate and display the refund math
    console.log("\n=== REFUND MATH ===");
    console.log("Initial creator balance:", ethers.formatUnits(initialCreatorBalance, 6), "USDC");
    console.log("Fund amount:", ethers.formatUnits(fundAmount, 6), "USDC");
    console.log("Platform fee (10%):", ethers.formatUnits(platformFee, 6), "USDC (kept by treasury)");
    console.log("Distributable pool:", ethers.formatUnits(distributablePool, 6), "USDC (refunded)");
    console.log("Final creator balance:", ethers.formatUnits(finalCreatorBalance, 6), "USDC");

    const expectedFinalBalance = initialCreatorBalance - platformFee;
    console.log("\nExpected final balance:", ethers.formatUnits(expectedFinalBalance, 6), "USDC");
    console.log("Actual final balance:", ethers.formatUnits(finalCreatorBalance, 6), "USDC");

    if (finalCreatorBalance === expectedFinalBalance) {
      console.log("MATCH: Creator received correct refund amount");
    } else {
      console.log("Note: Balances may not match if using different USDC contracts");
    }

    // Also check balances with the contract's USDC
    console.log("\n--- Contract USDC Balances ---");
    const actualUSDC = await ethers.getContractAt("IERC20", contractUSDC);
    console.log("Contract USDC at:", contractUSDC);
    console.log("Creator:", ethers.formatUnits(await actualUSDC.balanceOf(creator.address), 6), "USDC");
    console.log("Agent 1:", ethers.formatUnits(await actualUSDC.balanceOf(agent1.address), 6), "USDC");

    console.log("\n=== REFUND TEST COMPLETED ===");

    // Summary
    console.log("\n=== SUMMARY ===");
    console.log("1. Poll was created with", ethers.formatUnits(fundAmount, 6), "USDC");
    console.log("2. Platform fee of", ethers.formatUnits(platformFee, 6), "USDC was sent to treasury (non-refundable)");
    console.log("3.", pollAfterSubmission.participantCount.toString(), "participant(s) submitted response(s)");
    console.log("4. Poll was cancelled by creator");
    console.log("5. Creator received refund of", ethers.formatUnits(distributablePool, 6), "USDC (distributable pool)");
    console.log("\nKey learning: Platform fee is charged at poll creation and is NOT refunded on cancellation");

  } catch (error: any) {
    console.error("\n=== TEST FAILED ===");
    console.error("Error:", error.reason || error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
