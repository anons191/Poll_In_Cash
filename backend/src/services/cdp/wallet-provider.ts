/**
 * CDP Wallet Provider Service
 *
 * Provides programmatic wallet creation and management using Coinbase's CDP SDK.
 * Used for provisioning agent wallets when users register.
 *
 * @module services/cdp/wallet-provider
 */

import { randomUUID } from "crypto";
import {
  CdpEvmWalletProvider,
  type CdpWalletProviderConfig,
} from "@coinbase/agentkit";
import {
  type WalletAddress,
  type CdpAgentWallet,
  WalletProviderType,
  SUPPORTED_NETWORKS,
  type SupportedNetwork,
  toWalletAddress,
} from "../../types/wallet.js";

// ============ Configuration ============

/**
 * CDP API configuration from environment variables
 */
interface CdpConfig {
  apiKeyId: string;
  apiKeySecret: string;
  walletSecret: string;
  networkId: SupportedNetwork;
}

/**
 * Get CDP configuration from environment variables
 * @throws Error if required environment variables are missing
 */
function getCdpConfig(): CdpConfig {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId) {
    throw new Error("CDP_API_KEY_ID environment variable is required");
  }
  if (!apiKeySecret) {
    throw new Error("CDP_API_KEY_SECRET environment variable is required");
  }
  if (!walletSecret) {
    throw new Error("CDP_WALLET_SECRET environment variable is required");
  }

  const networkId =
    process.env.NODE_ENV === "production"
      ? SUPPORTED_NETWORKS.BASE_MAINNET
      : SUPPORTED_NETWORKS.BASE_SEPOLIA;

  return {
    apiKeyId,
    apiKeySecret,
    walletSecret,
    networkId,
  };
}

// ============ Exported Wallet Data ============

/**
 * Serializable wallet data for session persistence
 * This can be stored in the database and used to restore wallet access
 */
export interface ExportedWalletData {
  /** The wallet name (optional identifier from CDP) */
  name?: string;
  /** The wallet's Ethereum address */
  address: WalletAddress;
  /** The network the wallet was created on */
  networkId: SupportedNetwork;
  /** Timestamp when the wallet was created */
  createdAt: string;
}

// ============ Wallet Provider Functions ============

/**
 * Create a new CDP EVM wallet provider instance
 *
 * @param config - Optional configuration overrides
 * @returns Configured CdpEvmWalletProvider instance
 */
export async function createWalletProvider(
  config?: Partial<CdpWalletProviderConfig>
): Promise<CdpEvmWalletProvider> {
  const cdpConfig = getCdpConfig();

  const providerConfig: CdpWalletProviderConfig = {
    apiKeyId: cdpConfig.apiKeyId,
    apiKeySecret: cdpConfig.apiKeySecret,
    walletSecret: cdpConfig.walletSecret,
    networkId: cdpConfig.networkId,
    ...config,
  };

  return CdpEvmWalletProvider.configureWithWallet(providerConfig);
}

/**
 * Create a wallet provider for an existing wallet by address
 *
 * @param address - The wallet address to connect to
 * @returns Configured CdpEvmWalletProvider instance
 */
export async function getWalletProviderByAddress(
  address: WalletAddress
): Promise<CdpEvmWalletProvider> {
  return createWalletProvider({ address: address as `0x${string}` });
}

/**
 * Create a wallet provider with an idempotency key
 * Useful for ensuring the same wallet is created on retry
 *
 * @param idempotencyKey - Unique key for wallet creation
 * @returns Configured CdpEvmWalletProvider instance
 */
export async function createWalletWithIdempotencyKey(
  idempotencyKey: string
): Promise<CdpEvmWalletProvider> {
  return createWalletProvider({ idempotencyKey });
}

// ============ Agent Wallet Provisioning ============

/**
 * Result from provisioning a new agent wallet
 */
export interface ProvisionedWallet {
  /** The CDP wallet provider instance */
  provider: CdpEvmWalletProvider;
  /** The wallet data in our domain type format */
  wallet: CdpAgentWallet;
  /** Exported wallet data for persistence */
  exportedData: ExportedWalletData;
}

/**
 * Provision a new agent wallet for a user
 *
 * This is the main function called when a new user registers.
 * It creates a new CDP wallet that the agent can use for on-chain interactions.
 *
 * @param userId - The user ID to use as idempotency key (ensures same wallet on retry)
 * @returns Provisioned wallet with provider and exportable data
 *
 * @example
 * ```typescript
 * // When a new user registers
 * const result = await provisionAgentWallet(user.id);
 *
 * // Store wallet data in database
 * await db.insert(wallets).values({
 *   userId: user.id,
 *   address: result.wallet.address,
 *   walletData: JSON.stringify(result.exportedData),
 * });
 *
 * // Use provider for immediate operations
 * const balance = await result.provider.getBalance();
 * ```
 */
export async function provisionAgentWallet(
  _userId: string
): Promise<ProvisionedWallet> {
  // Generate a new UUID for wallet creation
  // Note: Each user gets a unique wallet. Store the address for future reference.
  const provider = await createWalletWithIdempotencyKey(randomUUID());

  // Export wallet data
  const exported = await provider.exportWallet();
  const cdpConfig = getCdpConfig();

  // Validate and convert address
  const address = toWalletAddress(exported.address);
  if (!address) {
    throw new Error(`Invalid wallet address returned from CDP: ${exported.address}`);
  }

  const exportedData: ExportedWalletData = {
    name: exported.name,
    address,
    networkId: cdpConfig.networkId,
    createdAt: new Date().toISOString(),
  };

  const wallet: CdpAgentWallet = {
    address,
    providerType: WalletProviderType.CDP_AGENT,
    networkId: cdpConfig.networkId,
    walletData: JSON.stringify(exportedData),
    createdAt: new Date(),
  };

  return {
    provider,
    wallet,
    exportedData,
  };
}

/**
 * Restore a wallet provider from exported wallet data
 *
 * @param exportedData - The exported wallet data from a previous session
 * @returns Configured CdpEvmWalletProvider instance
 *
 * @example
 * ```typescript
 * // Load wallet data from database
 * const walletRecord = await db.query.wallets.findFirst({
 *   where: eq(wallets.userId, userId),
 * });
 *
 * const exportedData = JSON.parse(walletRecord.walletData);
 * const provider = await restoreWalletProvider(exportedData);
 * ```
 */
export async function restoreWalletProvider(
  exportedData: ExportedWalletData
): Promise<CdpEvmWalletProvider> {
  return createWalletProvider({
    address: exportedData.address as `0x${string}`,
    networkId: exportedData.networkId,
  });
}

/**
 * Export wallet data from an existing provider for persistence
 *
 * @param provider - The wallet provider to export from
 * @returns Exportable wallet data
 */
export async function exportWalletData(
  provider: CdpEvmWalletProvider
): Promise<ExportedWalletData> {
  const exported = await provider.exportWallet();
  const cdpConfig = getCdpConfig();

  const address = toWalletAddress(exported.address);
  if (!address) {
    throw new Error(`Invalid wallet address: ${exported.address}`);
  }

  return {
    name: exported.name,
    address,
    networkId: cdpConfig.networkId,
    createdAt: new Date().toISOString(),
  };
}

// ============ Utility Functions ============

/**
 * Check if CDP is properly configured
 *
 * @returns true if all required environment variables are set
 */
export function isCdpConfigured(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID &&
      process.env.CDP_API_KEY_SECRET &&
      process.env.CDP_WALLET_SECRET
  );
}

/**
 * Get the current network ID based on environment
 *
 * @returns The network ID (base-sepolia for development, base-mainnet for production)
 */
export function getCurrentNetworkId(): SupportedNetwork {
  return process.env.NODE_ENV === "production"
    ? SUPPORTED_NETWORKS.BASE_MAINNET
    : SUPPORTED_NETWORKS.BASE_SEPOLIA;
}
