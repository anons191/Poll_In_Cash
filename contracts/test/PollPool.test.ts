import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { PollPool, MockUSDC } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PollPool", function () {
  let pollPool: PollPool;
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

    // Deploy PollPool
    const PollPoolFactory = await ethers.getContractFactory("PollPool");
    pollPool = await PollPoolFactory.deploy(
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

    it("should set the correct owner", async function () {
      expect(await pollPool.owner()).to.equal(owner.address);
    });

    it("should revert on zero USDC address", async function () {
      const PollPoolFactory = await ethers.getContractFactory("PollPool");
      await expect(
        PollPoolFactory.deploy(ethers.ZeroAddress, treasury.address, attestationSigner.address)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAddress");
    });

    it("should revert on zero treasury address", async function () {
      const PollPoolFactory = await ethers.getContractFactory("PollPool");
      await expect(
        PollPoolFactory.deploy(await mockUSDC.getAddress(), ethers.ZeroAddress, attestationSigner.address)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAddress");
    });

    it("should revert on zero attestation signer address", async function () {
      const PollPoolFactory = await ethers.getContractFactory("PollPool");
      await expect(
        PollPoolFactory.deploy(await mockUSDC.getAddress(), treasury.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAddress");
    });
  });

  describe("createPoll", function () {
    it("should create a poll successfully", async function () {
      const tx = await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const receipt = await tx.wait();
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

    it("should transfer USDC from creator to contract", async function () {
      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);
      const contractBalanceBefore = await mockUSDC.balanceOf(await pollPool.getAddress());

      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
      const contractBalanceAfter = await mockUSDC.balanceOf(await pollPool.getAddress());

      expect(creatorBalanceBefore - creatorBalanceAfter).to.equal(FUND_AMOUNT);
      expect(contractBalanceAfter - contractBalanceBefore).to.equal(toUSDC(90)); // 90% kept in contract
    });

    it("should emit PollCreated event", async function () {
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;

      await expect(
        pollPool.connect(creator).createPoll(
          POLL_TITLE,
          CRITERIA_HASH,
          PARTICIPANT_CAP,
          DURATION,
          FUND_AMOUNT
        )
      )
        .to.emit(pollPool, "PollCreated")
        .withArgs(
          0n,
          creator.address,
          POLL_TITLE,
          CRITERIA_HASH,
          FUND_AMOUNT,
          toUSDC(90),
          PARTICIPANT_CAP,
          (value: bigint) => value > BigInt(blockTimestamp) // expiresAt is in the future
        );
    });

    it("should increment pollId for each new poll", async function () {
      await pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, DURATION, FUND_AMOUNT);
      await pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, DURATION, FUND_AMOUNT);
      await pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, DURATION, FUND_AMOUNT);

      expect(await pollPool.nextPollId()).to.equal(3);
    });

    it("should revert with zero fund amount", async function () {
      await expect(
        pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, DURATION, 0)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAmount");
    });

    it("should revert with zero participant cap", async function () {
      await expect(
        pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, 0, DURATION, FUND_AMOUNT)
      ).to.be.revertedWithCustomError(pollPool, "InvalidParticipantCap");
    });

    it("should revert with zero duration", async function () {
      await expect(
        pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, PARTICIPANT_CAP, 0, FUND_AMOUNT)
      ).to.be.revertedWithCustomError(pollPool, "InvalidDuration");
    });

    it("should calculate fee correctly for various amounts", async function () {
      const amounts = [toUSDC(50), toUSDC(100), toUSDC(1000), toUSDC(999)];

      for (const amount of amounts) {
        // Mint fresh USDC for each test
        await mockUSDC.mint(creator.address, amount);

        const treasuryBefore = await mockUSDC.balanceOf(treasury.address);

        await pollPool.connect(creator).createPoll(
          POLL_TITLE,
          CRITERIA_HASH,
          PARTICIPANT_CAP,
          DURATION,
          amount
        );

        const treasuryAfter = await mockUSDC.balanceOf(treasury.address);
        const expectedFee = amount / 10n; // 10%

        expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
      }
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

    it("should track participants correctly", async function () {
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      const participants = await pollPool.getParticipants(pollId);
      expect(participants.length).to.equal(3);
      expect(participants).to.include(participant1.address);
      expect(participants).to.include(participant2.address);
      expect(participants).to.include(participant3.address);
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

    it("should revert on invalid attestation signature", async function () {
      // Sign with wrong signer
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

    it("should revert when attestation is for wrong participant", async function () {
      const signature = await createAttestation(
        pollId,
        participant1.address, // attested for participant1
        await pollPool.getAddress(),
        attestationSigner
      );

      // Try to use it for participant2
      await expect(
        pollPool.connect(participant2).submitResponse(pollId, signature)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAttestation");
    });

    it("should revert when participant cap is reached", async function () {
      // Create poll with cap of 2
      await pollPool.connect(creator).createPoll(POLL_TITLE, CRITERIA_HASH, 2, DURATION, FUND_AMOUNT);
      const smallPollId = 1n;

      const sig1 = await createAttestation(smallPollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(smallPollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(smallPollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(smallPollId, sig1);
      await pollPool.connect(participant2).submitResponse(smallPollId, sig2);

      await expect(
        pollPool.connect(participant3).submitResponse(smallPollId, sig3)
      ).to.be.revertedWithCustomError(pollPool, "ParticipantCapReached");
    });

    it("should revert when poll is closed", async function () {
      await pollPool.connect(creator).closePoll(pollId);

      const signature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      await expect(
        pollPool.connect(participant1).submitResponse(pollId, signature)
      ).to.be.revertedWithCustomError(pollPool, "PollNotActive");
    });

    it("should revert when poll has expired", async function () {
      await time.increase(DURATION + 1);

      const signature = await createAttestation(
        pollId,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      await expect(
        pollPool.connect(participant1).submitResponse(pollId, signature)
      ).to.be.revertedWithCustomError(pollPool, "PollNotActive");
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

    it("should emit PollClosed event", async function () {
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      await pollPool.connect(participant1).submitResponse(pollId, sig1);

      await expect(pollPool.connect(creator).closePoll(pollId))
        .to.emit(pollPool, "PollClosed")
        .withArgs(pollId, creator.address, 1);
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

    it("should revert if poll is already closed", async function () {
      await pollPool.connect(creator).closePoll(pollId);

      await expect(
        pollPool.connect(creator).closePoll(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotActive");
    });
  });

  describe("distribute", function () {
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

    it("should distribute funds evenly to participants", async function () {
      // Add 3 participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);
      const sig3 = await createAttestation(pollId, participant3.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);
      await pollPool.connect(participant3).submitResponse(pollId, sig3);

      await pollPool.connect(creator).closePoll(pollId);

      const balance1Before = await mockUSDC.balanceOf(participant1.address);
      const balance2Before = await mockUSDC.balanceOf(participant2.address);
      const balance3Before = await mockUSDC.balanceOf(participant3.address);

      await pollPool.distribute(pollId);

      const balance1After = await mockUSDC.balanceOf(participant1.address);
      const balance2After = await mockUSDC.balanceOf(participant2.address);
      const balance3After = await mockUSDC.balanceOf(participant3.address);

      // 90 USDC / 3 participants = 30 USDC each
      expect(balance1After - balance1Before).to.equal(toUSDC(30));
      expect(balance2After - balance2Before).to.equal(toUSDC(30));
      expect(balance3After - balance3Before).to.equal(toUSDC(30));
    });

    it("should emit FundsDistributed event", async function () {
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(creator).closePoll(pollId);

      await expect(pollPool.distribute(pollId))
        .to.emit(pollPool, "FundsDistributed")
        .withArgs(pollId, 1, toUSDC(90), 0n);
    });

    it("should return unused funds to creator when cap not reached", async function () {
      // Only 2 participants for a pool meant for 10
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);

      await pollPool.connect(creator).closePoll(pollId);

      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.distribute(pollId);

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);

      // 90 USDC / 2 = 45 USDC each
      // Remainder (90 - 90 = 0) goes back to creator
      // In this case, it divides evenly
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(0n);
    });

    it("should handle rounding and return remainder to creator", async function () {
      // Create poll with 100 USDC, 90 USDC distributable
      // 90 USDC = 90,000,000 micro-USDC (6 decimals)
      // 7 participants: 90,000,000 / 7 = 12,857,142 micro-USDC each (integer division)
      // Total distributed: 12,857,142 * 7 = 89,999,994 micro-USDC
      // Remainder: 90,000,000 - 89,999,994 = 6 micro-USDC returned to creator

      // We need 7 participants
      const signers = await ethers.getSigners();
      const testParticipants = signers.slice(4, 11); // 7 participants

      for (const participant of testParticipants) {
        const sig = await createAttestation(pollId, participant.address, await pollPool.getAddress(), attestationSigner);
        await pollPool.connect(participant).submitResponse(pollId, sig);
      }

      await pollPool.connect(creator).closePoll(pollId);

      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.distribute(pollId);

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);

      // Remainder is 6 micro-USDC (raw units, not 6 USDC)
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(6n);
    });

    it("should refund all funds to creator when zero participants", async function () {
      await pollPool.connect(creator).closePoll(pollId);

      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.distribute(pollId);

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);

      // All 90 USDC returned to creator
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(toUSDC(90));
    });

    it("should update poll status to Distributed", async function () {
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.distribute(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(2); // Distributed
    });

    it("should revert if poll is not closed", async function () {
      await expect(
        pollPool.distribute(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotClosed");
    });

    it("should revert if already distributed", async function () {
      await pollPool.connect(creator).closePoll(pollId);
      await pollPool.distribute(pollId);

      await expect(
        pollPool.distribute(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotClosed");
    });
  });

  describe("refund", function () {
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

    it("should allow creator to cancel and refund", async function () {
      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.connect(creator).refund(pollId);

      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);

      // Should get back 90 USDC (fee already taken)
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(toUSDC(90));
    });

    it("should emit PollCancelled event", async function () {
      await expect(pollPool.connect(creator).refund(pollId))
        .to.emit(pollPool, "PollCancelled")
        .withArgs(pollId, creator.address, toUSDC(90));
    });

    it("should update poll status to Cancelled", async function () {
      await pollPool.connect(creator).refund(pollId);

      const poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(3); // Cancelled
    });

    it("should revert if non-creator tries to refund", async function () {
      await expect(
        pollPool.connect(nonParticipant).refund(pollId)
      ).to.be.revertedWithCustomError(pollPool, "NotPollCreator");
    });

    it("should revert if poll is already closed", async function () {
      await pollPool.connect(creator).closePoll(pollId);

      await expect(
        pollPool.connect(creator).refund(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotActive");
    });

    it("should revert if poll is already cancelled", async function () {
      await pollPool.connect(creator).refund(pollId);

      await expect(
        pollPool.connect(creator).refund(pollId)
      ).to.be.revertedWithCustomError(pollPool, "PollNotActive");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update treasury", async function () {
      const newTreasury = nonParticipant.address;

      await expect(pollPool.connect(owner).setTreasury(newTreasury))
        .to.emit(pollPool, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury);

      expect(await pollPool.treasury()).to.equal(newTreasury);
    });

    it("should revert if non-owner tries to update treasury", async function () {
      await expect(
        pollPool.connect(nonParticipant).setTreasury(nonParticipant.address)
      ).to.be.revertedWithCustomError(pollPool, "OwnableUnauthorizedAccount");
    });

    it("should revert on zero treasury address", async function () {
      await expect(
        pollPool.connect(owner).setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAddress");
    });

    it("should allow owner to update attestation signer", async function () {
      const newSigner = nonParticipant.address;

      await expect(pollPool.connect(owner).setAttestationSigner(newSigner))
        .to.emit(pollPool, "AttestationSignerUpdated")
        .withArgs(attestationSigner.address, newSigner);

      expect(await pollPool.attestationSigner()).to.equal(newSigner);
    });

    it("should revert if non-owner tries to update attestation signer", async function () {
      await expect(
        pollPool.connect(nonParticipant).setAttestationSigner(nonParticipant.address)
      ).to.be.revertedWithCustomError(pollPool, "OwnableUnauthorizedAccount");
    });

    it("should revert on zero attestation signer address", async function () {
      await expect(
        pollPool.connect(owner).setAttestationSigner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pollPool, "InvalidAddress");
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
    });

    it("should return correct payout calculation", async function () {
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);

      const payout = await pollPool.calculatePayout(pollId);
      // 90 USDC / 2 = 45 USDC each
      expect(payout).to.equal(toUSDC(45));
    });

    it("should return zero payout for zero participants", async function () {
      const payout = await pollPool.calculatePayout(pollId);
      expect(payout).to.equal(0);
    });

    it("should correctly report poll expiry status", async function () {
      expect(await pollPool.isPollExpired(pollId)).to.be.false;

      await time.increase(DURATION + 1);

      expect(await pollPool.isPollExpired(pollId)).to.be.true;
    });
  });

  describe("Happy Path: Full Lifecycle", function () {
    it("should complete full lifecycle: create -> submit -> close -> distribute", async function () {
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

      // 4. Distribute
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

      // Verify final status
      poll = await pollPool.getPoll(pollId);
      expect(poll.status).to.equal(2); // Distributed
    });

    it("should handle partial fill: fewer participants than cap", async function () {
      // Create poll with cap of 10
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        10,
        DURATION,
        toUSDC(100)
      );
      const pollId = 0n;

      // Only 2 participants
      const sig1 = await createAttestation(pollId, participant1.address, await pollPool.getAddress(), attestationSigner);
      const sig2 = await createAttestation(pollId, participant2.address, await pollPool.getAddress(), attestationSigner);

      await pollPool.connect(participant1).submitResponse(pollId, sig1);
      await pollPool.connect(participant2).submitResponse(pollId, sig2);

      await pollPool.connect(creator).closePoll(pollId);

      const p1Before = await mockUSDC.balanceOf(participant1.address);
      const p2Before = await mockUSDC.balanceOf(participant2.address);
      const creatorBefore = await mockUSDC.balanceOf(creator.address);

      await pollPool.distribute(pollId);

      const p1After = await mockUSDC.balanceOf(participant1.address);
      const p2After = await mockUSDC.balanceOf(participant2.address);
      const creatorAfter = await mockUSDC.balanceOf(creator.address);

      // 90 USDC / 2 = 45 USDC each
      expect(p1After - p1Before).to.equal(toUSDC(45));
      expect(p2After - p2Before).to.equal(toUSDC(45));
      // No remainder
      expect(creatorAfter - creatorBefore).to.equal(0n);
    });
  });

  describe("Gas Optimization Checks", function () {
    it("should be reasonably gas efficient for poll creation", async function () {
      const tx = await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const receipt = await tx.wait();
      // Just log gas used - actual optimization would require comparison benchmarks
      console.log(`    Gas used for createPoll: ${receipt?.gasUsed}`);
    });

    it("should be reasonably gas efficient for response submission", async function () {
      await pollPool.connect(creator).createPoll(
        POLL_TITLE,
        CRITERIA_HASH,
        PARTICIPANT_CAP,
        DURATION,
        FUND_AMOUNT
      );

      const signature = await createAttestation(
        0n,
        participant1.address,
        await pollPool.getAddress(),
        attestationSigner
      );

      const tx = await pollPool.connect(participant1).submitResponse(0n, signature);
      const receipt = await tx.wait();

      console.log(`    Gas used for submitResponse: ${receipt?.gasUsed}`);
    });
  });
});
