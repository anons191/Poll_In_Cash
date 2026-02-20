/**
 * Shared wallet types for CDP and Thirdweb integration
 * Used by both Coinbase CDP (agent wallets) and Thirdweb (in-app wallets)
 */

// ============ Branded Types ============

/**
 * Branded type for Ethereum wallet addresses
 * Ensures type safety when passing wallet addresses between functions
 */
declare const WalletAddressBrand: unique symbol;
export type WalletAddress = string & { readonly [WalletAddressBrand]: typeof WalletAddressBrand };

/**
 * Branded type for transaction hashes
 * Ensures type safety when passing transaction hashes
 */
declare const TransactionHashBrand: unique symbol;
export type TransactionHash = string & { readonly [TransactionHashBrand]: typeof TransactionHashBrand };

// ============ Type Guards & Helpers ============

/**
 * Validates and casts a string to WalletAddress
 * @param address - The address string to validate
 * @returns The typed WalletAddress or null if invalid
 */
export function toWalletAddress(address: string): WalletAddress | null {
  // Basic Ethereum address validation (0x + 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return address.toLowerCase() as WalletAddress;
  }
  return null;
}

/**
 * Validates and casts a string to TransactionHash
 * @param hash - The hash string to validate
 * @returns The typed TransactionHash or null if invalid
 */
export function toTransactionHash(hash: string): TransactionHash | null {
  // Ethereum transaction hash validation (0x + 64 hex chars)
  if (/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return hash.toLowerCase() as TransactionHash;
  }
  return null;
}

/**
 * Type assertion for WalletAddress (throws if invalid)
 */
export function assertWalletAddress(address: string): WalletAddress {
  const result = toWalletAddress(address);
  if (!result) {
    throw new Error(`Invalid wallet address: ${address}`);
  }
  return result;
}

/**
 * Type assertion for TransactionHash (throws if invalid)
 */
export function assertTransactionHash(hash: string): TransactionHash {
  const result = toTransactionHash(hash);
  if (!result) {
    throw new Error(`Invalid transaction hash: ${hash}`);
  }
  return result;
}

// ============ Enums ============

/**
 * Wallet provider types used in the system
 * - cdp_agent: Coinbase CDP agentic wallets (for AI agents)
 * - thirdweb_inapp: Thirdweb in-app wallets (for web users)
 */
export enum WalletProviderType {
  CDP_AGENT = 'cdp_agent',
  THIRDWEB_INAPP = 'thirdweb_inapp',
}

// ============ Interfaces ============

/**
 * Base wallet interface shared by all wallet types
 */
export interface BaseWallet {
  address: WalletAddress;
  providerType: WalletProviderType;
  createdAt: Date;
}

/**
 * CDP Agent wallet with exportable data for persistence
 */
export interface CdpAgentWallet extends BaseWallet {
  providerType: WalletProviderType.CDP_AGENT;
  networkId: string;
  walletData?: string; // Encrypted exported wallet data
}

/**
 * Thirdweb in-app wallet
 */
export interface ThirdwebInAppWallet extends BaseWallet {
  providerType: WalletProviderType.THIRDWEB_INAPP;
  authMethod: 'email' | 'social' | 'phone';
}

/**
 * Union type for all wallet types
 */
export type Wallet = CdpAgentWallet | ThirdwebInAppWallet;

// ============ Transaction Types ============

/**
 * Transaction status for on-chain operations
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

/**
 * Transaction receipt from on-chain operations
 */
export interface TransactionReceipt {
  hash: TransactionHash;
  status: TransactionStatus;
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

// ============ Network Configuration ============

/**
 * Supported networks
 */
export const SUPPORTED_NETWORKS = {
  BASE_MAINNET: 'base-mainnet',
  BASE_SEPOLIA: 'base-sepolia',
} as const;

export type SupportedNetwork = typeof SUPPORTED_NETWORKS[keyof typeof SUPPORTED_NETWORKS];

/**
 * USDC contract addresses by network
 */
export const USDC_ADDRESSES: Record<SupportedNetwork, WalletAddress> = {
  'base-mainnet': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as WalletAddress,
  'base-sepolia': '0x036cbd53842c5426634e7929541ec2318f3dcf7e' as WalletAddress, // Circle's testnet USDC
};

/**
 * Chain IDs by network
 */
export const CHAIN_IDS: Record<SupportedNetwork, number> = {
  'base-mainnet': 8453,
  'base-sepolia': 84532,
};

/**
 * Get the current network based on environment
 */
export function getCurrentNetwork(): SupportedNetwork {
  return process.env.NODE_ENV === 'production'
    ? SUPPORTED_NETWORKS.BASE_MAINNET
    : SUPPORTED_NETWORKS.BASE_SEPOLIA;
}

/**
 * Get USDC address for the current network
 */
export function getUsdcAddress(): WalletAddress {
  return USDC_ADDRESSES[getCurrentNetwork()];
}
