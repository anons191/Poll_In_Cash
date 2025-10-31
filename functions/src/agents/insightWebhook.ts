/**
 * Thirdweb Insight Webhook Handler
 * Processes contract events (PollCreated, PollCompleted) from Insight webhooks
 */

import * as functions from "firebase-functions";
import { adminDb } from "../lib/firebaseAdmin";
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
 * POST /insight-webhook
 */
export const insightWebhook = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }
  // Verify webhook signature (if Insight provides one)
  // TODO: Add signature verification for production
  
  try {
    const event: InsightEvent = req.body;
    
    if (!event || !event.eventName) {
      res.status(400).json({ error: "Invalid event data" });
      return;
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
    
    res.status(200).json({ success: true, processed: eventName });
    return;
  } catch (error) {
    console.error("Insight webhook error:", error);
    res.status(500).json({ 
      error: "Webhook processing failed", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
    return;
  }
});

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
  
  await pollRef.set({
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
  }, { merge: true });
  
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
  
  console.log(`PollCompleted event processed: ${data.pollId} - ${data.participant}`);
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

