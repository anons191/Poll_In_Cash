import { ethers, network } from "hardhat";

/**
 * Continue E2E test from existing poll
 */

const POLLPOOL_V2_ADDRESS = "0x85EB12A68246B4bBe63CE4b75F2796bf37D7CEA4";
const MOCK_USDC_ADDRESS = "0xE2C09F7D5baF6926FF0A4c350793AA19eBf46c28";
const POLL_ID = 0n; // Use the poll we already created

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

  console.log("=== CONTINUE E2E TEST ===\n");
  console.log("Network:", network.name);
  console.log("Tester:", deployer.address);

  const mockUSDC = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
  const pollPool = await ethers.getContractAt("PollPoolV2", POLLPOOL_V2_ADDRESS);

  // Check current state
  const poll = await pollPool.getPoll(POLL_ID);
  console.log("\n--- Current Poll State (ID:", POLL_ID.toString(), ") ---");
  console.log("Title:", poll.title);
  console.log("Status:", poll.status.toString(), getStatusName(poll.status));
  console.log("Participant count:", poll.participantCount.toString());
  console.log("Distributable pool:", ethers.formatUnits(poll.distributablePool, 6), "USDC");

  const hasParticipated = await pollPool.hasParticipated(POLL_ID, deployer.address);
  console.log("Has participated:", hasParticipated);

  // Determine next step based on status
  // Status: 0=Active, 1=Closed, 2=Finalized, 3=Swept, 4=Cancelled

  if (poll.status === 0n) {
    // Active - need to submit response, close, finalize, claim
    if (!hasParticipated) {
      console.log("\n--- Submitting Response ---");
      const attestation = await createAttestation(POLL_ID, deployer.address, POLLPOOL_V2_ADDRESS, deployer);
      const tx = await pollPool.submitResponse(POLL_ID, attestation);
      console.log("Tx:", tx.hash);
      await tx.wait();
      console.log("Response submitted!");
    }

    console.log("\n--- Closing Poll ---");
    const closeTx = await pollPool.closePoll(POLL_ID);
    console.log("Tx:", closeTx.hash);
    await closeTx.wait();
    console.log("Poll closed!");
  }

  // Refresh state
  const pollAfterClose = await pollPool.getPoll(POLL_ID);

  if (pollAfterClose.status === 1n) {
    // Closed - need to finalize and claim
    console.log("\n--- Finalizing Payouts ---");
    const finalizeTx = await pollPool.finalizePayouts(POLL_ID);
    console.log("Tx:", finalizeTx.hash);
    await finalizeTx.wait();
    console.log("Payouts finalized!");

    const payoutPerPerson = await pollPool.payoutPerPerson(POLL_ID);
    console.log("Payout per person:", ethers.formatUnits(payoutPerPerson, 6), "USDC");
  }

  // Refresh state
  const pollAfterFinalize = await pollPool.getPoll(POLL_ID);
  const hasClaimed = await pollPool.hasClaimed(POLL_ID, deployer.address);

  if (pollAfterFinalize.status === 2n && !hasClaimed) {
    // Finalized - need to claim
    console.log("\n--- Claiming Payout ---");

    const usdcBefore = await mockUSDC.balanceOf(deployer.address);
    console.log("USDC before:", ethers.formatUnits(usdcBefore, 6));

    const claimable = await pollPool.getClaimableAmount(POLL_ID, deployer.address);
    console.log("Claimable:", ethers.formatUnits(claimable, 6), "USDC");

    const claimTx = await pollPool.claimPayout(POLL_ID);
    console.log("Tx:", claimTx.hash);
    await claimTx.wait();

    const usdcAfter = await mockUSDC.balanceOf(deployer.address);
    console.log("USDC after:", ethers.formatUnits(usdcAfter, 6));
    console.log("Received:", ethers.formatUnits(usdcAfter - usdcBefore, 6), "USDC");
    console.log("Payout claimed!");
  }

  // Final state
  const finalPoll = await pollPool.getPoll(POLL_ID);
  const finalClaimed = await pollPool.hasClaimed(POLL_ID, deployer.address);

  console.log("\n=== FINAL STATE ===");
  console.log("Poll status:", finalPoll.status.toString(), getStatusName(finalPoll.status));
  console.log("Has claimed:", finalClaimed);

  if (finalPoll.status === 3n && finalClaimed) {
    console.log("\n✅ E2E TEST COMPLETE - All steps passed!");
  }
}

function getStatusName(status: bigint): string {
  const names: Record<string, string> = {
    "0": "(Active)",
    "1": "(Closed)",
    "2": "(Finalized)",
    "3": "(Swept)",
    "4": "(Cancelled)",
  };
  return names[status.toString()] || "(Unknown)";
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message || error);
    process.exit(1);
  });
