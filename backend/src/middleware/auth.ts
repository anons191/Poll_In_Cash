import type { Context, MiddlewareHandler } from "hono";
import { authenticateRequest } from "../auth/middleware.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type { AppVariables } from "../types/hono.js";

type Env = { Variables: AppVariables };

/**
 * Hono middleware that requires JWT authentication
 * Attaches user to context on success, returns 401 on failure
 */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const result = authenticateRequest(authHeader);

  if (!result.success) {
    return c.json(
      {
        error: result.error,
        code: result.code,
      },
      401
    );
  }

  // Attach user to context
  c.set("user", result.user);
  return next();
};

/**
 * Hono middleware that optionally authenticates
 * Attaches user to context if valid token, continues without user if not
 */
export const optionalAuth: MiddlewareHandler<Env> = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader) {
    const result = authenticateRequest(authHeader);
    if (result.success) {
      c.set("user", result.user);
    }
  }

  return next();
};

/**
 * Helper to get authenticated user from context
 * Use in routes after requireAuth middleware
 */
export function getUser(c: Context): AuthenticatedUser {
  const user = c.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error("User not found in context. Did you forget requireAuth middleware?");
  }
  return user;
}

/**
 * Helper to get optional user from context
 * Returns null if not authenticated
 */
export function getOptionalUser(c: Context): AuthenticatedUser | null {
  return (c.get("user") as AuthenticatedUser | undefined) ?? null;
}
