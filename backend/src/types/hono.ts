import type { Hono } from "hono";
import type { AuthenticatedUser } from "./auth.js";

/**
 * Custom Hono context variables used across routes
 */
export interface AppVariables {
  user?: AuthenticatedUser;
  validatedBody?: unknown;
  validatedQuery?: unknown;
}

/**
 * App environment type for typed routes
 */
export type AppEnv = { Variables: AppVariables };

/**
 * Typed Hono app
 */
export type AppType = Hono<AppEnv>;
