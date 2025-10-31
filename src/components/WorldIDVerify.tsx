"use client";

import { IDKitWidget } from "@worldcoin/idkit";
import { useState } from "react";
import type { WorldIDProof } from "@/lib/worldcoin";

interface WorldIDVerifyProps {
  pollId?: string;
  walletAddress?: string;
  onVerificationSuccess: (proof: WorldIDProof) => void;
  onVerificationError?: (error: Error) => void;
}

export function WorldIDVerify({
  pollId,
  walletAddress,
  onVerificationSuccess,
  onVerificationError,
}: WorldIDVerifyProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (result: any) => {
    setIsVerifying(true);
    try {
      // Convert IDKit result to our WorldIDProof format
      const proof: WorldIDProof = {
        merkle_root: result.merkle_root,
        nullifier_hash: result.nullifier_hash,
        proof: result.proof,
        credential_type: result.credential_type || "orb",
        action: result.action,
        signal: result.signal,
      };

      // Send proof to backend for verification
      const response = await fetch("/api/worldid/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proof,
          pollId,
          walletAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Verification failed");
      }

      const data = await response.json();
      onVerificationSuccess(proof);
    } catch (error) {
      console.error("World ID verification error:", error);
      onVerificationError?.(
        error instanceof Error ? error : new Error("Verification failed")
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Get app ID from environment (client-side needs NEXT_PUBLIC_ prefix)
  const appId = process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID;
  if (!appId || !appId.startsWith("app_")) {
    return (
      <div className="text-red-500 text-sm">
        Worldcoin App ID not configured. Please set NEXT_PUBLIC_WORLDCOIN_APP_ID in .env.local
      </div>
    );
  }

  const action = pollId ? `poll:${pollId}` : "poll-in-cash";
  const signal = walletAddress || "";

  return (
    <IDKitWidget
      app_id={appId as `app_${string}`}
      action={action}
      signal={signal}
      onSuccess={handleVerify}
    >
      {({ open }) => (
        <button
          onClick={open}
          disabled={isVerifying}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVerifying ? "Verifying..." : "Verify with World ID"}
        </button>
      )}
    </IDKitWidget>
  );
}

