/**
 * Thirdweb services module
 * Exports all Thirdweb-related functionality for the Poll in Cash backend
 */

// ============ Client & Contract Interactions ============

export {
  // Client setup
  getThirdwebClient,
  getBaseSepoliaChain,
  getPollPoolContract,
  getUsdcContract,

  // Read functions
  readPollState,
  getParticipants,
  hasUserParticipated,
  calculatePayout,
  isPollExpired,
  getNextPollId,

  // Write functions
  closePoll,
  distribute,
  submitResponse,

  // Types
  PollStatus,
  type PollData,
  type DistributionResult,

  // Configuration
  BASE_SEPOLIA_CONFIG,
  CHAIN_ID,
} from "./client.js";

// ============ Contract Deployment ============
// Note: Deploy functions removed from runtime exports.
// Use `npx tsx src/services/thirdweb/deploy.ts` directly for deployment.

// ============ Gas Sponsorship ============

export {
  // Sponsorship configuration
  getSponsorshipPolicy,
  getPaymasterConfig,
  getFrontendGasConfig,
  shouldSponsorTransaction,

  // Sponsorship tracking
  logSponsoredTransaction,
  getUserDailySpend,
  isWithinDailyLimit,

  // Constants
  BASE_SEPOLIA_SPONSORSHIP_POLICY,
  SMART_WALLET_CONFIG,

  // Types
  type GasSponsorshipPolicy,
  type PaymasterConfig,
  type FrontendGasConfig,
  type SponsoredTransaction,
} from "./gas-sponsor.js";
