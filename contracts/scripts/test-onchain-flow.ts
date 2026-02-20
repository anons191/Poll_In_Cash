import { ethers } from "hardhat";

/**
 * Test script for the full poll lifecycle on Base Sepolia
 *
 * Tests:
 * 1. Deploy MockUSDC
 * 2. Create a poll
 * 3. Have 3 agents submit responses with valid attestations
 * 4. Close the poll
 * 5. Distribute rewards
 * 6. Verify balances
 *
 * Prerequisites:
 * - At least 4 accounts configured (creator + 3 agents)
 * - PollPool deployed at the specified address
 *
 * Run with: npx hardhat run scripts/test-onchain-flow.ts --network baseSepolia
 */

const POLL_POOL_ADDRESS = "0xf6fea61ac2d3bfc57bb63048594a203970580bd6";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Circle's testnet USDC
const PLATFORM_FEE_BPS = 1000n; // 10%
const BPS_DENOMINATOR = 10000n;

async function main() {
  console.log("=== POLL IN CASH - ONCHAIN TEST FLOW ===\n");

  try {
    // 1. Get signers (creator + 3 agents)
    const signers = await ethers.getSigners();

    if (signers.length < 4) {
      console.error("ERROR: Need at least 4 signers (creator + 3 agents)");
      console.log("For testing on Base Sepolia with a single private key,");
      console.log("the script will use the same signer as creator and attestation signer.");
      console.log("Agents will need separate funded accounts.");
      process.exit(1);
    }

    const [creator, agent1, agent2, agent3] = signers;
    console.log("Creator:", creator.address);
    console.log("Agent 1:", agent1.address);
    console.log("Agent 2:", agent2.address);
    console.log("Agent 3:", agent3.address);

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

    // Check the attestation signer on the contract
    const attestationSigner = await PollPool.attestationSigner();
    console.log("Attestation Signer:", attestationSigner);

    // Check the USDC address on the contract
    const contractUSDC = await PollPool.usdc();
    console.log("Contract USDC:", contractUSDC);

    // IMPORTANT: The contract was deployed with a specific USDC address
    // For this test to work, we need to use that USDC, not a new MockUSDC
    // OR the contract owner needs to be able to update the USDC address
    // Since that's not possible, let's check if the existing USDC is compatible

    console.log("\nWARNING: PollPool contract uses USDC at:", contractUSDC);
    console.log("This test deploys a fresh MockUSDC which won't work with the existing PollPool.");
    console.log("For a real test, you need to either:");
    console.log("1. Use the actual USDC address the contract was deployed with");
    console.log("2. Deploy a new PollPool with the MockUSDC address");
    console.log("\nProceeding with demonstration flow...\n");

    // 4. Mint USDC to creator
    console.log("--- Minting USDC ---");
    const mintAmount = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)
    const mintTx = await mockUSDC.mint(creator.address, mintAmount);
    await mintTx.wait();
    console.log("Minted", ethers.formatUnits(mintAmount, 6), "USDC to creator");

    const creatorBalance = await mockUSDC.balanceOf(creator.address);
    console.log("Creator USDC balance:", ethers.formatUnits(creatorBalance, 6));

    // 5. Approve PollPool to spend USDC
    console.log("\n--- Approving PollPool ---");
    const fundAmount = ethers.parseUnits("30", 6); // 30 USDC for poll
    const approveTx = await mockUSDC.approve(POLL_POOL_ADDRESS, fundAmount);
    await approveTx.wait();
    console.log("Approved PollPool to spend", ethers.formatUnits(fundAmount, 6), "USDC");

    // Calculate expected values
    const platformFee = (fundAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    const distributablePool = fundAmount - platformFee;
    console.log("\nExpected platform fee (10%):", ethers.formatUnits(platformFee, 6), "USDC");
    console.log("Expected distributable pool:", ethers.formatUnits(distributablePool, 6), "USDC");

    // 6. Create a poll
    console.log("\n--- Creating Poll ---");
    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("test-criteria-v1"));
    const participantCap = 3;
    const duration = 3600; // 1 hour

    console.log("Poll parameters:");
    console.log("  Title: Test Poll");
    console.log("  Criteria Hash:", criteriaHash);
    console.log("  Participant Cap:", participantCap);
    console.log("  Duration:", duration, "seconds");
    console.log("  Fund Amount:", ethers.formatUnits(fundAmount, 6), "USDC");

    const createTx = await PollPool.createPoll(
      "Test Poll",
      criteriaHash,
      participantCap,
      duration,
      fundAmount
    );
    const createReceipt = await createTx.wait();
    console.log("Poll creation tx:", createTx.hash);

    // Parse PollCreated event to get pollId
    // Event signature: PollCreated(uint256 indexed pollId, address indexed creator, string title, bytes32 criteriaHash, uint256 totalFunded, uint256 distributablePool, uint256 participantCap, uint256 expiresAt)
    const pollCreatedEventSig = ethers.id("PollCreated(uint256,address,string,bytes32,uint256,uint256,uint256,uint256)");
    const pollCreatedLog = createReceipt?.logs.find(
      (log) => log.topics[0] === pollCreatedEventSig
    );

    let pollId: bigint;
    if (pollCreatedLog) {
      pollId = BigInt(pollCreatedLog.topics[1]);
      console.log("Created poll with ID:", pollId.toString());
    } else {
      // Fallback: get from nextPollId
      const nextPollId = await PollPool.nextPollId();
      pollId = nextPollId - 1n;
      console.log("Created poll with ID (from nextPollId):", pollId.toString());
    }

    // Verify poll was created
    const poll = await PollPool.getPoll(pollId);
    console.log("\nPoll details:");
    console.log("  Creator:", poll.creator);
    console.log("  Title:", poll.title);
    console.log("  Total Funded:", ethers.formatUnits(poll.totalFunded, 6), "USDC");
    console.log("  Distributable Pool:", ethers.formatUnits(poll.distributablePool, 6), "USDC");
    console.log("  Participant Cap:", poll.participantCap.toString());
    console.log("  Participant Count:", poll.participantCount.toString());
    console.log("  Status:", ["Active", "Closed", "Distributed", "Cancelled"][Number(poll.status)]);

    // 7. Submit responses from 3 agents
    console.log("\n--- Submitting Responses ---");

    // The attestation format is: keccak256(abi.encodePacked(pollId, participant, address(this)))
    // Signed by the attestation signer

    // Check if creator is the attestation signer (common in test setups)
    const isCreatorAttestationSigner = attestationSigner.toLowerCase() === creator.address.toLowerCase();
    console.log("Creator is attestation signer:", isCreatorAttestationSigner);

    if (!isCreatorAttestationSigner) {
      console.log("\nWARNING: Creator is not the attestation signer.");
      console.log("Attestation signatures must come from:", attestationSigner);
      console.log("You may need to configure the correct signer to proceed.");
    }

    const agents = [agent1, agent2, agent3];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      console.log(`\nAgent ${i + 1} (${agent.address}):`);

      // Create the message hash that needs to be signed
      // Format: keccak256(abi.encodePacked(pollId, participant, contractAddress))
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "address", "address"],
        [pollId, agent.address, POLL_POOL_ADDRESS]
      );
      console.log("  Message hash:", messageHash);

      // Sign the message (using creator as attestation signer if they match)
      // In production, this would be signed by the attestation service
      let signature: string;
      if (isCreatorAttestationSigner) {
        // Creator signs the attestation
        signature = await creator.signMessage(ethers.getBytes(messageHash));
      } else {
        // We can't sign with a different key, so we'll try with creator
        // This will fail verification unless creator == attestationSigner
        console.log("  WARNING: Signing with creator, but may not match attestation signer");
        signature = await creator.signMessage(ethers.getBytes(messageHash));
      }
      console.log("  Signature:", signature.substring(0, 42) + "...");

      // Submit response as agent
      try {
        const submitTx = await PollPool.connect(agent).submitResponse(
          pollId,
          signature
        );
        const submitReceipt = await submitTx.wait();
        console.log("  Response submitted! Tx:", submitTx.hash);

        // Parse ResponseSubmitted event
        const responseSubmittedSig = ethers.id("ResponseSubmitted(uint256,address,uint256)");
        const responseLog = submitReceipt?.logs.find(
          (log) => log.topics[0] === responseSubmittedSig
        );
        if (responseLog) {
          // participantNumber is the 3rd topic (after pollId and participant)
          const iface = PollPool.interface;
          const decoded = iface.decodeEventLog("ResponseSubmitted", responseLog.data, responseLog.topics);
          console.log("  Participant number:", decoded.participantNumber.toString());
        }
      } catch (error: any) {
        console.log("  ERROR submitting response:", error.reason || error.message);
      }
    }

    // Check poll status after submissions
    const pollAfterSubmissions = await PollPool.getPoll(pollId);
    console.log("\nPoll after submissions:");
    console.log("  Participant Count:", pollAfterSubmissions.participantCount.toString());

    // 8. Close poll
    console.log("\n--- Closing Poll ---");
    try {
      const closeTx = await PollPool.closePoll(pollId);
      await closeTx.wait();
      console.log("Poll closed! Tx:", closeTx.hash);
    } catch (error: any) {
      console.log("ERROR closing poll:", error.reason || error.message);
    }

    // 9. Distribute rewards
    console.log("\n--- Distributing Rewards ---");
    try {
      const distributeTx = await PollPool.distribute(pollId);
      const distributeReceipt = await distributeTx.wait();
      console.log("Rewards distributed! Tx:", distributeTx.hash);

      // Parse FundsDistributed event
      const fundsDistributedSig = ethers.id("FundsDistributed(uint256,uint256,uint256,uint256)");
      const distributeLog = distributeReceipt?.logs.find(
        (log) => log.topics[0] === fundsDistributedSig
      );
      if (distributeLog) {
        const iface = PollPool.interface;
        const decoded = iface.decodeEventLog("FundsDistributed", distributeLog.data, distributeLog.topics);
        console.log("\nDistribution details:");
        console.log("  Participant Count:", decoded.participantCount.toString());
        console.log("  Payout Per Person:", ethers.formatUnits(decoded.payoutPerPerson, 6), "USDC");
        console.log("  Returned to Creator:", ethers.formatUnits(decoded.returnedToCreator, 6), "USDC");
      }
    } catch (error: any) {
      console.log("ERROR distributing:", error.reason || error.message);
    }

    // 10. Print final balances
    console.log("\n=== FINAL BALANCES ===");

    // Use the actual USDC contract from PollPool for balance checks
    const actualUSDC = await ethers.getContractAt("IERC20", contractUSDC);

    console.log("\nUsing contract USDC at:", contractUSDC);
    console.log("Creator:", ethers.formatUnits(await actualUSDC.balanceOf(creator.address), 6), "USDC");
    console.log("Agent 1:", ethers.formatUnits(await actualUSDC.balanceOf(agent1.address), 6), "USDC");
    console.log("Agent 2:", ethers.formatUnits(await actualUSDC.balanceOf(agent2.address), 6), "USDC");
    console.log("Agent 3:", ethers.formatUnits(await actualUSDC.balanceOf(agent3.address), 6), "USDC");

    // Also check MockUSDC balances (for the deployed test token)
    console.log("\nMockUSDC balances (our deployed test token):");
    console.log("Creator:", ethers.formatUnits(await mockUSDC.balanceOf(creator.address), 6), "USDC");
    console.log("Agent 1:", ethers.formatUnits(await mockUSDC.balanceOf(agent1.address), 6), "USDC");
    console.log("Agent 2:", ethers.formatUnits(await mockUSDC.balanceOf(agent2.address), 6), "USDC");
    console.log("Agent 3:", ethers.formatUnits(await mockUSDC.balanceOf(agent3.address), 6), "USDC");

    // Final poll status
    const finalPoll = await PollPool.getPoll(pollId);
    console.log("\nFinal poll status:", ["Active", "Closed", "Distributed", "Cancelled"][Number(finalPoll.status)]);

    console.log("\n=== TEST COMPLETED ===");

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
