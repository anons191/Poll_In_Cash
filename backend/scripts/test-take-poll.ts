#!/usr/bin/env npx tsx
/**
 * Test script to take a poll as an agent
 * This authenticates using the deployer wallet and submits a poll response
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

interface VerifyResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

interface Poll {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
  cashPoolUsdc: string;
  participantCap: number;
  criteria: Record<string, unknown>;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Poll in Cash - Agent Poll Test");
  console.log("=".repeat(60));
  console.log();

  // Step 1: Create wallet from private key
  console.log("[1] Creating wallet from private key...");
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const walletAddress = wallet.address;
  console.log(`    Wallet address: ${walletAddress}`);
  console.log();

  // Step 2: Request nonce
  console.log("[2] Requesting authentication nonce...");
  const nonceResponse = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!nonceResponse.ok) {
    const error = await nonceResponse.text();
    throw new Error(`Failed to get nonce: ${error}`);
  }

  const { nonce, message } = (await nonceResponse.json()) as NonceResponse;
  console.log(`    Nonce received: ${nonce.substring(0, 16)}...`);
  console.log();

  // Step 3: Sign the message
  console.log("[3] Signing authentication message...");
  const signature = await wallet.signMessage(message);
  console.log(`    Signature: ${signature.substring(0, 20)}...`);
  console.log();

  // Step 4: Verify signature and get JWT
  console.log("[4] Verifying signature and getting JWT...");
  const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, signature, nonce }),
  });

  if (!verifyResponse.ok) {
    const error = await verifyResponse.text();
    throw new Error(`Failed to verify: ${error}`);
  }

  const { token, user } = (await verifyResponse.json()) as VerifyResponse;
  console.log(`    JWT received for user: ${user.id}`);
  console.log(`    Wallet: ${user.walletAddress}`);
  console.log();

  // Step 5: Discover polls
  console.log("[5] Discovering available polls...");
  const discoverResponse = await fetch(
    `${API_BASE_URL}/agent/polls/discover?isVeteran=true&isRegisteredVoter=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!discoverResponse.ok) {
    const error = await discoverResponse.text();
    throw new Error(`Failed to discover polls: ${error}`);
  }

  const { polls } = await discoverResponse.json();
  console.log(`    Found ${polls.length} polls`);

  if (polls.length === 0) {
    console.log("    No eligible polls found!");
    return;
  }

  // Display eligible polls
  for (const poll of polls) {
    console.log();
    console.log(`    [${poll.eligible ? "ELIGIBLE" : "INELIGIBLE"}] ${poll.title}`);
    console.log(`        ID: ${poll.id}`);
    console.log(`        Payout: $${poll.payoutEstimate} USDC`);
    console.log(`        Spots: ${poll.spotsRemaining}/${poll.participantCap}`);
    if (poll.ineligibleReasons?.length > 0) {
      console.log(`        Reasons: ${poll.ineligibleReasons.join(", ")}`);
    }
  }
  console.log();

  // Find an eligible poll
  const eligiblePoll = polls.find((p: { eligible: boolean; spotsRemaining: number }) =>
    p.eligible && p.spotsRemaining > 0
  );

  if (!eligiblePoll) {
    console.log("    No eligible polls with spots remaining!");

    // Try to get poll details anyway
    const firstPoll = polls[0];
    console.log();
    console.log("[6] Getting poll details for:", firstPoll.title);

    const pollDetailResponse = await fetch(`${API_BASE_URL}/polls/${firstPoll.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (pollDetailResponse.ok) {
      const pollDetail = await pollDetailResponse.json() as Poll;
      console.log(`    Questions: ${pollDetail.questions?.length || 0}`);
      if (pollDetail.questions) {
        for (const q of pollDetail.questions) {
          console.log(`      - [${q.type}] ${q.text}`);
          if (q.options) {
            console.log(`        Options: ${q.options.join(", ")}`);
          }
        }
      }
    }
    return;
  }

  // Step 6: Get poll details
  console.log(`[6] Getting poll details for: ${eligiblePoll.title}`);
  const pollDetailResponse = await fetch(`${API_BASE_URL}/polls/${eligiblePoll.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!pollDetailResponse.ok) {
    // Try to proceed without full details
    console.log("    Could not get poll details, proceeding with discovery data...");
  }

  const pollDetail = pollDetailResponse.ok
    ? ((await pollDetailResponse.json()) as Poll)
    : null;

  const questions = pollDetail?.questions || eligiblePoll.questions || [];
  console.log(`    Questions: ${questions.length}`);

  if (questions.length === 0) {
    console.log("    No questions in poll! Cannot respond.");
    return;
  }

  // Display questions
  for (const q of questions) {
    console.log(`      - [${q.type}] ${q.text}`);
    if (q.options) {
      console.log(`        Options: ${q.options.join(", ")}`);
    }
  }
  console.log();

  // Step 7: Generate responses
  console.log("[7] Generating responses...");
  const responses = questions.map((q: { id: string; type: string; options?: string[] }) => {
    let answer: string | number;

    switch (q.type) {
      case "multiple_choice":
      case "multiple-choice":
        answer = q.options?.[0] || "Option A";
        break;
      case "rating":
        answer = 4;
        break;
      case "yes_no":
      case "yes-no":
        answer = "yes";
        break;
      case "text":
      case "open-ended":
        answer = "This is a thoughtful response from an AI agent participating in the poll.";
        break;
      default:
        answer = "default response";
    }

    console.log(`    Q: ${q.id} -> A: ${answer}`);
    return { questionId: q.id, answer };
  });
  console.log();

  // Step 8: Submit response
  console.log("[8] Submitting poll response...");
  const submitResponse = await fetch(
    `${API_BASE_URL}/agent/polls/${eligiblePoll.id}/respond`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        responses,
        confidenceScores: responses.map((r: { questionId: string }) => ({
          questionId: r.questionId,
          confidence: "high",
        })),
        attestationHash: "0x" + wallet.address.slice(2) + Date.now().toString(16).padStart(16, "0"),
      }),
    }
  );

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    console.log(`    ERROR: ${error}`);
    return;
  }

  const result = await submitResponse.json();
  console.log("    SUCCESS!");
  console.log(`    Response ID: ${result.id}`);
  console.log(`    Payout estimate: $${result.payoutEstimate} USDC`);
  console.log(`    Participant #${result.participantNumber}`);
  console.log();

  // Step 9: Check earnings
  console.log("[9] Checking earnings...");
  const earningsResponse = await fetch(`${API_BASE_URL}/agent/earnings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (earningsResponse.ok) {
    const earnings = await earningsResponse.json();
    console.log(`    Total earned: $${earnings.totalEarned} USDC`);
    console.log(`    Polls completed: ${earnings.pollsCompleted}`);
    console.log(`    Pending payouts: ${earnings.pendingPayouts}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("  Test Complete!");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
