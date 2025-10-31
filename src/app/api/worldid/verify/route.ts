import { NextRequest, NextResponse } from "next/server";
import { verifyWorldID, type WorldIDProof } from "@/lib/worldcoin";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { z } from "zod";

const verifyRequestSchema = z.object({
  proof: z.object({
    merkle_root: z.string(),
    nullifier_hash: z.string(),
    proof: z.string(),
    credential_type: z.enum(["orb", "phone"]),
    action: z.string(),
    signal: z.string().optional(),
  }),
  pollId: z.string().optional(),
  walletAddress: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proof, pollId, walletAddress } = verifyRequestSchema.parse(body);

    // Verify proof with Worldcoin API
    const verificationResult = await verifyWorldID(proof as WorldIDProof);

    if (!verificationResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid World ID proof" },
        { status: 400 }
      );
    }

    // Check if nullifier hash already used for this poll
    if (pollId) {
      const verificationsRef = collection(db, "verifications");
      const q = query(
        verificationsRef,
        where("poll_id", "==", pollId),
        where("nullifier_hash", "==", proof.nullifier_hash)
      );

      const existingDocs = await getDocs(q);
      if (!existingDocs.empty) {
        return NextResponse.json(
          { success: false, message: "This World ID has already been used for this poll" },
          { status: 409 }
        );
      }

      // Store verification in Firestore
      await addDoc(collection(db, "verifications"), {
        poll_id: pollId,
        wallet: walletAddress || "",
        nullifier_hash: proof.nullifier_hash,
        action: proof.action,
        verified_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      nullifierHash: proof.nullifier_hash,
      message: "World ID verified successfully",
    });
  } catch (error) {
    console.error("World ID verification error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Invalid request data", errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}

