"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, query, orderBy, getDocs, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveAccount } from "thirdweb/react";
import { getPollEscrowAddress, bigIntToUsdc } from "@/lib/contracts";
import { WorldIDVerify } from "./WorldIDVerify";
import { useSendTransaction } from "thirdweb/react";
import { prepareContractCall, waitForReceipt } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { pollEscrowABI } from "@/lib/pollEscrowABI";
import { hasWalletVerified } from "@/lib/firestoreHelpers";
import type { WorldIDProof } from "@/lib/worldcoin";
import { StatusMessage } from "./ui/StatusMessage";

interface PollData {
  id: string;
  poll_id: string;
  creator_wallet: string;
  reward_pool: string;
  reward_per_user: string;
  max_completions: string;
  completed_count: number;
  status: string;
  created_at: Timestamp;
}

export function PollList() {
  const account = useActiveAccount();
  const [polls, setPolls] = useState<PollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingPollId, setVerifyingPollId] = useState<string | null>(null);
  const [hasVerified, setHasVerified] = useState<Record<string, boolean>>({});
  const [pollStatuses, setPollStatuses] = useState<Record<string, {
    type: "success" | "error" | "info";
    message: string;
    transactionHash?: string;
  } | null>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  const { mutate: sendTransaction } = useSendTransaction();

  const loadPolls = async () => {
    try {
      setLoading(true);
      const pollsRef = collection(db, "polls");
      const q = query(pollsRef, orderBy("created_at", "desc"));
      const querySnapshot = await getDocs(q);
      
      const pollsData: PollData[] = [];
      querySnapshot.forEach((doc) => {
        pollsData.push({
          id: doc.id,
          ...doc.data(),
        } as PollData);
      });
      
      setPolls(pollsData);
    } catch (err) {
      console.error("Error loading polls:", err);
      setError("Failed to load polls");
    } finally {
      setLoading(false);
    }
  };

  const checkVerifications = useCallback(async () => {
    if (!account) return;
    
    const verificationStatus: Record<string, boolean> = {};
    for (const poll of polls) {
      try {
        const verified = await hasWalletVerified(poll.poll_id, account.address);
        verificationStatus[poll.poll_id] = verified;
      } catch (err) {
        console.error(`Error checking verification for poll ${poll.poll_id}:`, err);
      }
    }
    setHasVerified(verificationStatus);
  }, [account, polls]);

  const syncPolls = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/sync-polls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setSyncMessage(`✅ ${data.message}`);
        // Reload polls after sync
        await loadPolls();
      } else {
        setSyncMessage(`❌ ${data.message || "Failed to sync polls"}`);
      }
    } catch (err) {
      console.error("Error syncing polls:", err);
      setSyncMessage("❌ Failed to sync polls from chain");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  useEffect(() => {
    if (account && polls.length > 0) {
      checkVerifications();
    }
  }, [account, polls, checkVerifications]);

  const handleVerificationSuccess = async (pollId: string, proof: WorldIDProof) => {
    if (!account) return;

    try {
      setVerifyingPollId(pollId);
      const escrowAddress = getPollEscrowAddress();
      const escrowContract = {
        client,
        chain,
        address: escrowAddress as `0x${string}`,
        abi: pollEscrowABI as any,
      };

      // Ensure nullifier hash is in the correct format (bytes32)
      const nullifierHash = proof.nullifier_hash.startsWith("0x") 
        ? (proof.nullifier_hash as `0x${string}`)
        : (`0x${proof.nullifier_hash}` as `0x${string}`);
      
      const completePollTx = prepareContractCall({
        contract: escrowContract,
        method: "completePoll",
        params: [BigInt(pollId), nullifierHash],
      });

      sendTransaction(
        completePollTx,
        {
          onSuccess: async (result) => {
            try {
              const receipt = await waitForReceipt({ client, chain, transactionHash: result.transactionHash });
              setPollStatuses(prev => ({
                ...prev,
                [pollId]: {
                  type: "success",
                  message: "Poll completed successfully! You will receive your USDC reward shortly.",
                  transactionHash: result.transactionHash,
                },
              }));
              setHasVerified(prev => ({ ...prev, [pollId]: true }));
              await loadPolls(); // Refresh poll data
              setVerifyingPollId(null);
            } catch (receiptError: any) {
              setPollStatuses(prev => ({
                ...prev,
                [pollId]: {
                  type: "error",
                  message: `Transaction sent but receipt error: ${receiptError.message}`,
                },
              }));
              setVerifyingPollId(null);
            }
          },
          onError: (error: any) => {
            let errorMessage = "Failed to complete poll";
            
            // Provide more helpful error messages
            if (error.message.includes("NullifierHashAlreadyUsed")) {
              errorMessage = "This World ID has already been used for this poll";
            } else if (error.message.includes("PollExceededMaxCompletions")) {
              errorMessage = "This poll has reached its maximum number of completions";
            } else if (error.message.includes("PollNotActive")) {
              errorMessage = "This poll is no longer active";
            } else if (error.message) {
              errorMessage = `Failed to complete poll: ${error.message}`;
            }
            
            setPollStatuses(prev => ({
              ...prev,
              [pollId]: {
                type: "error",
                message: errorMessage,
              },
            }));
            setVerifyingPollId(null);
          },
        }
      );
    } catch (error: any) {
      setPollStatuses(prev => ({
        ...prev,
        [pollId]: {
          type: "error",
          message: `Error preparing transaction: ${error.message}`,
        },
      }));
      setVerifyingPollId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Loading polls...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No polls available in Firestore.
        </p>
        <button
          onClick={syncPolls}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? "Syncing..." : "Sync Polls from Chain"}
        </button>
        {syncMessage && (
          <p className={`mt-4 text-sm ${syncMessage.includes("✅") ? "text-green-600" : "text-red-600"}`}>
            {syncMessage}
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Or create a new poll to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Available Polls</h2>
        <button
          onClick={syncPolls}
          disabled={syncing}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? "Syncing..." : "Sync from Chain"}
        </button>
      </div>
      {syncMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          syncMessage.includes("✅") 
            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" 
            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
        }`}>
          {syncMessage}
        </div>
      )}
      {polls.map((poll) => {
        const rewardPerUser = bigIntToUsdc(BigInt(poll.reward_per_user));
        const isActive = poll.status === "live";
        const userHasVerified = hasVerified[poll.poll_id] || false;
        const isVerifying = verifyingPollId === poll.poll_id;
        const canComplete = account && isActive && !userHasVerified && !isVerifying;

        return (
          <div
            key={poll.id}
            className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">Poll #{poll.poll_id}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Created by {poll.creator_wallet.slice(0, 6)}...{poll.creator_wallet.slice(-4)}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isActive
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {poll.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Reward per user</p>
                <p className="text-lg font-semibold">{rewardPerUser.toFixed(2)} USDC</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Progress</p>
                <p className="text-lg font-semibold">
                  {poll.completed_count} / {poll.max_completions}
                </p>
              </div>
            </div>

            {pollStatuses[poll.poll_id] && (
              <div className="mb-4">
                <StatusMessage
                  type={pollStatuses[poll.poll_id]!.type}
                  message={pollStatuses[poll.poll_id]!.message}
                  transactionHash={pollStatuses[poll.poll_id]!.transactionHash}
                />
              </div>
            )}

            {!account ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect your wallet to participate
              </p>
            ) : !isActive ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This poll is no longer active
              </p>
            ) : userHasVerified ? (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ You have already completed this poll
              </p>
            ) : (
              <WorldIDVerify
                pollId={poll.poll_id}
                walletAddress={account.address}
                onVerificationSuccess={(proof) => handleVerificationSuccess(poll.poll_id, proof)}
                onVerificationError={(error) => {
                  setPollStatuses(prev => ({
                    ...prev,
                    [poll.poll_id]: {
                      type: "error",
                      message: `World ID verification failed: ${error.message}`,
                    },
                  }));
                  setVerifyingPollId(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

