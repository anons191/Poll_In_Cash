/**
 * CDP Services Index
 *
 * Central export point for all CDP wallet and treasury services.
 *
 * @module services/cdp
 */

// ============ Wallet Provider ============
export {
  // Functions
  createWalletProvider,
  getWalletProviderByAddress,
  createWalletWithIdempotencyKey,
  provisionAgentWallet,
  restoreWalletProvider,
  exportWalletData,
  isCdpConfigured,
  getCurrentNetworkId,
  // Types
  type ExportedWalletData,
  type ProvisionedWallet,
} from "./wallet-provider.js";

// ============ Smart Wallet ============
export {
  // Functions
  createSmartWalletProvider,
  getSmartWalletByAddress,
  createSmartWalletWithOwner,
  provisionAgentSmartWallet,
  sendGaslessTransaction,
  waitForReceipt,
  executeContractCall,
  transferUsdc,
  getPaymasterUrl,
  isGaslessAvailable,
  // Types
  type ExportedSmartWalletData,
  type ProvisionedSmartWallet,
} from "./smart-wallet.js";

// ============ Treasury ============
export {
  // Functions
  getTreasuryAddress,
  getTreasuryConfig,
  isTreasuryConfigured,
  getTreasuryProvider,
  createTreasuryWallet,
  getTreasuryBalance,
  getTreasuryUsdcBalance,
  formatUsdcBalance,
  getX402TreasuryConfig,
  // Types
  type TreasuryConfig,
  type CreatedTreasuryWallet,
} from "./treasury.js";

// ============ Re-export Wallet Types ============
export {
  // Types
  type WalletAddress,
  type TransactionHash,
  type CdpAgentWallet,
  type TransactionReceipt,
  // Enums
  WalletProviderType,
  TransactionStatus,
  // Functions
  toWalletAddress,
  toTransactionHash,
  assertWalletAddress,
  assertTransactionHash,
  getCurrentNetwork,
  getUsdcAddress,
  // Constants
  SUPPORTED_NETWORKS,
  USDC_ADDRESSES,
  CHAIN_IDS,
} from "../../types/wallet.js";
