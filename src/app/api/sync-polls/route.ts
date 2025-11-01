/**
 * Sync existing on-chain polls to Firestore
 * This backfills polls that were created before the webhook was configured
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyFirestoreConnection } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { readContract, getContract } from "thirdweb";
import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { pollEscrowABI } from "@/lib/pollEscrowABI";

export async function POST(request: NextRequest) {
  try {
    // Get contract address directly (don't import from contracts.ts which has client-side code)
    const escrowAddress = process.env.NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS;
    if (!escrowAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "POLL_ESCROW_CONTRACT_ADDRESS not set in environment variables",
        },
        { status: 500 }
      );
    }
    
    // Create server-side client for API route (can use clientId or secretKey)
    // For reads, clientId is sufficient
    const serverClient = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });
    
    const contract = getContract({
      client: serverClient,
      chain: baseSepolia,
      address: escrowAddress as `0x${string}`,
      abi: pollEscrowABI as any,
    });

    // Get total poll count
    console.log(`Reading poll counter from contract: ${escrowAddress}`);
    console.log(`Using clientId: ${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ? 'set' : 'missing'}`);
    
    let pollCounter;
    try {
      pollCounter = await readContract({
        contract,
        method: "function getPollCounter() view returns (uint256)",
        params: [],
      });
      console.log(`Poll counter result: ${pollCounter}`);
    } catch (error) {
      console.error("Error reading poll counter:", error);
      return NextResponse.json({
        success: false,
        error: "Failed to read poll counter from contract",
        message: error instanceof Error ? error.message : "Unknown error",
        details: {
          contractAddress: escrowAddress,
          clientIdSet: !!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
        },
      }, { status: 500 });
    }

    const totalPolls = Number(pollCounter);
    console.log(`Total polls found: ${totalPolls}`);
    
    if (totalPolls === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No polls found on-chain (poll counter is 0)",
        synced: 0,
        total: 0,
        contractAddress: escrowAddress,
      });
    }

    // Test Firestore connection before attempting writes
    const connectionOk = await verifyFirestoreConnection();
    if (!connectionOk) {
      return NextResponse.json({
        success: false,
        error: "Firestore database not accessible",
        message: "Could not establish connection to Firestore",
        hint: "Ensure Firestore database is created in Firebase Console and service account has proper permissions"
      }, { status: 500 });
    }

    let synced = 0;
    const errors: string[] = [];

    // Sync each poll
    for (let pollId = 1; pollId <= totalPolls; pollId++) {
      try {
        console.log(`Reading poll info for poll ID: ${pollId}`);
        // Get poll info from contract
        const pollInfo = await readContract({
          contract,
          method:
            "function getPollInfo(uint256) view returns (address creator, uint256 rewardPool, uint256 rewardPerUser, uint256 completedCount, uint256 maxCompletions, bool isActive)",
          params: [BigInt(pollId)],
        });
        
        console.log(`Poll ${pollId} info:`, {
          creator: pollInfo[0],
          rewardPool: pollInfo[1].toString(),
          rewardPerUser: pollInfo[2].toString(),
          completedCount: pollInfo[3].toString(),
          maxCompletions: pollInfo[4].toString(),
          isActive: pollInfo[5],
        });

        const pollRef = adminDb.collection("polls").doc(pollId.toString());

        // Check if poll already exists to preserve created_at timestamp
        const existing = await pollRef.get();
        const isNew = !existing.exists;

        // Use set with merge to create or update (avoids NOT_FOUND errors from update())
        const pollData: any = {
          poll_id: pollId.toString(),
          creator_wallet: (pollInfo[0] as string).toLowerCase(),
          reward_pool: pollInfo[1].toString(),
          reward_per_user: pollInfo[2].toString(),
          max_completions: pollInfo[4].toString(),
          completed_count: Number(pollInfo[3]),
          status: pollInfo[5] ? "live" : "closed",
          escrow_address: escrowAddress,
          tx_hash: null, // Can't get from contract state, would need event query
          block_number: null,
          updated_at: FieldValue.serverTimestamp(),
        };

        // Only set created_at for new documents
        if (isNew) {
          pollData.created_at = FieldValue.serverTimestamp();
        }

        await pollRef.set(pollData, { merge: true });
        
        synced++;
        console.log(`${isNew ? 'Created' : 'Updated'} poll ${pollId} in Firestore`);
      } catch (error) {
        const errorMsg = `Poll ${pollId}: ${error instanceof Error ? error.message : "Unknown error"}`;
        const errorDetails = error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code, // gRPC status code
        } : error;
        
        errors.push(errorMsg);
        console.error(errorMsg, errorDetails);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} of ${totalPolls} polls`,
      synced,
      total: totalPolls,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync polls error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync polls",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
