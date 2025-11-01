/**
 * Thirdweb Insight Webhook Handler (Next.js API Route)
 * Processes contract events (PollCreated, PollCompleted, PollClosed) from Insight webhooks
 * 
 * This replaces the Firebase Function webhook to avoid requiring Blaze plan.
 * Configure webhook URL in Thirdweb Insight dashboard to point to this endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

interface InsightEvent {
  contractAddress: string;
  eventName: string;
  transactionHash: string;
  blockNumber: string;
  args: Record<string, any>;
}

/**
 * Webhook endpoint for Thirdweb Insight events
 * POST /api/insight-webhook
 */
export async function POST(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Set CORS headers for response
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // TODO: Verify webhook signature (if Insight provides one) for production
  try {
    const event: InsightEvent = await request.json();

    if (!event || !event.eventName) {
      return NextResponse.json(
        { error: "Invalid event data" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { eventName, args, transactionHash, blockNumber } = event;

    // Handle PollCreated event
    if (eventName === "PollCreated") {
      await handlePollCreated({
        pollId: args.pollId?.toString(),
        creator: args.creator,
        rewardPool: args.rewardPool?.toString(),
        rewardPerUser: args.rewardPerUser?.toString(),
        maxCompletions: args.maxCompletions?.toString(),
        transactionHash,
        blockNumber,
      });
    }

    // Handle PollCompleted event
    if (eventName === "PollCompleted") {
      await handlePollCompleted({
        pollId: args.pollId?.toString(),
        participant: args.participant,
        userPayout: args.userPayout?.toString(),
        platformFee: args.platformFee?.toString(),
        nullifierHash: args.nullifierHash,
        transactionHash,
        blockNumber,
      });
    }

    // Handle PollClosed event
    if (eventName === "PollClosed") {
      await handlePollClosed({
        pollId: args.pollId?.toString(),
        transactionHash,
      });
    }

    return NextResponse.json(
      { success: true, processed: eventName },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Insight webhook error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function handlePollCreated(data: {
  pollId: string;
  creator: string;
  rewardPool: string;
  rewardPerUser: string;
  maxCompletions: string;
  transactionHash: string;
  blockNumber: string;
}) {
  // Update or create poll document in Firestore
  const pollRef = adminDb.collection("polls").doc(data.pollId);

  await pollRef.set(
    {
      poll_id: data.pollId,
      creator_wallet: data.creator.toLowerCase(),
      reward_pool: data.rewardPool,
      reward_per_user: data.rewardPerUser,
      max_completions: data.maxCompletions,
      completed_count: 0,
      status: "live",
      escrow_address: data.pollId, // Will be set to contract address
      tx_hash: data.transactionHash,
      block_number: data.blockNumber,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`PollCreated event processed: ${data.pollId}`);
}

async function handlePollCompleted(data: {
  pollId: string;
  participant: string;
  userPayout: string;
  platformFee: string;
  nullifierHash: string;
  transactionHash: string;
  blockNumber: string;
}) {
  // Create payout log
  const payoutRef = adminDb.collection("payout_logs").doc();

  await payoutRef.set({
    poll_id: data.pollId,
    wallet: data.participant.toLowerCase(),
    amount: data.userPayout,
    fee: data.platformFee,
    nullifier_hash: data.nullifierHash,
    tx_hash: data.transactionHash,
    block_number: data.blockNumber,
    created_at: FieldValue.serverTimestamp(),
  });

  // Increment poll completion count
  const pollRef = adminDb.collection("polls").doc(data.pollId);
  await pollRef.update({
    completed_count: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log(
    `PollCompleted event processed: ${data.pollId} - ${data.participant}`
  );
}

async function handlePollClosed(data: {
  pollId: string;
  transactionHash: string;
}) {
  const pollRef = adminDb.collection("polls").doc(data.pollId);

  await pollRef.update({
    status: "closed",
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log(`PollClosed event processed: ${data.pollId}`);
}

