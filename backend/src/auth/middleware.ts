import jwt from "jsonwebtoken";
import type { JWTPayload, AuthenticatedUser } from "../types/auth.js";

/**
 * Get JWT secret from environment
 * Throws if not configured
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return secret;
}

/**
 * JWT configuration
 */
export const JWT_CONFIG = {
  /** Token expiration time in seconds (7 days) */
  expiresInSeconds: 7 * 24 * 60 * 60,
  /** Algorithm used for signing */
  algorithm: "HS256" as const,
};

/**
 * Create a JWT token for an authenticated user
 */
export function createToken(user: AuthenticatedUser): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    walletAddress: user.walletAddress.toLowerCase(),
    userId: user.userId,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: JWT_CONFIG.expiresInSeconds,
    algorithm: JWT_CONFIG.algorithm,
  });
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid/expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, getJWTSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
    }) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from Authorization header
 * Returns null if header is missing or malformed
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Result of authentication attempt
 */
export type AuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; error: string; code: string };

/**
 * Authenticate a request using the Authorization header
 * Returns the authenticated user or an error
 *
 * Usage in route handlers:
 * ```typescript
 * const authResult = authenticateRequest(req.headers.authorization);
 * if (!authResult.success) {
 *   return res.status(401).json({ error: authResult.error, code: authResult.code });
 * }
 * const { user } = authResult;
 * // user.walletAddress and user.userId are now available
 * ```
 */
export function authenticateRequest(authHeader: string | undefined): AuthResult {
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      success: false,
      error: "Missing or invalid Authorization header",
      code: "MISSING_TOKEN",
    };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return {
      success: false,
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    };
  }

  return {
    success: true,
    user: {
      walletAddress: payload.walletAddress,
      userId: payload.userId,
    },
  };
}

/**
 * Type guard for checking if auth result is successful
 */
export function isAuthenticated(
  result: AuthResult
): result is { success: true; user: AuthenticatedUser } {
  return result.success;
}
