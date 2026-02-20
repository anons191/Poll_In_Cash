"use client";

/**
 * FundPool Component
 * Thirdweb Pay component for credit card -> USDC on Base
 * After funding: call USDC approve() then PollPool.createPoll()
 */

import { useState, useCallback } from "react";
import {
  useActiveAccount,
  useSendTransaction,
  useReadContract,
  PayEmbed,
} from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import {
  getThirdwebClient,
  baseSepolia,
  USDC_ADDRESS,
  getPollPoolAddress,
  ERC20_ABI,
  POLLPOOL_ABI,
  formatUsdcAmount,
  parseUsdcAmount,
  getAuthToken,
  API_BASE_URL,
} from "@/lib/thirdweb";

// ============ Types ============

interface FundPoolProps {
  /** Optional callback when funding completes */
  onFundingComplete?: (pollId: bigint, txHash: string) => void;
  /** Optional callback when funding fails */
  onFundingError?: (error: Error) => void;
  /** Custom className */
  className?: string;
}

interface PollFormData {
  title: string;
  criteriaDescription: string;
  participantCap: number;
  durationHours: number;
  fundAmount: string; // USDC amount as string (e.g., "10.00")
}

type FundingStep =
  | "form"
  | "buy_usdc"
  | "approve"
  | "create_poll"
  | "complete";

// ============ Component ============

export function FundPool({
  onFundingComplete,
  onFundingError,
  className = "",
}: FundPoolProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const [step, setStep] = useState<FundingStep>("form");
  const [formData, setFormData] = useState<PollFormData>({
    title: "",
    criteriaDescription: "",
    participantCap: 10,
    durationHours: 24,
    fundAmount: "10.00",
  });
  const [error, setError] = useState<string | null>(null);
  const [createdPollId, setCreatedPollId] = useState<bigint | null>(null);

  // Detect if we're on testnet (Base Sepolia)
  const isTestnet = baseSepolia.testnet === true;

  const client = getThirdwebClient();

  // Get USDC contract (Circle's USDC on Base Sepolia)
  const usdcContract = getContract({
    client,
    chain: baseSepolia,
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
  });

  // Get PollPool contract
  const pollPoolAddress = getPollPoolAddress();
  const pollPoolContract = getContract({
    client,
    chain: baseSepolia,
    address: pollPoolAddress,
    abi: POLLPOOL_ABI,
  });

  // Read USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    contract: usdcContract,
    method: "balanceOf",
    params: account?.address ? [account.address] as const : ["0x0000000000000000000000000000000000000000"] as const,
  });

  // Read USDC allowance
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    contract: usdcContract,
    method: "allowance",
    params: account?.address ? [account.address, pollPoolAddress] as const : ["0x0000000000000000000000000000000000000000", pollPoolAddress] as const,
  });

  /**
   * Handle form input changes
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: name === "participantCap" || name === "durationHours"
          ? parseInt(value) || 0
          : value,
      }));
    },
    []
  );

  /**
   * Create draft poll in backend
   */
  const createDraftPoll = useCallback(async (): Promise<string> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Not authenticated. Please connect your wallet.");
    }

    const response = await fetch(`${API_BASE_URL}/polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: formData.title,
        description: formData.criteriaDescription,
        participantCap: formData.participantCap,
        durationMinutes: formData.durationHours * 60,
        fundAmount: parseUsdcAmount(formData.fundAmount).toString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create poll");
    }

    const data = await response.json();
    return data.criteriaHash;
  }, [formData]);

  /**
   * Step 1: Submit form and proceed to USDC purchase/approval
   */
  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!account) {
        setError("Please connect your wallet first");
        return;
      }

      try {
        const fundAmountBigInt = parseUsdcAmount(formData.fundAmount);
        const currentBalance = usdcBalance ?? 0n;

        // Check if user has enough USDC
        if (currentBalance < fundAmountBigInt) {
          // Need to buy USDC first
          setStep("buy_usdc");
        } else {
          // Check allowance
          const currentAllowance = usdcAllowance ?? 0n;
          if (currentAllowance < fundAmountBigInt) {
            setStep("approve");
          } else {
            setStep("create_poll");
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid amount";
        setError(errorMessage);
      }
    },
    [account, formData.fundAmount, usdcBalance, usdcAllowance]
  );

  /**
   * Step 2: After USDC purchase, proceed to approve
   */
  const handleUsdcPurchased = useCallback(() => {
    setStep("approve");
  }, []);

  /**
   * Step 2b: Open Circle USDC faucet (testnet only)
   * Opens Circle's faucet in a new tab for getting test USDC
   */
  const handleGetTestUSDC = useCallback(() => {
    window.open("https://faucet.circle.com/", "_blank");
  }, []);

  /**
   * Check balance and proceed if sufficient
   */
  const handleCheckBalance = useCallback(async () => {
    await refetchBalance();
    const fundAmountBigInt = parseUsdcAmount(formData.fundAmount);
    if ((usdcBalance ?? 0n) >= fundAmountBigInt) {
      setStep("approve");
    }
  }, [refetchBalance, formData.fundAmount, usdcBalance]);

  /**
   * Step 3: Approve USDC spending
   */
  const handleApprove = useCallback(async () => {
    setError(null);

    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      const fundAmountBigInt = parseUsdcAmount(formData.fundAmount);

      // Prepare approve transaction
      const approveTx = prepareContractCall({
        contract: usdcContract,
        method: "approve",
        params: [pollPoolAddress, fundAmountBigInt],
      });

      // Send transaction
      await sendTransaction(approveTx);

      // Refetch allowance
      await refetchAllowance();

      // Proceed to create poll
      setStep("create_poll");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Approval failed";
      setError(errorMessage);
      onFundingError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [account, formData.fundAmount, usdcContract, pollPoolAddress, sendTransaction, refetchAllowance, onFundingError]);

  /**
   * Step 4: Create poll on-chain
   */
  const handleCreatePoll = useCallback(async () => {
    setError(null);

    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      // First create draft in backend to get criteria hash
      const criteriaHash = await createDraftPoll();

      const fundAmountBigInt = parseUsdcAmount(formData.fundAmount);
      const durationSeconds = BigInt(formData.durationHours * 60 * 60);

      // Prepare createPoll transaction
      const createPollTx = prepareContractCall({
        contract: pollPoolContract,
        method: "createPoll",
        params: [
          formData.title,
          criteriaHash as `0x${string}`,
          BigInt(formData.participantCap),
          durationSeconds,
          fundAmountBigInt,
        ],
      });

      // Send transaction
      const result = await sendTransaction(createPollTx);

      // Parse poll ID from events (simplified - in production, parse logs)
      // For now, we'll fetch it from the next poll ID
      const pollId = 1n; // This should be parsed from transaction receipt

      setCreatedPollId(pollId);
      setStep("complete");

      onFundingComplete?.(pollId, result.transactionHash);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create poll";
      setError(errorMessage);
      onFundingError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [account, formData, pollPoolContract, sendTransaction, onFundingComplete, onFundingError, createDraftPoll]);

  /**
   * Reset to start over
   */
  const handleReset = useCallback(() => {
    setStep("form");
    setFormData({
      title: "",
      criteriaDescription: "",
      participantCap: 10,
      durationHours: 24,
      fundAmount: "10.00",
    });
    setError(null);
    setCreatedPollId(null);
  }, []);

  // ============ Render ============

  if (!account) {
    return (
      <div className={`fund-pool p-6 bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <p className="text-gray-300 text-center">
          Please connect your wallet to create a poll
        </p>
      </div>
    );
  }

  return (
    <div className={`fund-pool ${className}`}>
      {/* Testnet Banner */}
      {isTestnet && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-yellow-500 font-medium text-sm">You&apos;re on Base Sepolia testnet</p>
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline text-xs"
              >
                Get test USDC from Circle Faucet
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Contract Address Info */}
      <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-3">
        <p className="text-gray-400 text-xs">
          PollPool Contract: <span className="text-gray-300 font-mono">0xf6fea61ac2d3bfc57bb63048594a203970580bd6</span>
        </p>
        <a
          href="https://sepolia.basescan.org/address/0xf6fea61ac2d3bfc57bb63048594a203970580bd6"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-400 hover:underline text-xs"
        >
          View on BaseScan
        </a>
      </div>

      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {["form", "buy_usdc", "approve", "create_poll", "complete"].map((s, i) => (
            <div
              key={s}
              className={`flex items-center ${
                i < ["form", "buy_usdc", "approve", "create_poll", "complete"].indexOf(step)
                  ? "text-green-500"
                  : s === step
                  ? "text-blue-500"
                  : "text-gray-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i < ["form", "buy_usdc", "approve", "create_poll", "complete"].indexOf(step)
                    ? "bg-green-500/20"
                    : s === step
                    ? "bg-blue-500/20"
                    : "bg-gray-700"
                }`}
              >
                {i + 1}
              </div>
              {i < 4 && (
                <div
                  className={`w-full h-1 mx-2 ${
                    i < ["form", "buy_usdc", "approve", "create_poll", "complete"].indexOf(step)
                      ? "bg-green-500"
                      : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>Details</span>
          <span>Buy USDC</span>
          <span>Approve</span>
          <span>Create</span>
          <span>Done</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Step: Form */}
      {step === "form" && (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Poll Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What do you want to ask?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Eligibility Criteria
            </label>
            <textarea
              name="criteriaDescription"
              value={formData.criteriaDescription}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Who should be able to respond? (e.g., 'Must be 18+ in the US')"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max Participants
              </label>
              <input
                type="number"
                name="participantCap"
                value={formData.participantCap}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={1}
                max={1000}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Duration (hours)
              </label>
              <input
                type="number"
                name="durationHours"
                value={formData.durationHours}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={1}
                max={720}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Fund Amount (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                name="fundAmount"
                value={formData.fundAmount}
                onChange={handleInputChange}
                className="w-full pl-8 pr-16 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10.00"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                USDC
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Your balance: {usdcBalance ? formatUsdcAmount(usdcBalance) : "0.00"} USDC
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Continue to Fund Poll
            </button>
          </div>
        </form>
      )}

      {/* Step: Buy USDC */}
      {step === "buy_usdc" && (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-white">
              {isTestnet ? "Get Test USDC" : "Buy USDC"}
            </h3>
            <p className="text-gray-400">
              {isTestnet
                ? "Mint free test USDC for your poll"
                : "Purchase USDC with your credit card to fund your poll"}
            </p>
          </div>

          {isTestnet ? (
            /* Testnet: Show Circle Faucet link */
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                <p className="text-yellow-500 text-sm mb-2">
                  You are on Base Sepolia testnet
                </p>
                <p className="text-yellow-400/80 text-xs">
                  Get free test USDC from Circle&apos;s faucet
                </p>
              </div>

              <button
                onClick={handleGetTestUSDC}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Get Test USDC from Circle Faucet
              </button>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-400">
                  Current balance: {usdcBalance ? formatUsdcAmount(usdcBalance) : "0.00"} USDC
                </p>
                <button
                  onClick={handleCheckBalance}
                  className="text-sm text-teal-400 hover:text-teal-300 underline"
                >
                  Refresh balance
                </button>
              </div>
            </div>
          ) : (
            /* Production: Show PayEmbed */
            <PayEmbed
              client={client}
              payOptions={{
                mode: "fund_wallet",
                prefillBuy: {
                  chain: baseSepolia,
                  token: {
                    address: USDC_ADDRESS,
                    name: "USD Coin",
                    symbol: "USDC",
                  },
                  amount: formData.fundAmount,
                },
              }}
              theme="dark"
            />
          )}

          <button
            onClick={() => {
              // Skip if user already has enough USDC
              const fundAmountBigInt = parseUsdcAmount(formData.fundAmount);
              if ((usdcBalance ?? 0n) >= fundAmountBigInt) {
                setStep("approve");
              }
            }}
            className="w-full py-2 px-4 text-gray-400 hover:text-gray-300 underline"
          >
            I already have enough USDC
          </button>
        </div>
      )}

      {/* Step: Approve */}
      {step === "approve" && (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-white">Approve USDC</h3>
            <p className="text-gray-400">
              Allow the Poll in Cash contract to use your USDC
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Amount to approve:</span>
              <span className="font-medium text-white">{formData.fundAmount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current allowance:</span>
              <span className="font-medium text-white">
                {usdcAllowance ? formatUsdcAmount(usdcAllowance) : "0.00"} USDC
              </span>
            </div>
          </div>

          <button
            onClick={handleApprove}
            disabled={isTxPending}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isTxPending && (
              <svg
                className="animate-spin h-5 w-5"
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
            {isTxPending ? "Approving..." : "Approve USDC"}
          </button>
        </div>
      )}

      {/* Step: Create Poll */}
      {step === "create_poll" && (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-white">Create Poll</h3>
            <p className="text-gray-400">
              Finalize your poll on the blockchain
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Title:</span>
              <span className="font-medium text-white">{formData.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Participants:</span>
              <span className="font-medium text-white">{formData.participantCap}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="font-medium text-white">{formData.durationHours} hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fund amount:</span>
              <span className="font-medium text-white">{formData.fundAmount} USDC</span>
            </div>
          </div>

          <button
            onClick={handleCreatePoll}
            disabled={isTxPending}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isTxPending && (
              <svg
                className="animate-spin h-5 w-5"
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
            {isTxPending ? "Creating Poll..." : "Create Poll"}
          </button>
        </div>
      )}

      {/* Step: Complete */}
      {step === "complete" && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-500"
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
          </div>

          <h3 className="text-xl font-medium text-green-500">Poll Created!</h3>
          <p className="text-gray-400">
            Your poll has been funded and is now live on the blockchain.
          </p>

          {createdPollId && (
            <p className="text-sm text-gray-500">
              Poll ID: {createdPollId.toString()}
            </p>
          )}

          <button
            onClick={handleReset}
            className="py-2 px-4 text-teal-400 hover:text-teal-300 underline"
          >
            Create Another Poll
          </button>
        </div>
      )}
    </div>
  );
}

export default FundPool;
