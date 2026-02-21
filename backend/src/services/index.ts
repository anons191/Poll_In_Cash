/**
 * Services Index
 *
 * Central export point for all backend services.
 * Re-exports CDP (agent wallets), Thirdweb (contract interactions), and x402 (payments).
 *
 * @module services
 */

// ============ CDP Services (Agent Wallets) ============
// Note: CDP services disabled for MVP due to ESM compatibility issues
// export * from "./cdp/index.js";

// ============ Thirdweb Services (Contract Interactions) ============
export * from "./thirdweb/index.js";

// ============ x402 Payment Middleware ============
// Disabled for MVP - x402 facilitator doesn't support Base mainnet yet
// Re-enable when x402 adds mainnet support

// ============ Convenience Re-exports ============

// Wallet types (from types/wallet.ts via CDP)
export type {
  WalletAddress,
  TransactionHash,
  CdpAgentWallet,
  ThirdwebInAppWallet,
  Wallet,
  TransactionReceipt,
  SupportedNetwork,
} from "../types/wallet.js";

export {
  WalletProviderType,
  TransactionStatus,
  SUPPORTED_NETWORKS,
  USDC_ADDRESSES,
  CHAIN_IDS,
  toWalletAddress,
  toTransactionHash,
  assertWalletAddress,
  assertTransactionHash,
  getCurrentNetwork,
  getUsdcAddress,
} from "../types/wallet.js";
