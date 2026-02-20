/**
 * Gas sponsorship configuration for Base Sepolia
 * All user transactions should be gasless via Thirdweb's paymaster
 */

import { baseSepolia } from "thirdweb/chains";
import { CHAIN_IDS, USDC_ADDRESSES } from "../../types/wallet.js";

// ============ Types ============

/**
 * Gas sponsorship policy configuration
 */
export interface GasSponsorshipPolicy {
  /** Policy name for identification */
  name: string;
  /** Chain ID where policy applies */
  chainId: number;
  /** Whether sponsorship is enabled */
  enabled: boolean;
  /** Maximum gas units to sponsor per transaction */
  maxGasLimit?: bigint;
  /** Maximum gas price to sponsor (in wei) */
  maxGasPrice?: bigint;
  /** Allowed contract addresses (empty = all allowed) */
  allowedContracts: string[];
  /** Allowed function selectors (empty = all allowed) */
  allowedMethods?: string[];
  /** Daily spending limit in USD (optional) */
  dailyLimitUsd?: number;
}

/**
 * Paymaster configuration for Thirdweb
 */
export interface PaymasterConfig {
  /** The bundler URL for the chain */
  bundlerUrl: string;
  /** The paymaster URL for the chain */
  paymasterUrl: string;
  /** Context data for paymaster requests */
  context?: Record<string, unknown>;
}

// ============ Configuration ============

/**
 * Base Sepolia gas sponsorship policy
 * Configured to sponsor all transactions to our contracts
 */
export const BASE_SEPOLIA_SPONSORSHIP_POLICY: GasSponsorshipPolicy = {
  name: "poll-in-cash-base-sepolia",
  chainId: CHAIN_IDS["base-sepolia"],
  enabled: true,
  maxGasLimit: 1_000_000n, // 1M gas units max per transaction
  maxGasPrice: 100_000_000_000n, // 100 gwei max
  allowedContracts: [], // Will be populated with POLLPOOL_CONTRACT_ADDRESS
  allowedMethods: [
    // PollPool methods users can call
    "0x3e413bee", // createPoll
    "0x278ecde1", // refund
    "0x91c05b0b", // closePoll
    "0x9534e637", // distribute
    "0xa34398a2", // submitResponse
    // ERC20 approve for USDC
    "0x095ea7b3", // approve
  ],
  dailyLimitUsd: 100, // $100 per day limit for testnet
};

/**
 * Get the sponsorship policy with the current contract address
 */
export function getSponsorshipPolicy(): GasSponsorshipPolicy {
  const contractAddress = process.env.POLLPOOL_CONTRACT_ADDRESS;
  const usdcAddress = USDC_ADDRESSES["base-sepolia"];

  const policy = { ...BASE_SEPOLIA_SPONSORSHIP_POLICY };

  // Add allowed contracts if configured
  if (contractAddress) {
    policy.allowedContracts = [
      contractAddress.toLowerCase(),
      usdcAddress.toLowerCase(),
    ];
  }

  return policy;
}

// ============ Thirdweb Paymaster Configuration ============

/**
 * Get Thirdweb paymaster configuration for Base Sepolia
 * This is used by the frontend to configure gasless transactions
 */
export function getPaymasterConfig(): PaymasterConfig {
  const clientId = process.env.THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

  if (!clientId) {
    throw new Error("THIRDWEB_CLIENT_ID environment variable is not set");
  }

  // Thirdweb's bundler and paymaster URLs for Base Sepolia
  return {
    bundlerUrl: `https://${baseSepolia.id}.bundler.thirdweb.com`,
    paymasterUrl: `https://${baseSepolia.id}.bundler.thirdweb.com`,
    context: {
      // Custom context for paymaster policy
      policyId: BASE_SEPOLIA_SPONSORSHIP_POLICY.name,
    },
  };
}

/**
 * Smart wallet configuration for gasless transactions
 * This configuration enables account abstraction with gas sponsorship
 */
export const SMART_WALLET_CONFIG = {
  /** Factory address for smart wallet deployment */
  factoryAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // Default factory on Base Sepolia
  /** Whether to sponsor gas for wallet deployment */
  gasless: true,
  /** Chain to deploy smart wallet on */
  chain: baseSepolia,
} as const;

// ============ Sponsorship Rules ============

/**
 * Check if a transaction should be sponsored
 * @param to - Target contract address
 * @param data - Transaction calldata
 * @param value - Transaction value in wei
 * @returns Whether the transaction should be sponsored
 */
export function shouldSponsorTransaction(
  to: string,
  data: string,
  value: bigint = 0n
): { sponsored: boolean; reason?: string } {
  const policy = getSponsorshipPolicy();

  // Check if sponsorship is enabled
  if (!policy.enabled) {
    return { sponsored: false, reason: "Sponsorship is disabled" };
  }

  // Don't sponsor transactions with ETH value
  if (value > 0n) {
    return { sponsored: false, reason: "Transactions with value are not sponsored" };
  }

  // Check allowed contracts (if specified)
  if (policy.allowedContracts.length > 0) {
    const isAllowedContract = policy.allowedContracts.some(
      (addr) => addr.toLowerCase() === to.toLowerCase()
    );
    if (!isAllowedContract) {
      return { sponsored: false, reason: "Contract not in allowed list" };
    }
  }

  // Check allowed methods (if specified)
  if (policy.allowedMethods && policy.allowedMethods.length > 0) {
    const methodSelector = data.slice(0, 10).toLowerCase();
    const isAllowedMethod = policy.allowedMethods.some(
      (selector) => selector.toLowerCase() === methodSelector
    );
    if (!isAllowedMethod) {
      return { sponsored: false, reason: "Method not in allowed list" };
    }
  }

  return { sponsored: true };
}

// ============ Frontend Configuration Export ============

/**
 * Configuration to be passed to the frontend for gasless transactions
 * This should be serializable and safe to expose to clients
 */
export interface FrontendGasConfig {
  /** Whether gasless is enabled */
  gaslessEnabled: boolean;
  /** Chain ID for gasless transactions */
  chainId: number;
  /** Chain name */
  chainName: string;
  /** Allowed contract addresses */
  allowedContracts: string[];
  /** Message to show users about gas sponsorship */
  sponsorshipMessage: string;
}

/**
 * Get frontend-safe gas configuration
 */
export function getFrontendGasConfig(): FrontendGasConfig {
  const policy = getSponsorshipPolicy();

  return {
    gaslessEnabled: policy.enabled,
    chainId: policy.chainId,
    chainName: "Base Sepolia",
    allowedContracts: policy.allowedContracts,
    sponsorshipMessage: "Gas fees are sponsored by Poll in Cash. You won't need ETH for transactions!",
  };
}

// ============ Sponsorship Tracking ============

/**
 * Track sponsored transaction for analytics/limits
 * In production, this would update a database
 */
export interface SponsoredTransaction {
  txHash: string;
  userAddress: string;
  contractAddress: string;
  methodSelector: string;
  gasUsed: bigint;
  gasCostWei: bigint;
  gasCostUsd: number;
  timestamp: Date;
}

/**
 * Log a sponsored transaction
 * @param tx - Transaction details to log
 */
export async function logSponsoredTransaction(tx: SponsoredTransaction): Promise<void> {
  // In production, this would save to database for tracking/analytics
  console.log(`[Gas Sponsorship] Transaction sponsored:`, {
    txHash: tx.txHash,
    user: tx.userAddress,
    contract: tx.contractAddress,
    method: tx.methodSelector,
    gasUsed: tx.gasUsed.toString(),
    costWei: tx.gasCostWei.toString(),
    costUsd: tx.gasCostUsd.toFixed(4),
    time: tx.timestamp.toISOString(),
  });
}

/**
 * Get daily sponsorship spend for a user (placeholder for production)
 * @param _userAddress - User's wallet address
 * @returns Daily spend in USD
 */
export async function getUserDailySpend(_userAddress: string): Promise<number> {
  // In production, this would query the database
  // For now, return 0 (no spend tracking)
  return 0;
}

/**
 * Check if user is within daily sponsorship limit
 * @param userAddress - User's wallet address
 * @returns Whether user can have more sponsored transactions
 */
export async function isWithinDailyLimit(userAddress: string): Promise<boolean> {
  const policy = getSponsorshipPolicy();

  if (!policy.dailyLimitUsd) {
    return true; // No limit configured
  }

  const dailySpend = await getUserDailySpend(userAddress);
  return dailySpend < policy.dailyLimitUsd;
}
