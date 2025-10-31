"use client";

import { useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, waitForReceipt } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { getPollEscrowAddress, usdcToBigInt } from "@/lib/contracts";
import { pollEscrowABI } from "@/lib/pollEscrowABI";

// USDC token address on Base Sepolia
const USDC_ADDRESS = "0x081827b8C3Aa05287b5aA2bC3051fbE638F33152";

// Minimal USDC ABI for approval
const usdcABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function CreatePollForm() {
  const account = useActiveAccount();
  const [rewardPool, setRewardPool] = useState("");
  const [rewardPerUser, setRewardPerUser] = useState("");
  const [maxCompletions, setMaxCompletions] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const escrowAddress = getPollEscrowAddress();

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    contract: {
      client,
      chain,
      address: USDC_ADDRESS as `0x${string}`,
      abi: usdcABI,
    },
    method: "allowance",
    params: account ? [account.address, escrowAddress as `0x${string}`] : ["" as `0x${string}`, "" as `0x${string}`],
  });

  const { mutate: sendTransaction } = useSendTransaction();

  const allowanceBigInt = typeof allowance === "bigint" ? allowance : BigInt(0);
  const needsApproval =
    account &&
    rewardPool &&
    allowanceBigInt < usdcToBigInt(parseFloat(rewardPool) || 0);

  const handleApprove = async () => {
    if (!account || !rewardPool) return;

    setIsLoading(true);
    setStatus(null);

    try {
      const usdcContract = {
        client,
        chain,
        address: USDC_ADDRESS as `0x${string}`,
        abi: usdcABI,
      };

      const approvalAmount = usdcToBigInt(parseFloat(rewardPool));
      const approvalTx = prepareContractCall({
        contract: usdcContract,
        method: "approve",
        params: [escrowAddress as `0x${string}`, approvalAmount],
      });

      sendTransaction(
        approvalTx,
        {
          onSuccess: async (result) => {
            const receipt = await waitForReceipt({ client, chain, transactionHash: result.transactionHash });
            setStatus({ type: "success", message: "USDC approved successfully!" });
            refetchAllowance();
            setIsLoading(false);
          },
          onError: (error) => {
            setStatus({ type: "error", message: `Approval failed: ${error.message}` });
            setIsLoading(false);
          },
        }
      );
    } catch (error: any) {
      setStatus({ type: "error", message: `Error: ${error.message}` });
      setIsLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Please connect your wallet" });
      return;
    }

    if (!rewardPool || !rewardPerUser || !maxCompletions) {
      setStatus({ type: "error", message: "Please fill in all fields" });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const rewardPoolAmount = usdcToBigInt(parseFloat(rewardPool));
      const rewardPerUserAmount = usdcToBigInt(parseFloat(rewardPerUser));
      const maxCompletionsNum = BigInt(maxCompletions);

      const escrowContract = {
        client,
        chain,
        address: escrowAddress as `0x${string}`,
        abi: pollEscrowABI as any,
      };

      const createPollTx = prepareContractCall({
        contract: escrowContract,
        method: "createPoll",
        params: [rewardPoolAmount, rewardPerUserAmount, maxCompletionsNum],
      });

      sendTransaction(
        createPollTx,
        {
          onSuccess: async (result) => {
            const receipt = await waitForReceipt({ client, chain, transactionHash: result.transactionHash });
            setStatus({
              type: "success",
              message: `Poll created successfully! Transaction: ${result.transactionHash.slice(0, 10)}...`,
            });
            // Reset form
            setRewardPool("");
            setRewardPerUser("");
            setMaxCompletions("");
            setIsLoading(false);
          },
          onError: (error) => {
            setStatus({ type: "error", message: `Failed to create poll: ${error.message}` });
            setIsLoading(false);
          },
        }
      );
    } catch (error: any) {
      setStatus({ type: "error", message: `Error: ${error.message}` });
      setIsLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your wallet to create a poll
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">Create Poll</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Total Reward Pool (USDC)
          </label>
          <input
            type="number"
            step="0.01"
            value={rewardPool}
            onChange={(e) => setRewardPool(e.target.value)}
            placeholder="e.g., 10.0"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Total USDC to escrow for this poll
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Reward Per User (USDC)
          </label>
          <input
            type="number"
            step="0.01"
            value={rewardPerUser}
            onChange={(e) => setRewardPerUser(e.target.value)}
            placeholder="e.g., 1.0"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Amount each user receives when completing the poll
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Max Completions
          </label>
          <input
            type="number"
            value={maxCompletions}
            onChange={(e) => setMaxCompletions(e.target.value)}
            placeholder="e.g., 10"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum number of participants allowed
          </p>
        </div>

        {allowance !== undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>
              Current USDC allowance:{" "}
              {allowanceBigInt > 0n
                ? `${(Number(allowanceBigInt) / 1_000_000).toFixed(2)} USDC`
                : "0 USDC"}
            </p>
            {needsApproval && (
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                ⚠️ Approval needed for {rewardPool} USDC
              </p>
            )}
          </div>
        )}

        {status && (
          <div
            className={`p-3 rounded-md ${
              status.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="flex gap-2">
          {needsApproval && (
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Approving..." : "Approve USDC"}
            </button>
          )}
          <button
            onClick={handleCreatePoll}
            disabled={isLoading || !!needsApproval}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating..." : "Create Poll"}
          </button>
        </div>
      </div>
    </div>
  );
}

