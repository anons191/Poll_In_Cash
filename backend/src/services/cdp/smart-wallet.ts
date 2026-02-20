/**
 * CDP Smart Wallet Provider Service
 *
 * Provides smart wallet functionality for gasless transactions on Base.
 * Smart wallets use account abstraction to enable sponsored transactions,
 * batch operations, and other advanced features.
 *
 * This is what agents use for on-chain interactions like submitResponse.
 *
 * @module services/cdp/smart-wallet
 */

import {
  CdpSmartWalletProvider,
  type CdpSmartWalletProviderConfig,
} from "@coinbase/agentkit";
import type { Address, Hex, TransactionRequest } from "viem";
import {
  type WalletAddress,
  type TransactionHash,
  type TransactionReceipt,
  TransactionStatus,
  SUPPORTED_NETWORKS,
  type SupportedNetwork,
  toWalletAddress,
  toTransactionHash,
  getUsdcAddress,
} from "../../types/wallet.js";

// ============ Configuration ============

/**
 * CDP Smart Wallet configuration from environment variables
 */
interface CdpSmartWalletConfig {
  apiKeyId: string;
  apiKeySecret: string;
  walletSecret: string;
  networkId: SupportedNetwork;
  paymasterUrl?: string;
}

/**
 * Get CDP Smart Wallet configuration from environment variables
 * @throws Error if required environment variables are missing
 */
function getCdpSmartWalletConfig(): CdpSmartWalletConfig {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;
  const paymasterUrl = process.env.CDP_PAYMASTER_URL;

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
    paymasterUrl,
  };
}

// ============ Exported Smart Wallet Data ============

/**
 * Serializable smart wallet data for persistence
 */
export interface ExportedSmartWalletData {
  /** The smart wallet's address (account abstraction address) */
  address: WalletAddress;
  /** The owner's address (EOA that controls the smart wallet) */
  ownerAddress: WalletAddress;
  /** Optional name identifier */
  name?: string;
  /** The network the smart wallet is on */
  networkId: SupportedNetwork;
  /** Timestamp when the smart wallet was created */
  createdAt: string;
}

// ============ Smart Wallet Provider Functions ============

/**
 * Create a new CDP Smart Wallet provider instance
 *
 * Smart wallets on Base Sepolia have gasless transactions by default.
 * For mainnet, you may need to configure a paymaster.
 *
 * @param config - Optional configuration overrides
 * @returns Configured CdpSmartWalletProvider instance
 */
export async function createSmartWalletProvider(
  config?: Partial<CdpSmartWalletProviderConfig>
): Promise<CdpSmartWalletProvider> {
  const cdpConfig = getCdpSmartWalletConfig();

  const providerConfig: CdpSmartWalletProviderConfig = {
    apiKeyId: cdpConfig.apiKeyId,
    apiKeySecret: cdpConfig.apiKeySecret,
    walletSecret: cdpConfig.walletSecret,
    networkId: cdpConfig.networkId,
    paymasterUrl: cdpConfig.paymasterUrl,
    ...config,
  };

  return CdpSmartWalletProvider.configureWithWallet(providerConfig);
}

/**
 * Create a smart wallet provider for an existing smart wallet by address
 *
 * @param address - The smart wallet address to connect to
 * @param ownerAddress - The owner's address (optional, will be derived if not provided)
 * @returns Configured CdpSmartWalletProvider instance
 */
export async function getSmartWalletByAddress(
  address: WalletAddress,
  ownerAddress?: WalletAddress
): Promise<CdpSmartWalletProvider> {
  const config: Partial<CdpSmartWalletProviderConfig> = {
    address: address as `0x${string}`,
  };

  if (ownerAddress) {
    config.owner = ownerAddress as Address;
  }

  return createSmartWalletProvider(config);
}

/**
 * Create a smart wallet with a specific owner
 *
 * @param ownerAddress - The EOA address that will own and control the smart wallet
 * @param name - Optional name for the smart wallet
 * @returns Configured CdpSmartWalletProvider instance
 */
export async function createSmartWalletWithOwner(
  ownerAddress: WalletAddress,
  name?: string
): Promise<CdpSmartWalletProvider> {
  return createSmartWalletProvider({
    owner: ownerAddress as Address,
    smartAccountName: name,
  });
}

// ============ Agent Smart Wallet Provisioning ============

/**
 * Result from provisioning a new smart wallet for an agent
 */
export interface ProvisionedSmartWallet {
  /** The smart wallet provider instance */
  provider: CdpSmartWalletProvider;
  /** Exported wallet data for persistence */
  exportedData: ExportedSmartWalletData;
}

/**
 * Provision a new smart wallet for an agent
 *
 * This creates a smart wallet that can perform gasless transactions.
 * The smart wallet is controlled by an owner account (EOA).
 *
 * @param ownerAddress - The EOA address that will control the smart wallet
 * @param agentId - Optional identifier for naming the wallet
 * @returns Provisioned smart wallet with provider and exportable data
 *
 * @example
 * ```typescript
 * // Create a smart wallet for an agent
 * const result = await provisionAgentSmartWallet(
 *   agent.walletAddress,
 *   agent.id
 * );
 *
 * // Use for gasless transactions
 * const txHash = await result.provider.sendTransaction({
 *   to: contractAddress,
 *   data: encodedFunctionData,
 * });
 * ```
 */
export async function provisionAgentSmartWallet(
  ownerAddress: WalletAddress,
  agentId?: string
): Promise<ProvisionedSmartWallet> {
  const name = agentId ? `agent-smart-wallet-${agentId}` : undefined;
  const provider = await createSmartWalletWithOwner(ownerAddress, name);

  const exported = await provider.exportWallet();
  const cdpConfig = getCdpSmartWalletConfig();

  const address = toWalletAddress(exported.address);
  const exportedOwnerAddress = toWalletAddress(exported.ownerAddress);

  if (!address) {
    throw new Error(`Invalid smart wallet address: ${exported.address}`);
  }
  if (!exportedOwnerAddress) {
    throw new Error(`Invalid owner address: ${exported.ownerAddress}`);
  }

  const exportedData: ExportedSmartWalletData = {
    name: exported.name,
    address,
    ownerAddress: exportedOwnerAddress,
    networkId: cdpConfig.networkId,
    createdAt: new Date().toISOString(),
  };

  return {
    provider,
    exportedData,
  };
}

// ============ Transaction Functions ============

/**
 * Send a gasless transaction using a smart wallet
 *
 * @param provider - The smart wallet provider
 * @param transaction - The transaction to send
 * @returns The transaction/user operation hash
 */
export async function sendGaslessTransaction(
  provider: CdpSmartWalletProvider,
  transaction: TransactionRequest
): Promise<TransactionHash> {
  const hash = await provider.sendTransaction(transaction);
  const txHash = toTransactionHash(hash);

  if (!txHash) {
    throw new Error(`Invalid transaction hash returned: ${hash}`);
  }

  return txHash;
}

/**
 * Wait for a transaction receipt
 *
 * @param provider - The smart wallet provider
 * @param txHash - The transaction hash to wait for
 * @returns The transaction receipt
 */
export async function waitForReceipt(
  provider: CdpSmartWalletProvider,
  txHash: TransactionHash
): Promise<TransactionReceipt> {
  const receipt = await provider.waitForTransactionReceipt(txHash as Hex);

  const hash = toTransactionHash(receipt.transactionHash || txHash);
  if (!hash) {
    throw new Error("Invalid transaction hash in receipt");
  }

  return {
    hash,
    status:
      receipt.status === "success"
        ? TransactionStatus.CONFIRMED
        : TransactionStatus.FAILED,
    blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : undefined,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}

/**
 * Execute a contract call with gasless transaction
 *
 * @param provider - The smart wallet provider
 * @param contractAddress - The contract address
 * @param data - The encoded function call data
 * @param value - Optional ETH value to send (default: 0)
 * @returns The transaction hash and receipt
 */
export async function executeContractCall(
  provider: CdpSmartWalletProvider,
  contractAddress: WalletAddress,
  data: Hex,
  value?: bigint
): Promise<{ hash: TransactionHash; receipt: TransactionReceipt }> {
  const transaction: TransactionRequest = {
    to: contractAddress as Address,
    data,
    value,
  };

  const hash = await sendGaslessTransaction(provider, transaction);
  const receipt = await waitForReceipt(provider, hash);

  return { hash, receipt };
}

// ============ USDC Transfer Functions ============

/**
 * ERC20 transfer function signature
 */
const ERC20_TRANSFER_SIGNATURE = "0xa9059cbb";

/**
 * Encode an ERC20 transfer call
 *
 * @param to - Recipient address
 * @param amount - Amount to transfer (in token units, e.g., USDC has 6 decimals)
 * @returns Encoded function call data
 */
function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  // Pad address to 32 bytes (remove 0x, pad to 64 chars)
  const paddedAddress = to.slice(2).toLowerCase().padStart(64, "0");
  // Pad amount to 32 bytes
  const paddedAmount = amount.toString(16).padStart(64, "0");

  return `${ERC20_TRANSFER_SIGNATURE}${paddedAddress}${paddedAmount}` as Hex;
}

/**
 * Transfer USDC using a smart wallet (gasless)
 *
 * @param provider - The smart wallet provider
 * @param to - Recipient address
 * @param amountUsdc - Amount in USDC (will be converted to 6 decimal units)
 * @returns The transaction hash and receipt
 *
 * @example
 * ```typescript
 * // Transfer 10 USDC
 * const result = await transferUsdc(provider, recipientAddress, "10.00");
 * console.log(`Transfer confirmed: ${result.hash}`);
 * ```
 */
export async function transferUsdc(
  provider: CdpSmartWalletProvider,
  to: WalletAddress,
  amountUsdc: string
): Promise<{ hash: TransactionHash; receipt: TransactionReceipt }> {
  const usdcAddress = getUsdcAddress();

  // Convert USDC amount to 6 decimal units
  const amountFloat = parseFloat(amountUsdc);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error(`Invalid USDC amount: ${amountUsdc}`);
  }

  const amount = BigInt(Math.round(amountFloat * 1_000_000));
  const data = encodeErc20Transfer(to as Address, amount);

  return executeContractCall(provider, usdcAddress, data);
}

// ============ Utility Functions ============

/**
 * Get the paymaster URL if configured
 *
 * @param provider - The smart wallet provider
 * @returns The paymaster URL or undefined
 */
export function getPaymasterUrl(
  provider: CdpSmartWalletProvider
): string | undefined {
  return provider.getPaymasterUrl();
}

/**
 * Check if gasless transactions are available
 *
 * On Base Sepolia, gasless transactions are available by default.
 * On mainnet, a paymaster must be configured.
 *
 * @returns true if gasless transactions should be available
 */
export function isGaslessAvailable(): boolean {
  const config = getCdpSmartWalletConfig();

  // Sepolia has built-in gasless support
  if (config.networkId === SUPPORTED_NETWORKS.BASE_SEPOLIA) {
    return true;
  }

  // Mainnet requires a paymaster
  return Boolean(config.paymasterUrl);
}
