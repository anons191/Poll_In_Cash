// Re-export all auth utilities for convenient imports
// Usage: import { authenticateRequest, verifySignature, checkPollOwnership } from './auth';

export {
  createToken,
  verifyToken,
  extractBearerToken,
  authenticateRequest,
  isAuthenticated,
  JWT_CONFIG,
  type AuthResult,
} from "./middleware.js";

export {
  generateNonce,
  createSignMessage,
  isValidAddress,
  normalizeAddress,
  requestNonce,
  verifySignature,
  verifySignatureOnly,
} from "./wallet.js";

export {
  checkPollOwnership,
  checkPollReadAccess,
  checkResponseReadAccess,
  checkProfileOwnership,
  checkCanSubmitResponse,
  isAuthorized,
  formatOwnershipError,
  type OwnershipResult,
} from "./ownership.js";
