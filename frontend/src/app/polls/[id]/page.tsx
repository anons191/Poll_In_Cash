"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { usePoll } from "@/hooks/usePolls";
import { useAuth } from "@/hooks/useAuth";
import { fundPoll as fundPollApi } from "@/lib/api";
import {
  getThirdwebClient,
  baseSepolia,
  USDC_ADDRESS,
  getPollPoolAddress,
  parseUsdcAmount,
  POLLPOOL_ABI,
  ERC20_ABI,
} from "@/lib/thirdweb";
import type { Poll, Question, PollResponse } from "@/lib/types";

// ============ Skeleton Components ============

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

function PollDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <SkeletonBox className="h-5 w-36" />
          <SkeletonBox className="h-8 w-32 rounded-lg" />
        </div>

        <div className="space-y-6">
          {/* Overview Card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <SkeletonBox className="h-6 w-16 rounded-full" />
                  <SkeletonBox className="h-4 w-24" />
                </div>
                <SkeletonBox className="h-8 w-64 mb-2" />
                <SkeletonBox className="h-4 w-full max-w-md" />
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-muted rounded-xl p-4">
                  <SkeletonBox className="h-4 w-20 mb-2" />
                  <SkeletonBox className="h-8 w-16" />
                </div>
              ))}
            </div>
            <SkeletonBox className="h-2 w-full rounded-full" />
          </div>

          {/* Questions */}
          <SkeletonBox className="h-8 w-24" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <div className="flex items-start gap-3 mb-6">
                <SkeletonBox className="w-8 h-8 rounded-lg" />
                <div>
                  <SkeletonBox className="h-5 w-48 mb-2" />
                  <SkeletonBox className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j}>
                    <div className="flex justify-between text-sm mb-1">
                      <SkeletonBox className="h-4 w-20" />
                      <SkeletonBox className="h-4 w-16" />
                    </div>
                    <SkeletonBox className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Error State ============

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============ Not Found State ============

function NotFoundState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Poll Not Found
        </h2>
        <p className="text-muted-foreground mb-6">
          The poll you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ============ UI Components ============

function StatusBadge({ status }: { status: Poll["status"] }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-success/10", text: "text-success", label: "Active" },
    closed: { bg: "bg-muted", text: "text-muted-foreground", label: "Closed" },
    cancelled: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      label: "Cancelled",
    },
    draft: { bg: "bg-warning/10", text: "text-warning", label: "Draft" },
    funded: { bg: "bg-accent/10", text: "text-accent", label: "Funded" },
    completed: { bg: "bg-primary/10", text: "text-primary", label: "Completed" },
  };

  const { bg, text, label } = config[status] || config.active;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

function ProgressBar({ current, max }: { current: number; max: number }) {
  const percentage = Math.min((current / max) * 100, 100);

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted-foreground">Responses</span>
        <span className="font-medium text-foreground">
          {current} / {max}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-accent rounded-full h-2 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function MultipleChoiceResults({
  question,
  responses,
}: {
  question: Question;
  responses: PollResponse[];
}) {
  if (question.type !== "multiple_choice" || !question.options) return null;

  // Calculate results from responses
  const results: Record<string, number> = {};
  question.options.forEach((opt) => {
    results[opt] = 0;
  });

  responses.forEach((response) => {
    const answer = response.answers.find((a) => a.questionId === question.id);
    if (answer && typeof answer.value === "string") {
      if (results[answer.value] !== undefined) {
        results[answer.value]++;
      }
    }
  });

  const total = Object.values(results).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {Object.entries(results).map(([option, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={option}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground">{option}</span>
              <span className="text-muted-foreground">
                {count} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RatingResults({
  question,
  responses,
}: {
  question: Question;
  responses: PollResponse[];
}) {
  if (question.type !== "rating") return null;

  // Calculate rating distribution
  const distribution = [0, 0, 0, 0, 0]; // 1-5 stars
  let totalRatings = 0;
  let sumRatings = 0;

  responses.forEach((response) => {
    const answer = response.answers.find((a) => a.questionId === question.id);
    if (answer && typeof answer.value === "number") {
      const rating = Math.min(5, Math.max(1, Math.round(answer.value)));
      distribution[rating - 1]++;
      totalRatings++;
      sumRatings += rating;
    }
  });

  const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;
  const maxCount = Math.max(...distribution, 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-4xl font-bold text-foreground">
          {averageRating.toFixed(1)}
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-5 h-5 ${
                star <= Math.round(averageRating)
                  ? "text-warning fill-current"
                  : "text-muted"
              }`}
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {distribution
          .slice()
          .reverse()
          .map((count, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-4 text-sm text-muted-foreground">
                {5 - index}
              </span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-warning rounded-full h-2 transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-sm text-muted-foreground text-right">
                {count}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function YesNoResults({
  question,
  responses,
}: {
  question: Question;
  responses: PollResponse[];
}) {
  if (question.type !== "yes_no") return null;

  let yesCount = 0;
  let noCount = 0;

  responses.forEach((response) => {
    const answer = response.answers.find((a) => a.questionId === question.id);
    if (answer) {
      const value = String(answer.value).toLowerCase();
      if (value === "yes" || value === "true" || value === "1") {
        yesCount++;
      } else {
        noCount++;
      }
    }
  });

  const total = yesCount + noCount;
  const yesPercent = total > 0 ? (yesCount / total) * 100 : 50;
  const noPercent = total > 0 ? (noCount / total) * 100 : 50;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1 bg-success/10 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-success">
            {yesPercent.toFixed(0)}%
          </p>
          <p className="text-sm text-muted-foreground">Yes</p>
        </div>
        <div className="flex-1 bg-destructive/10 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-destructive">
            {noPercent.toFixed(0)}%
          </p>
          <p className="text-sm text-muted-foreground">No</p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-3 flex overflow-hidden">
        <div className="bg-success h-3" style={{ width: `${yesPercent}%` }} />
        <div
          className="bg-destructive h-3"
          style={{ width: `${noPercent}%` }}
        />
      </div>
    </div>
  );
}

function TextResponses({
  question,
  responses,
}: {
  question: Question;
  responses: PollResponse[];
}) {
  if (question.type !== "text") return null;

  const textResponses = responses
    .map((response) => {
      const answer = response.answers.find((a) => a.questionId === question.id);
      return answer ? String(answer.value) : null;
    })
    .filter((r): r is string => r !== null && r.trim() !== "")
    .slice(0, 5);

  if (textResponses.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No text responses yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {textResponses.map((response, index) => (
        <div key={index} className="bg-muted rounded-xl p-4">
          <p className="text-foreground">{response}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Anonymous respondent
          </p>
        </div>
      ))}
      {responses.length > 5 && (
        <button className="text-sm text-primary hover:text-primary/80 transition-colors">
          View all {responses.length} responses...
        </button>
      )}
    </div>
  );
}

// ============ Fund Poll Button ============

interface FundPollButtonProps {
  poll: Poll;
  onSuccess: () => void;
}

function FundPollButton({ poll, onSuccess }: FundPollButtonProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendTransaction();

  const [status, setStatus] = useState<
    "idle" | "approving" | "creating" | "updating" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleFund = useCallback(async () => {
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    setStatus("approving");
    setError(null);

    try {
      const client = getThirdwebClient();
      const pollPoolAddress = getPollPoolAddress();

      // Parse the USDC amount (convert from human readable to 6 decimals)
      const fundAmount = parseUsdcAmount(poll.cashPoolUsdc || poll.totalFunded);
      console.log("Fund amount (raw):", fundAmount.toString());
      console.log("PollPool address:", pollPoolAddress);

      // Step 1: Approve USDC spending
      const usdcContract = getContract({
        client,
        chain: baseSepolia,
        address: USDC_ADDRESS,
      });

      const approveTx = prepareContractCall({
        contract: usdcContract,
        method: {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
        params: [pollPoolAddress as `0x${string}`, fundAmount],
      });

      // Send approval using the hook (better MetaMask integration)
      console.log("Sending approval transaction...");
      const approveResult = await sendTx(approveTx);
      console.log("Approval sent! Hash:", approveResult.transactionHash);

      // Wait for approval to be mined
      console.log("Waiting for approval confirmation...");
      await waitForReceipt({
        client,
        chain: baseSepolia,
        transactionHash: approveResult.transactionHash,
      });
      console.log("Approval confirmed!");

      // Delay to let MetaMask reset
      await new Promise(resolve => setTimeout(resolve, 2000));

      setStatus("creating");

      // Step 2: Create poll on-chain
      const pollPoolContract = getContract({
        client,
        chain: baseSepolia,
        address: pollPoolAddress as `0x${string}`,
      });

      // Calculate duration in seconds from expiry date
      const expiresAt = poll.expiresAt ? new Date(poll.expiresAt).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000;
      const durationSeconds = Math.max(Math.floor((expiresAt - Date.now()) / 1000), 3600); // At least 1 hour

      console.log("Preparing createPoll transaction...");
      console.log("Title:", poll.title);
      console.log("Criteria hash:", poll.criteriaHash || "0x0000000000000000000000000000000000000000000000000000000000000000");
      console.log("Participant cap:", poll.participantCap);
      console.log("Duration (seconds):", durationSeconds);
      console.log("Fund amount:", fundAmount.toString());

      const createPollTx = prepareContractCall({
        contract: pollPoolContract,
        method: {
          type: "function",
          name: "createPoll",
          inputs: [
            { name: "_title", type: "string" },
            { name: "_criteriaHash", type: "bytes32" },
            { name: "_participantCap", type: "uint256" },
            { name: "_duration", type: "uint256" },
            { name: "_fundAmount", type: "uint256" },
          ],
          outputs: [{ name: "pollId", type: "uint256" }],
          stateMutability: "nonpayable",
        },
        params: [
          poll.title,
          (poll.criteriaHash || "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
          BigInt(poll.participantCap),
          BigInt(durationSeconds),
          fundAmount,
        ],
      });

      // Send createPoll using the hook
      console.log("Sending createPoll transaction to MetaMask...");
      const createResult = await sendTx(createPollTx);
      console.log("Transaction sent! Hash:", createResult.transactionHash);

      // Wait for receipt
      console.log("Waiting for createPoll confirmation...");
      const receipt = await waitForReceipt({
        client,
        chain: baseSepolia,
        transactionHash: createResult.transactionHash,
      });
      console.log("CreatePoll confirmed!", receipt);

      setTxHash(createResult.transactionHash);

      // Parse the PollCreated event to get the on-chain poll ID
      // Event signature: PollCreated(uint256 indexed pollId, address indexed creator, ...)
      let contractPollId = 0;

      console.log("Receipt logs:", receipt.logs);
      console.log("Number of logs:", receipt.logs.length);

      // Look for the PollCreated event in the logs
      for (const log of receipt.logs) {
        console.log("Log:", log);
        console.log("Log topics:", log.topics);

        if (log.topics && log.topics.length >= 2) {
          const pollIdHex = log.topics[1];
          console.log("Poll ID hex:", pollIdHex);

          if (pollIdHex) {
            // Remove '0x' prefix if present and parse
            const hexStr = pollIdHex.startsWith('0x') ? pollIdHex.slice(2) : pollIdHex;
            const parsedId = parseInt(hexStr, 16);
            console.log("Parsed poll ID:", parsedId);

            if (!isNaN(parsedId) && parsedId >= 0) {
              contractPollId = parsedId;
              console.log("Found contract poll ID:", contractPollId);
              break;
            }
          }
        }
      }

      console.log("Final contractPollId to send to backend:", contractPollId);

      setStatus("updating");

      // Step 3: Update backend with contract poll ID
      await fundPollApi(poll.id, contractPollId);

      setStatus("success");
      onSuccess();
    } catch (err: unknown) {
      console.error("Failed to fund poll:", err);
      // Extract detailed error message
      let errorMessage = "Failed to fund poll";
      if (err && typeof err === 'object') {
        const error = err as { message?: string; details?: Record<string, string[]> };
        errorMessage = error.message || errorMessage;
        if (error.details) {
          const detailsStr = Object.entries(error.details)
            .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
            .join('; ');
          errorMessage += ` (${detailsStr})`;
        }
      }
      setError(errorMessage);
      setStatus("error");
    }
  }, [account, poll, onSuccess, sendTx]);

  const getButtonText = () => {
    switch (status) {
      case "approving":
        return "Approving USDC...";
      case "creating":
        return "Creating On-Chain...";
      case "updating":
        return "Finalizing...";
      case "success":
        return "Funded!";
      default:
        return `Fund Poll ($${parseFloat(poll.cashPoolUsdc || poll.totalFunded).toFixed(2)} USDC)`;
    }
  };

  const isLoading = ["approving", "creating", "updating"].includes(status);

  return (
    <div className="space-y-4">
      <button
        onClick={handleFund}
        disabled={isLoading || status === "success" || !account}
        className={`w-full py-3 rounded-xl font-medium transition-colors ${
          status === "success"
            ? "bg-success text-white"
            : isLoading
            ? "bg-primary/50 text-white cursor-wait"
            : "bg-primary text-white hover:bg-primary/90"
        } disabled:opacity-50`}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {getButtonText()}
      </button>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {txHash && (
        <div className="text-center">
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View transaction on BaseScan
          </a>
        </div>
      )}

      {!account && (
        <p className="text-sm text-muted-foreground text-center">
          Connect your wallet to fund this poll
        </p>
      )}
    </div>
  );
}

// ============ View Components ============

function CreatorView({
  poll,
  responses,
  onClose,
  onCancel,
  onFundSuccess,
  isClosing,
  isCancelling,
}: {
  poll: Poll;
  responses: PollResponse[];
  onClose: () => void;
  onCancel: () => void;
  onFundSuccess: () => void;
  isClosing: boolean;
  isCancelling: boolean;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Poll Overview */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={poll.status} />
              <span className="text-sm text-muted-foreground">
                Created {formatDate(poll.createdAt)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{poll.title}</h1>
            <p className="text-muted-foreground mt-2">{poll.description}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Total Funded</p>
            <p className="text-2xl font-bold text-foreground">
              ${parseFloat(poll.totalFunded).toFixed(2)}
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Payout/Person</p>
            <p className="text-2xl font-bold text-success">
              ${parseFloat(poll.rewardPerResponse).toFixed(2)}
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Responses</p>
            <p className="text-2xl font-bold text-foreground">
              {poll.participantCount}/{poll.participantCap}
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Expires</p>
            <p className="text-2xl font-bold text-foreground">
              {formatDate(poll.expiresAt)}
            </p>
          </div>
        </div>

        <ProgressBar current={poll.participantCount} max={poll.participantCap} />

        {poll.status === "draft" && (
          <div className="mt-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
              <p className="text-yellow-500 font-medium text-center">
                This poll is a draft. Fund it on-chain to start accepting responses.
              </p>
            </div>
            <FundPollButton poll={poll} onSuccess={onFundSuccess} />
          </div>
        )}

        {poll.status === "active" && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="px-4 py-2 rounded-lg bg-destructive text-white font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {isCancelling ? "Cancelling..." : "Cancel Poll"}
            </button>
            <button
              onClick={onClose}
              disabled={isClosing}
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isClosing ? "Closing..." : "Close & Distribute"}
            </button>
          </div>
        )}
      </div>

      {/* Targeting Info */}
      {poll.criteria && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Targeting Criteria
          </h2>
          <div className="flex flex-wrap gap-2">
            {poll.criteria.ageRange && (
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                Age: {poll.criteria.ageRange.min}-{poll.criteria.ageRange.max}
              </span>
            )}
            {poll.criteria.location?.map((loc) => (
              <span
                key={loc}
                className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm"
              >
                {loc}
              </span>
            ))}
            {poll.criteria.interests?.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground">Results</h2>
        {poll.questions.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-muted-foreground">No questions in this poll</p>
          </div>
        ) : (
          poll.questions.map((question, index) => (
            <div
              key={question.id}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <div className="flex items-start gap-3 mb-6">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{question.text}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {question.type.replace("_", " ")}
                  </p>
                </div>
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No responses yet</p>
                </div>
              ) : (
                <>
                  {question.type === "multiple_choice" && (
                    <MultipleChoiceResults
                      question={question}
                      responses={responses}
                    />
                  )}
                  {question.type === "rating" && (
                    <RatingResults question={question} responses={responses} />
                  )}
                  {question.type === "yes_no" && (
                    <YesNoResults question={question} responses={responses} />
                  )}
                  {question.type === "text" && (
                    <TextResponses question={question} responses={responses} />
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TakerView({ poll, onFundSuccess }: { poll: Poll; onFundSuccess: () => void }) {
  const [isResponding, setIsResponding] = useState(false);

  const spotsLeft = poll.participantCap - poll.participantCount;

  return (
    <div className="space-y-6">
      {/* Poll Info */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={poll.status} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{poll.title}</h1>
            <p className="text-muted-foreground mt-2">{poll.description}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-success/10 rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Payout</p>
            <p className="text-2xl font-bold text-success">
              ${parseFloat(poll.rewardPerResponse).toFixed(2)}
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Questions</p>
            <p className="text-2xl font-bold text-foreground">
              {poll.questions.length}
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Spots Left</p>
            <p className="text-2xl font-bold text-foreground">{spotsLeft}</p>
          </div>
        </div>

        {/* Targeting Match */}
        {poll.criteria && (
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-foreground mb-2">
              Required Criteria
            </p>
            <div className="flex flex-wrap gap-2">
              {poll.criteria.ageRange && (
                <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                  Age: {poll.criteria.ageRange.min}-{poll.criteria.ageRange.max}
                </span>
              )}
              {poll.criteria.location?.map((loc) => (
                <span
                  key={loc}
                  className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}

        {poll.status === "active" && spotsLeft > 0 && (
          <button
            onClick={() => setIsResponding(true)}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
          >
            Start Poll
          </button>
        )}

        {poll.status === "active" && spotsLeft === 0 && (
          <div className="bg-warning/10 rounded-xl p-4">
            <p className="text-center text-warning font-medium">
              This poll has reached its participant cap
            </p>
          </div>
        )}

        {poll.status === "draft" && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-center text-yellow-500 font-medium">
                This poll is a draft. Fund it on-chain to start accepting responses.
              </p>
            </div>
            {poll.isOwner && (
              <FundPollButton poll={poll} onSuccess={onFundSuccess} />
            )}
          </div>
        )}

        {poll.status !== "active" && poll.status !== "draft" && (
          <div className="bg-muted rounded-xl p-4">
            <p className="text-center text-muted-foreground font-medium">
              This poll is no longer accepting responses
            </p>
          </div>
        )}
      </div>

      {/* Response Form (simplified preview) */}
      {isResponding && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Answer Questions
          </h2>
          <p className="text-muted-foreground mb-4">
            This is a preview. In the full implementation, your AI agent will
            answer these questions based on your profile.
          </p>
          <div className="space-y-6">
            {poll.questions.map((question, index) => (
              <div
                key={question.id}
                className="border-b border-border pb-6 last:border-0"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <p className="font-medium text-foreground">{question.text}</p>
                </div>
                <div className="ml-9">
                  <p className="text-sm text-muted-foreground italic">
                    Your agent will respond based on your profile...
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setIsResponding(false)}
              className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button className="flex-1 py-3 rounded-xl bg-success text-white font-medium hover:bg-success/90 transition-colors">
              Submit Response
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Main Page Component ============

export default function PollDetailPage() {
  const params = useParams();
  const pollId = typeof params.id === "string" ? params.id : null;

  const {
    poll,
    responses,
    isLoading,
    error,
    refetch,
    fetchResponses,
    close,
    cancel,
    isClosing,
    isCancelling,
  } = usePoll(pollId);
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<"creator" | "taker">("taker");

  // Determine if user is the creator
  // Backend returns isOwner directly, or we can compare creator.walletAddress
  const isCreator = user && poll && (poll.isOwner ??
    (poll.creator?.walletAddress && poll.creator.walletAddress === user.walletAddress));

  // Fetch responses when poll loads and user is creator
  useEffect(() => {
    if (poll && isCreator) {
      fetchResponses();
    }
  }, [poll, isCreator, fetchResponses]);

  // Update view mode when creator status is determined
  useEffect(() => {
    if (isCreator !== undefined) {
      setViewMode(isCreator ? "creator" : "taker");
    }
  }, [isCreator]);

  const handleClose = async () => {
    try {
      await close();
    } catch (err) {
      console.error("Failed to close poll:", err);
    }
  };

  const handleCancel = async () => {
    try {
      await cancel();
    } catch (err) {
      console.error("Failed to cancel poll:", err);
    }
  };

  // Show loading state
  if (isLoading && !poll) {
    return <PollDetailSkeleton />;
  }

  // Show error state
  if (error && !poll) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  // Show not found state
  if (!poll) {
    return <NotFoundState />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>

          {/* View Toggle (only show if user is creator for testing) */}
          {isCreator && (
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("creator")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === "creator"
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground"
                }`}
              >
                Creator View
              </button>
              <button
                onClick={() => setViewMode("taker")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === "taker"
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground"
                }`}
              >
                Taker View
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {viewMode === "creator" ? (
          <CreatorView
            poll={poll}
            responses={responses}
            onClose={handleClose}
            onCancel={handleCancel}
            onFundSuccess={refetch}
            isClosing={isClosing}
            isCancelling={isCancelling}
          />
        ) : (
          <TakerView poll={poll} onFundSuccess={refetch} />
        )}
      </div>
    </div>
  );
}
