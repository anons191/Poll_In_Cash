import { Hono } from "hono";
import { requestNonce, verifySignature } from "../auth/wallet.js";
import { getUserById } from "../db/queries.js";
import { requireAuth, getUser } from "../middleware/auth.js";
import {
  validateBody,
  nonceRequestSchema,
  verifyRequestSchema,
  type NonceRequest,
  type VerifyRequest,
} from "../middleware/validate.js";
import type { AppEnv } from "../types/hono.js";

const auth = new Hono<AppEnv>();

/**
 * POST /auth/nonce
 * Generate a nonce for wallet signature verification
 * Public endpoint - no auth required
 */
auth.post("/nonce", validateBody(nonceRequestSchema), async (c) => {
  const { walletAddress } = c.get("validatedBody") as NonceRequest;

  const result = await requestNonce(walletAddress);

  if (!result.success) {
    return c.json({ error: result.error, code: "NONCE_FAILED" }, 400);
  }

  return c.json(result.data);
});

/**
 * POST /auth/verify
 * Verify a signed message and issue JWT
 * Public endpoint - no auth required
 */
auth.post("/verify", validateBody(verifyRequestSchema), async (c) => {
  const { walletAddress, signature, nonce } = c.get("validatedBody") as VerifyRequest;

  const result = await verifySignature(walletAddress, signature, nonce);

  if (!result.success) {
    return c.json({ error: result.error, code: "VERIFY_FAILED" }, 401);
  }

  return c.json(result.data);
});

/**
 * GET /auth/me
 * Get current authenticated user
 * Requires valid JWT
 */
auth.get("/me", requireAuth, async (c) => {
  const authUser = getUser(c);

  const user = await getUserById(authUser.userId);

  if (!user) {
    return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
  }

  return c.json({
    id: user.id,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt.toISOString(),
  });
});

export default auth;
