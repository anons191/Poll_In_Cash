import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { PollPoolV2, MockUSDC } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PollPoolV2", function () {
  let pollPool: PollPoolV2;
  let mockUSDC: MockUSDC;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let attestationSigner: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let participant1: HardhatEthersSigner;
  let participant2: HardhatEthersSigner;
  let participant3: HardhatEthersSigner;
  let nonParticipant: HardhatEthersSigner;

  const USDC_DECIMALS = 6;
  const toUSDC = (amount: number) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  const POLL_TITLE = "Test Poll";
  const CRITERIA_HASH = ethers.keccak256(ethers.toUtf8Bytes("criteria"));
  const PARTICIPANT_CAP = 10;
  const DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
  const FUND_AMOUNT = toUSDC(100); // 100 USDC

  const CLAIM_EXPIRY = 90 * 24 * 60 * 60; // 90 days in seconds

  // Helper to create attestation signature
  async function createAttestation(
    pollId: bigint,
    participant: string,
    contractAddress: string,
    signer: HardhatEthersSigner
  ): Promise<string> {
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address"],
        [pollId, participant, contractAddress]
      )
    );
    return signer.signMessage(ethers.getBytes(messageHash));
  }

  beforeEach(async function () {
    [owner, treasury, attestationSigner, creator, participant1, participant2, participant3, nonParticipant] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    // Deploy PollPoolV2
    const PollPoolV2Factory = await ethers.getContractFactory("PollPoolV2");
    pollPool = await PollPoolV2Factory.deploy(
      await mockUSDC.getAddress(),
      treasury.address,
      attestationSigner.address
    );

    // Mint USDC to creator
    await mockUSDC.mint(creator.address, toUSDC(10000));

    // Approve PollPool to spend creator's USDC
    await mockUSDC.connect(creator).approve(await pollPool.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("should set the correct USDC address", async function () {
      expect(await pollPool.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("should set the correct treasury address", async function () {
      expect(await pollPool.treasury()).to.equal(treasury.address);
    });

    it("should set the correct attestation signer", async function () {
      expect(await pollPool.attestationSigner()).to.equal(attestationSigner.address);
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await pollPool.DEFAULT_ADMIN_ROLE();
      expect(await pollPool.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should grant PAUSER_ROLE to deployer", async function () {
      const PAUSER_ROLE = await pollPool.PAUSER_ROLE();
      expect(await pollPool.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });

    it("should grant SWEEPER_ROLE to deployer", async function () {
      const SWEEPER_ROLE = await pollPool.SWEEPER_ROLE();
      expect(await pollPool.hasRole(SWEEPER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("createPoll", function () {
    it("should create a poll successfully", async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const pollId = 0n;
      const poll = await pollPool.getPoll(pollId);

      expect(poll.creator).to.equal(creator.address);
      expect(poll.title).to.equal(POLL_TITLE);
      expect(poll.criteriaHash).to.equal(CRITERIA_HASH);
      expect(poll.totalFunded).to.equal(FUND_AMOUNT);
      expect(poll.distributablePool).to.equal(toUSDC(90)); // 90% of 100
      expect(poll.participantCap).to.equal(PARTICIPANT_CAP);
      expect(poll.participantCount).to.equal(0);
      expect(poll.status).to.equal(0); // Active
    });

    it("should deduct 10% platform fee to treasury", async function () {
      const treasuryBalanceBefore = await mockUSDC.balanceOf(treasury.address);

      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const treasuryBalanceAfter = await mockUSDC.balanceOf(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(toUSDC(10)); // 10% of 100
    });
  });

  describe("submitResponse", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;
    });

    it("should accept valid response with attestation", async function () {
      const signature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      await pollPool.connect(participant1).submitResponse(pollId, signature);

      expect(await pollPool.hasParticipated(pollId, participant1.address)).to.be.true;

      const poll = await pollPool.getPoll(pollId);
      expect(poll.participantCount).to.equal(1);
    });

    it("should emit ResponseSubmitted event", async function () {
      const signature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      await expect(pollPool.connect(participant1).submitResponse(pollId, signature))
        .to.emit(pollPool, "ResponseSubmitted")
        .withArgs(pollId, participant1.address, 1);
    });

    it("should revert on invalid attestation signature", async function () {
      const badSignature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        creator // wrong signer
      );

      await expect(
        pollPool.connect(participant1).submitResponse(pollId, badSignature)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAttestation");
    });

    it("should revert on double submission", async function () {
      const signature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      await pollPool.connect(participant1).submitResponse(pollId, signature);

      await expect(
        pollPool.connect(participant1).submitResponse(pollId, signature)
      ).to.be.revertedWithCustomError(pollPool, "AlreadyParticipated");
    });
  });

  describe("closePoll", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;
    });

    it("should allow creator to close before expiry", async function () {
      await pollPool.connect(creator).closePoll(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(1); // Closed
    });

    it("should emit PollClosed event with zero payout (not calculated yet)", async function () {
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      await pollPool.connect(participant1).submitResponse(pollId, sig1);

      await expect(pollPool.connect(creator).closePoll(pollId))
        .to.emit(pollPool, "PollClosed")
        .withArgs(pollId, creator.address, 1, 0); // payout is 0 because not finalized yet
    });

    it("should revert if non-creator tries to close before expiry", async function () {
      await expect(
        pollPool.connect(nonParticipant).closePoll(pollId)
      ).to.be.revertedWithCustomError(pollPool, "NotPollCreator");
    });

    it("should allow anyone to close after expiry", async function () {
      await time.increase(DURATION + 1);

      await pollPool.connect(nonParticipant).closePoll(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(1); // Closed
    });
  });

  describe("finalizePayouts", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;

      // Add participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      // Close poll
      await pollPool.connect(creator).closePoll(pollId);
    });

    it("should allow creator to finalize payouts after closing", async function () {
      await pollPool.connect(creator).finalizePayouts(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(2); // Finalized
    });

    it("should calculate correct payout per person", async function () {
      await pollPool.connect(creator).finalizePayouts(pollId);

      const payoutPerPerson = await pollPool.payoutPerPerson(pollId);
      // 90 USDC / 3 participants = 30 USDC each
      expect(payoutPerPerson).to.equal(toUSDC(30));
    });

    it("should emit PollFinalized event with correct values", async function () {
      await expect(pollPool.connect(creator).finalizePayouts(pollId))
        .to.emit(pollPool, "PollFinalized")
        .withArgs(pollId, 3, toUSDC(30), (value: bigint) => value > 0n); // claim deadline
    });

    it("should revert if non-creator tries to finalize", async function () {
      await expect(
        pollPool.connect(nonParticipant).finalizePayouts(pollId)
      ).to.be.revertedWithCustomError(pollPool, "NotPollCreator");
    });

    it("should revert if poll is not closed", async function () {
      // Create a new active poll
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      await expect(
        pollPool.connect(creator).finalizePayouts(1n)
      ).to.be.revertedWithCustomError(pollPool, "PollNotClosed");
    });

    it("should return all funds to creator when zero participants", async function () {
      // Create and close a poll with no participants
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      const emptyPollId = 1n;
      await pollPool.connect(creator).closePoll(emptyPollId);

      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.connect(creator).finalizePayouts(emptyPollId);

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);

      // Should get back 90 USDC (the distributable pool)
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(toUSDC(90));

      // Status should be Swept (no claims needed)
      const poll = await pollPool.getPoll(emptyPollId);
      expect(poll.status).to.equal(3); // Swept
    });
  });

  describe("claimPayout", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;

      // Add participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      // Close and finalize
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.connect(creator).finalizePayouts(pollId);
    });

    it("should allow participant to claim their payout", async function () {
      const balanceBefore = await mockUSDC.balanceOf(participant1.address);

      await pollPool.connect(participant1).claimPayout(pollId);

      const balanceAfter = await mockUSDC.balanceOf(participant1.address);

      // 90 USDC / 3 = 30 USDC
      expect(balanceAfter - balanceBefore).to.equal(toUSDC(30));
    });

    it("should emit PayoutClaimed event", async function () {
      await expect(pollPool.connect(participant1).claimPayout(pollId))
        .to.emit(pollPool, "PayoutClaimed")
        .withArgs(pollId, participant1.address, toUSDC(30));
    });

    it("should mark participant as claimed", async function () {
      await pollPool.connect(participant1).claimPayout(pollId);

      expect(await pollPool.hasClaimed(pollId, participant1.address)).to.be.true;
    });

    it("should revert on double claim", async function () {
      await pollPool.connect(participant1).claimPayout(pollId);

      await expect(
        pollPool.connect(participant1).claimPayout(pollId)
      ).to.be.revertedWithCustomError(pollPool, "AlreadyClaimed");
    });

    it("should revert if non-participant tries to claim", async function () {
      await expect(
        pollPool.connect(nonParticipant).claimPayout(pollId)
      ).to.be.revertedWithCustomError(pollPool, "NotParticipant");
    });

    it("should revert if poll is not finalized", async function () {
      // Create and close a poll without finalizing
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      const sig = await createAttestation(1n, participant1.address, await pollPool.getAddress(), attestationSigner);
      await pollPool.connect(participant1).submitResponse(1n, sig);
      await pollPool.connect(creator).closePoll(1n);

      await expect(
        pollPool.connect(participant1).claimPayout(1n)
      ).to.be.revertedWithCustomError(pollPool, "PollNotFinalized");
    });

    it("should revert if claim deadline has passed", async function () {
      // Fast forward past claim deadline (90 days)
      await time.increase(CLAIM_EXPIRY + 1);

      await expect(
        pollPool.connect(participant1).claimPayout(pollId)
      ).to.be.revertedWithCustomError(pollPool, "ClaimExpired");
    });

    it("should set status to Swept when all participants claim", async function () {
      await pollPool.connect(participant1).claimPayout(pollId);
      await pollPool.connect(participant2).claimPayout(pollId);
      await pollPool.connect(participant3).claimPayout(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept
    });

    it("should emit FundsDistributed event when all claim", async function () {
      await pollPool.connect(participant1).claimPayout(pollId);
      await pollPool.connect(participant2).claimPayout(pollId);

      await expect(pollPool.connect(participant3).claimPayout(pollId))
        .to.emit(pollPool, "FundsDistributed")
        .withArgs(pollId, 3, toUSDC(30), 0n);
    });
  });

  describe("sweepUnclaimedFunds", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;

      // Add participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      // Close and finalize
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.connect(creator).finalizePayouts(pollId);

      // Only participant1 claims
      await pollPool.connect(participant1).claimPayout(pollId);
    });

    it("should allow sweeper to sweep unclaimed funds after deadline", async function () {
      // Fast forward past claim deadline
      await time.increase(CLAIM_EXPIRY + 1);

      const treasuryBalanceBefore = await mockUSDC.balanceOf(treasury.address);

      await pollPool.connect(owner).sweepUnclaimedFunds(pollId);

      const treasuryBalanceAfter = await mockUSDC.balanceOf(treasury.address);

      // 2 participants didn't claim: 30 USDC * 2 = 60 USDC
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(toUSDC(60));
    });

    it("should emit UnclaimedFundsSwept event", async function () {
      await time.increase(CLAIM_EXPIRY + 1);

      await expect(pollPool.connect(owner).sweepUnclaimedFunds(pollId))
        .to.emit(pollPool, "UnclaimedFundsSwept")
        .withArgs(pollId, owner.address, toUSDC(60));
    });

    it("should set status to Swept", async function () {
      await time.increase(CLAIM_EXPIRY + 1);

      await pollPool.connect(owner).sweepUnclaimedFunds(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept
    });

    it("should revert if claim deadline has not passed", async function () {
      await expect(
        pollPool.connect(owner).sweepUnclaimedFunds(pollId)
      ).to.be.revertedWithCustomError(pollPool, "ClaimNotExpired");
    });

    it("should revert if caller doesn't have SWEEPER_ROLE", async function () {
      await time.increase(CLAIM_EXPIRY + 1);

      await expect(
        pollPool.connect(nonParticipant).sweepUnclaimedFunds(pollId)
      ).to.be.reverted;
    });

    it("should revert if poll is not finalized", async function () {
      // Create and close a poll without finalizing
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      await pollPool.connect(creator).closePoll(1n);

      await time.increase(CLAIM_EXPIRY + 1);

      await expect(
        pollPool.connect(owner).sweepUnclaimedFunds(1n)
      ).to.be.revertedWithCustomError(pollPool, "PollNotFinalized");
    });

    it("should revert if all funds already claimed (status is Swept)", async function () {
      // All participants claim (including participant1 from beforeEach)
      await pollPool.connect(participant2).claimPayout(pollId);
      await pollPool.connect(participant3).claimPayout(pollId);

      // When all claim, status becomes Swept
      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept

      await time.increase(CLAIM_EXPIRY + 1);

      // Sweep fails because poll is already Swept (not Finalized)
      await expect(
        pollPool.connect(owner).sweepUnclaimedFunds(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotFinalized");
    });
  });

  describe("Legacy distribute function", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;

      // Add participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      // Close poll (but don't finalize - legacy workflow)
      await pollPool.connect(creator).closePoll(pollId);
    });

    it("should distribute funds using legacy push model", async function () {
      const p1Before = await mockUSDC.balanceOf(participant1.address);
      const p2Before = await mockUSDC.balanceOf(participant2.address);
      const p3Before = await mockUSDC.balanceOf(participant3.address);

      await pollPool.distribute(pollId);

      const p1After = await mockUSDC.balanceOf(participant1.address);
      const p2After = await mockUSDC.balanceOf(participant2.address);
      const p3After = await mockUSDC.balanceOf(participant3.address);

      // 90 USDC / 3 = 30 USDC each
      expect(p1After - p1Before).to.equal(toUSDC(30));
      expect(p2After - p2Before).to.equal(toUSDC(30));
      expect(p3After - p3Before).to.equal(toUSDC(30));
    });

    it("should set status to Swept after legacy distribute", async function () {
      await pollPool.distribute(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept
    });

    it("should emit FundsDistributed event", async function () {
      await expect(pollPool.distribute(pollId))
        .to.emit(pollPool, "FundsDistributed")
        .withArgs(pollId, 3, toUSDC(30), 0n);
    });
  });

  describe("View Functions", function () {
    let pollId: bigint;

    beforeEach(async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      pollId = 0n;

      // Add participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);

      // Close and finalize
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.connect(creator).finalizePayouts(pollId);
    });

    it("getClaimableAmount should return correct amount for unclaimed participant", async function () {
      const claimable = await pollPool.getClaimableAmount(pollId, participant1.address);
      expect(claimable).to.equal(toUSDC(45)); // 90 USDC / 2 participants
    });

    it("getClaimableAmount should return 0 for claimed participant", async function () {
      await pollPool.connect(participant1).claimPayout(pollId);

      const claimable = await pollPool.getClaimableAmount(pollId, participant1.address);
      expect(claimable).to.equal(0n);
    });

    it("getClaimableAmount should return 0 for non-participant", async function () {
      const claimable = await pollPool.getClaimableAmount(pollId, nonParticipant.address);
      expect(claimable).to.equal(0n);
    });

    it("getUnclaimedCount should return correct count", async function () {
      expect(await pollPool.getUnclaimedCount(pollId)).to.equal(2);

      await pollPool.connect(participant1).claimPayout(pollId);

      expect(await pollPool.getUnclaimedCount(pollId)).to.equal(1);
    });

    it("getClaimDeadline should return correct deadline", async function () {
      const poll = await pollPool.getPoll(pollId);
      const expectedDeadline = poll.closedAt + BigInt(CLAIM_EXPIRY);

      expect(await pollPool.getClaimDeadline(pollId)).to.equal(expectedDeadline);
    });

    it("canSweep should return false before deadline", async function () {
      expect(await pollPool.canSweep(pollId)).to.be.false;
    });

    it("canSweep should return true after deadline with unclaimed funds", async function () {
      await time.increase(CLAIM_EXPIRY + 1);

      expect(await pollPool.canSweep(pollId)).to.be.true;
    });

    it("getDistributionProgress should return correct values", async function () {
      const [distributed, total, isComplete] = await pollPool.getDistributionProgress(pollId);

      expect(distributed).to.equal(0);
      expect(total).to.equal(2);
      expect(isComplete).to.be.false;

      await pollPool.connect(participant1).claimPayout(pollId);
      await pollPool.connect(participant2).claimPayout(pollId);

      const [distributed2, total2, isComplete2] = await pollPool.getDistributionProgress(pollId);

      expect(distributed2).to.equal(2);
      expect(total2).to.equal(2);
      expect(isComplete2).to.be.true;
    });
  });

  describe("Happy Path: Full Claim-Based Lifecycle", function () {
    it("should complete full lifecycle: create -> submit -> close -> finalize -> claim", async function () {
      // 1. Create poll
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        5,
        DURATION,
        toUSDC(100)
      );
      const pollId = 0n;

      // Verify poll created
      let poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(0); // Active

      // 2. Submit responses (3 participants)
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      // Verify participation
      poll = await pollPool.getPoll(pollId);
      expect(poll.participantCount).to.equal(3);

      // 3. Close poll
      await pollPool.connect(creator).closePoll(pollId);

      poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(1); // Closed

      // 4. Finalize payouts (creator)
      await pollPool.connect(creator).finalizePayouts(pollId);

      poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(2); // Finalized

      // 5. Participants claim their payouts
      const p1Before = await mockUSDC.balanceOf(participant1.address);
      const p2Before = await mockUSDC.balanceOf(participant2.address);
      const p3Before = await mockUSDC.balanceOf(participant3.address);

      await pollPool.connect(participant1).claimPayout(pollId);
      await pollPool.connect(participant2).claimPayout(pollId);
      await pollPool.connect(participant3).claimPayout(pollId);

      const p1After = await mockUSDC.balanceOf(participant1.address);
      const p2After = await mockUSDC.balanceOf(participant2.address);
      const p3After = await mockUSDC.balanceOf(participant3.address);

      // 90 USDC / 3 = 30 USDC each
      expect(p1After - p1Before).to.equal(toUSDC(30));
      expect(p2After - p2Before).to.equal(toUSDC(30));
      expect(p3After - p3Before).to.equal(toUSDC(30));

      // Verify final status
      poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept (all claimed)
    });

    it("should handle partial claims and sweep after deadline", async function () {
      // Create poll
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        5,
        DURATION,
        toUSDC(100)
      );
      const pollId = 0n;

      // Submit responses
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);

      // Close and finalize
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.connect(creator).finalizePayouts(pollId);

      // Only participant1 claims
      await pollPool.connect(participant1).claimPayout(pollId);

      // Fast forward past claim deadline
      await time.increase(CLAIM_EXPIRY + 1);

      // Treasury sweeps unclaimed
      const treasuryBefore = await mockUSDC.balanceOf(treasury.address);

      await pollPool.connect(owner).sweepUnclaimedFunds(pollId);

      const treasuryAfter = await mockUSDC.balanceOf(treasury.address);

      // 45 USDC unclaimed by participant2
      expect(treasuryAfter - treasuryBefore).to.equal(toUSDC(45));

      // Verify final status
      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Swept
    });
  });

  describe("Pause Functionality", function () {
    it("should allow PAUSER_ROLE to pause", async function () {
      await pollPool.connect(owner).pause();
      expect(await pollPool.paused()).to.be.true;
    });

    it("should prevent operations when paused", async function () {
      await pollPool.connect(owner).pause();

      await expect(
        pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, DURATION, FUND_AMOUNT)
      ).to.be.revertedWithCustomError(pollPool, "EnforcedPause");
    });

    it("should allow PAUSER_ROLE to unpause", async function () {
      await pollPool.connect(owner).pause();
      await pollPool.connect(owner).unpause();
      expect(await pollPool.paused()).to.be.false;
    });
  });

  describe("Gas Optimization Checks", function () {
    it("should log gas used for key operations", async function () {
      // Create poll
      const createTx = await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );
      const createReceipt = await createTx.wait();
      console.log(`    Gas used for createPoll: ${createReceipt?.gasUsed}`);

      // Submit response
      const sig = await createAttestation(0n, participant1.address, await pollPool.getAddress(), attestationSigner);
      const submitTx = await pollPool.connect(participant1).submitResponse(0n, sig);
      const submitReceipt = await submitTx.wait();
      console.log(`    Gas used for submitResponse: ${submitReceipt?.gasUsed}`);

      // Close poll
      const closeTx = await pollPool.connect(creator).closePoll(0n);
      const closeReceipt = await closeTx.wait();
      console.log(`    Gas used for closePoll: ${closeReceipt?.gasUsed}`);

      // Finalize payouts
      const finalizeTx = await pollPool.connect(creator).finalizePayouts(0n);
      const finalizeReceipt = await finalizeTx.wait();
      console.log(`    Gas used for finalizePayouts: ${finalizeReceipt?.gasUsed}`);

      // Claim payout
      const claimTx = await pollPool.connect(participant1).claimPayout(0n);
      const claimReceipt = await claimTx.wait();
      console.log(`    Gas used for claimPayout: ${claimReceipt?.gasUsed}`);
    });
  });
});
