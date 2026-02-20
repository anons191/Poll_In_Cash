import { ethers } from "ethers";
import { randomBytes } from "crypto";
import {
  createAuthNonce,
  getValidNonce,
  markNonceUsed,
  getOrCreateUser,
  getOrCreateAgentProfile,
} from "../db/queries.js";
import { createToken } from "./middleware.js";
import type {
  NonceResponse,
  VerifyResponse,
  AuthenticatedUser,
} from "../types/auth.js";

/**
 * The message template for wallet signature
 * The nonce is appended to prevent replay attacks
 */
const SIGN_MESSAGE_TEMPLATE = `Sign this message to authenticate with Poll in Cash.

This signature proves you own this wallet address and will not trigger any blockchain transaction or cost any gas.

Nonce: `;

/**
 * Generate a cryptographically secure random nonce
 */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create the message that the user should sign
 */
export function createSignMessage(nonce: string): string {
  return SIGN_MESSAGE_TEMPLATE + nonce;
}

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address); // Will throw if invalid
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize an Ethereum address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Request a nonce for wallet authentication
 *
 * Flow:
 * 1. Client sends wallet address
 * 2. Server generates nonce, stores in DB with expiry
 * 3. Server returns nonce and message to sign
 */
export async function requestNonce(
  walletAddress: string
): Promise<{ success: true; data: NonceResponse } | { success: false; error: string }> {
  // Validate address format
  if (!isValidAddress(walletAddress)) {
    return { success: false, error: "Invalid wallet address format" };
  }

  const normalizedAddress = normalizeAddress(walletAddress);
  const nonce = generateNonce();

  // Store nonce in database
  const authNonce = await createAuthNonce(normalizedAddress, nonce);

  const message = createSignMessage(nonce);

  return {
    success: true,
    data: {
      nonce,
      expiresAt: authNonce.expiresAt.toISOString(),
      message,
    },
  };
}

/**
 * Verify a signed message and issue JWT
 *
 * Flow:
 * 1. Client signs the message containing the nonce
 * 2. Server verifies signature recovers to the claimed address
 * 3. Server checks nonce is valid (exists, not expired, not used)
 * 4. Server marks nonce as used
 * 5. Server creates/gets user, creates JWT
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<{ success: true; data: VerifyResponse } | { success: false; error: string }> {
  // Validate address format
  if (!isValidAddress(walletAddress)) {
    return { success: false, error: "Invalid wallet address format" };
  }

  const normalizedAddress = normalizeAddress(walletAddress);

  // Check nonce is valid
  const storedNonce = await getValidNonce(normalizedAddress, nonce);
  if (!storedNonce) {
    return { success: false, error: "Invalid or expired nonce" };
  }

  // Reconstruct the message that was signed
  const message = createSignMessage(nonce);

  // Verify the signature
  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch {
    return { success: false, error: "Invalid signature format" };
  }

  // Check recovered address matches claimed address
  if (normalizeAddress(recoveredAddress) !== normalizedAddress) {
    return { success: false, error: "Signature does not match wallet address" };
  }

  // Mark nonce as used (prevent replay)
  await markNonceUsed(storedNonce.id);

  // Get or create user
  const user = await getOrCreateUser(normalizedAddress);

  // Ensure agent profile exists
  await getOrCreateAgentProfile(user.id);

  // Create JWT
  const authenticatedUser: AuthenticatedUser = {
    walletAddress: normalizedAddress,
    userId: user.id,
  };
  const token = createToken(authenticatedUser);

  return {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    },
  };
}

/**
 * Verify a signature without database interaction
 * Useful for verifying attestations or other signed messages
 */
export function verifySignatureOnly(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return (
      normalizeAddress(recoveredAddress) === normalizeAddress(expectedAddress)
    );
  } catch {
    return false;
  }
}
