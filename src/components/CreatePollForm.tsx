"use client";

import { useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, waitForReceipt } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { getPollEscrowAddress, usdcToBigInt, bigIntToUsdc } from "@/lib/contracts";
import { pollEscrowABI } from "@/lib/pollEscrowABI";

// USDC token address on Base Sepolia
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

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

  // Verify the contract's USDC token address matches our frontend USDC address
  const { data: contractUsdcAddress } = useReadContract({
    contract: {
      client,
      chain,
      address: escrowAddress as `0x${string}`,
      abi: pollEscrowABI as any,
    },
    method: "usdcToken",
    params: [],
    queryOptions: {
      enabled: !!escrowAddress,
    },
  });

  // Check USDC allowance with polling enabled
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    contract: {
      client,
      chain,
      address: USDC_ADDRESS as `0x${string}`,
      abi: usdcABI,
    },
    method: "allowance",
    params: account ? [account.address, escrowAddress as `0x${string}`] : ["" as `0x${string}`, "" as `0x${string}`],
    queryOptions: {
      refetchInterval: 3000, // Poll every 3 seconds (optional, helps catch updates faster)
      enabled: !!account, // Only fetch when account is connected
    },
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
            setStatus({ type: "success", message: "USDC approved successfully! Refreshing allowance..." });
            
            // Wait 2 seconds for RPC nodes to index, then refetch
            setTimeout(async () => {
              await refetchAllowance();
              setIsLoading(false);
            }, 2000);
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
      // Validate contract address is set
      if (!escrowAddress) {
        setStatus({ 
          type: "error", 
          message: "Contract address not configured. Please set NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS" 
        });
        setIsLoading(false);
        return;
      }

      const rewardPoolAmount = usdcToBigInt(parseFloat(rewardPool));
      const rewardPerUserAmount = usdcToBigInt(parseFloat(rewardPerUser));
      const maxCompletionsNum = BigInt(maxCompletions);

      // Verify contract USDC address matches frontend USDC address
      if (contractUsdcAddress && contractUsdcAddress.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
        setStatus({ 
          type: "error", 
          message: `USDC address mismatch! Contract expects ${contractUsdcAddress} but frontend is using ${USDC_ADDRESS}. Please redeploy the contract with the correct USDC address (0x036CbD53842c5426634e7929541eC2318f3dCF7e).` 
        });
        setIsLoading(false);
        return;
      }

      // Verify allowance is sufficient
      const currentAllowance = allowanceBigInt;
      if (currentAllowance < rewardPoolAmount) {
        setStatus({ 
          type: "error", 
          message: `Insufficient allowance. Current: ${bigIntToUsdc(currentAllowance).toFixed(2)} USDC, Required: ${rewardPool} USDC. Please approve again.` 
        });
        setIsLoading(false);
        return;
      }

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
          onError: (error: any) => {
            let errorMessage = error.message || "Unknown error";
            
            // Check for specific contract errors
            if (errorMessage.includes("SafeERC20FailedOperation")) {
              errorMessage = "USDC transfer failed. Please check your USDC balance and approval amount.";
            } else if (errorMessage.includes("InsufficientFunds")) {
              errorMessage = "Insufficient USDC balance. Please ensure you have enough USDC.";
            } else if (errorMessage.includes("e450d38c")) {
              // This is likely SafeERC20FailedOperation or ERC20 transfer error
              errorMessage = "USDC transfer failed. Please verify:\n1. You have sufficient USDC balance\n2. Your approval amount is correct\n3. You're connected to Base Sepolia";
            }
            
            setStatus({ type: "error", message: `Failed to create poll: ${errorMessage}` });
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

        {contractUsdcAddress && (
          <div className="text-sm mb-4">
            {contractUsdcAddress.toLowerCase() !== USDC_ADDRESS.toLowerCase() ? (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
                <p className="font-semibold">⚠️ USDC Address Mismatch!</p>
                <p className="mt-1">
                  Contract expects USDC: <code className="text-xs">{contractUsdcAddress}</code>
                </p>
                <p className="mt-1">
                  Frontend using USDC: <code className="text-xs">{USDC_ADDRESS}</code>
                </p>
                <p className="mt-2">
                  <strong>Solution:</strong> Redeploy the PollEscrow contract with the new USDC address, or use the old USDC token address.
                </p>
              </div>
            ) : (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Contract USDC address matches ({USDC_ADDRESS.slice(0, 6)}...{USDC_ADDRESS.slice(-4)})
              </div>
            )}
          </div>
        )}
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

