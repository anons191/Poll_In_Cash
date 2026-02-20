/**
 * JWT payload for authenticated requests
 */
export interface JWTPayload {
  /** Wallet address (lowercase, checksummed not required) */
  walletAddress: string;
  /** User ID from database */
  userId: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  walletAddress: string;
  userId: string;
}

/**
 * Request with authenticated user
 * Use this type for route handlers that require authentication
 */
export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

/**
 * Nonce request body
 */
export interface NonceRequestBody {
  walletAddress: string;
}

/**
 * Nonce response
 */
export interface NonceResponse {
  nonce: string;
  expiresAt: string;
  message: string;
}

/**
 * Verify signature request body
 */
export interface VerifyRequestBody {
  walletAddress: string;
  signature: string;
  nonce: string;
}

/**
 * Verify signature response (successful auth)
 */
export interface VerifyResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

/**
 * Auth error response
 */
export interface AuthErrorResponse {
  error: string;
  code: string;
}
