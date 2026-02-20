/**
 * x402 Payment Middleware for Hono
 *
 * Configures x402 payment middleware for agent-facing endpoints.
 * This enables pay-per-request functionality using USDC on Base.
 *
 * The x402 protocol uses HTTP 402 Payment Required status codes
 * to enable clients to programmatically pay for API access.
 *
 * @module services/x402/middleware
 * @see https://github.com/coinbase/x402
 */

import type { MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  getX402TreasuryConfig,
  isTreasuryConfigured,
} from "../cdp/treasury.js";
import {
  CHAIN_IDS,
  SUPPORTED_NETWORKS,
  type WalletAddress,
} from "../../types/wallet.js";

// ============ Configuration Types ============

/**
 * Configuration for a protected route
 */
export interface ProtectedRouteConfig {
  /** Price in USD (e.g., "$0.10") */
  price: string;
  /** Description shown to users */
  description: string;
  /** Optional MIME type of the response */
  mimeType?: string;
  /** Maximum timeout in seconds (default: 60) */
  maxTimeoutSeconds?: number;
}

/**
 * Map of route patterns to their payment configuration
 */
export type RoutesConfig = Record<string, ProtectedRouteConfig>;

/**
 * x402 middleware configuration options
 */
export interface X402MiddlewareOptions {
  /** The wallet address to receive payments */
  payTo?: WalletAddress;
  /** Network to use (defaults to current environment network) */
  network?: string;
  /** Custom facilitator URL (defaults to x402.org) */
  facilitatorUrl?: string;
  /** App name for paywall UI */
  appName?: string;
  /** App logo URL for paywall UI */
  appLogo?: string;
  /** Whether running on testnet */
  testnet?: boolean;
}

// ============ Default Configuration ============

/** Default facilitator URL - Coinbase x402 facilitator that supports Base Sepolia */
const DEFAULT_FACILITATOR_URL = "https://www.x402.org/facilitator";

/** CAIP-2 chain identifier type */
type Caip2ChainId = `${string}:${string}`;

/**
 * Get the CAIP-2 network identifier for x402
 */
function getX402NetworkId(): Caip2ChainId {
  const networkId =
    process.env.NODE_ENV === "production"
      ? SUPPORTED_NETWORKS.BASE_MAINNET
      : SUPPORTED_NETWORKS.BASE_SEPOLIA;

  const chainId = CHAIN_IDS[networkId];
  return `eip155:${chainId}` as Caip2ChainId;
}

// ============ Resource Server Factory ============

/**
 * Create an x402 resource server instance
 *
 * @param options - Configuration options
 * @returns Configured x402ResourceServer
 */
export function createResourceServer(
  options: X402MiddlewareOptions = {}
): x402ResourceServer {
  const facilitatorUrl = options.facilitatorUrl || DEFAULT_FACILITATOR_URL;

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);

  // Register the EVM scheme for the current network
  const networkId = (options.network || getX402NetworkId()) as Caip2ChainId;
  resourceServer.register(networkId, new ExactEvmScheme());

  return resourceServer;
}

// ============ Route Configuration Builder ============

/**
 * Build x402 route configuration from simplified config
 *
 * @param routes - Simplified route configuration
 * @param options - Middleware options
 * @returns x402 routes configuration object
 */
function buildRoutesConfig(
  routes: RoutesConfig,
  options: X402MiddlewareOptions
): Record<string, any> {
  const treasuryConfig = getX402TreasuryConfig();
  const payTo = options.payTo || treasuryConfig.payTo;
  const network = options.network || treasuryConfig.network;

  const x402Routes: Record<string, any> = {};

  for (const [routePattern, config] of Object.entries(routes)) {
    x402Routes[routePattern] = {
      accepts: {
        scheme: "exact",
        price: config.price,
        network,
        payTo,
        maxTimeoutSeconds: config.maxTimeoutSeconds || 60,
      },
      description: config.description,
      mimeType: config.mimeType,
    };
  }

  return x402Routes;
}

// ============ Middleware Factory ============

/**
 * Create x402 payment middleware for Hono
 *
 * This middleware protects specified routes with USDC payment requirements.
 * Payments are made to the treasury wallet and verified by the x402 facilitator.
 *
 * @param routes - Route configurations for protected endpoints
 * @param options - Optional middleware configuration
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { createX402Middleware } from "./services/x402/middleware.js";
 *
 * const app = new Hono();
 *
 * // Protect agent endpoints with payment requirements
 * app.use(
 *   createX402Middleware({
 *     "POST /agent/polls/:id/respond": {
 *       price: "$0.01",
 *       description: "Submit poll response",
 *     },
 *     "GET /agent/polls/discover": {
 *       price: "$0.001",
 *       description: "Discover available polls",
 *     },
 *   })
 * );
 * ```
 */
export function createX402Middleware(
  routes: RoutesConfig,
  options: X402MiddlewareOptions = {}
): MiddlewareHandler {
  // Validate treasury is configured
  if (!isTreasuryConfigured() && !options.payTo) {
    throw new Error(
      "Treasury wallet not configured. Set TREASURY_WALLET_ADDRESS or provide payTo option."
    );
  }

  // Build configuration
  const resourceServer = createResourceServer(options);
  const x402Routes = buildRoutesConfig(routes, options);

  // Build paywall config if app info provided
  const paywallConfig = options.appName
    ? {
        appName: options.appName,
        appLogo: options.appLogo,
        testnet:
          options.testnet ??
          process.env.NODE_ENV !== "production",
      }
    : undefined;

  // Create and return the middleware
  return paymentMiddleware(x402Routes, resourceServer, paywallConfig);
}

// ============ Predefined Route Configurations ============

/**
 * Default payment configuration for agent discovery endpoint
 */
export const AGENT_DISCOVERY_ROUTE: ProtectedRouteConfig = {
  price: "$0.001",
  description: "Discover available polls matching agent criteria",
  mimeType: "application/json",
};

/**
 * Default payment configuration for poll matching endpoint
 */
export const AGENT_MATCH_ROUTE: ProtectedRouteConfig = {
  price: "$0.005",
  description: "Check eligibility for a specific poll",
  mimeType: "application/json",
};

/**
 * Default payment configuration for response submission endpoint
 */
export const AGENT_RESPOND_ROUTE: ProtectedRouteConfig = {
  price: "$0.01",
  description: "Submit response to a poll",
  mimeType: "application/json",
};

/**
 * Default routes configuration for agent-facing endpoints
 *
 * @example
 * ```typescript
 * import { createX402Middleware, AGENT_ROUTES } from "./services/x402/middleware.js";
 *
 * app.use("/agent/*", createX402Middleware(AGENT_ROUTES));
 * ```
 */
export const AGENT_ROUTES: RoutesConfig = {
  "GET /agent/polls/discover": AGENT_DISCOVERY_ROUTE,
  "POST /agent/polls/:id/match": AGENT_MATCH_ROUTE,
  "POST /agent/polls/:id/respond": AGENT_RESPOND_ROUTE,
};

// ============ Utility Functions ============

/**
 * Check if x402 middleware is available
 *
 * x402 requires a treasury wallet and proper CDP configuration.
 *
 * @returns true if x402 can be enabled
 */
export function isX402Available(): boolean {
  return isTreasuryConfigured();
}

/**
 * Get x402 payment header name
 *
 * The x402 protocol uses this header to pass payment proofs.
 */
export const X402_PAYMENT_HEADER = "X-Payment";

/**
 * Get x402 payment required status code
 */
export const HTTP_402_PAYMENT_REQUIRED = 402;

/**
 * Create a no-op middleware for when x402 is disabled
 *
 * This allows the app to run without payment requirements
 * when x402 is not configured (e.g., in development).
 *
 * @returns Middleware that passes through all requests
 */
export function createNoOpMiddleware(): MiddlewareHandler {
  return async (_c, next) => {
    await next();
  };
}

/**
 * Create x402 middleware with fallback to no-op if not configured
 *
 * This is useful for development environments where the treasury
 * may not be set up yet.
 *
 * @param routes - Route configurations
 * @param options - Middleware options
 * @returns x402 middleware or no-op middleware
 */
export function createX402MiddlewareOptional(
  routes: RoutesConfig,
  options: X402MiddlewareOptions = {}
): MiddlewareHandler {
  if (!isX402Available() && !options.payTo) {
    console.warn(
      "[x402] Treasury not configured. Payment middleware disabled."
    );
    return createNoOpMiddleware();
  }

  return createX402Middleware(routes, options);
}
