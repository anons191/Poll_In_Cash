/**
 * x402 Services Index
 *
 * Central export point for all x402 payment middleware services.
 *
 * @module services/x402
 */

export {
  // Middleware Factory
  createX402Middleware,
  createX402MiddlewareOptional,
  createNoOpMiddleware,
  createResourceServer,

  // Predefined Routes
  AGENT_ROUTES,
  AGENT_DISCOVERY_ROUTE,
  AGENT_MATCH_ROUTE,
  AGENT_RESPOND_ROUTE,

  // Utility Functions
  isX402Available,

  // Constants
  X402_PAYMENT_HEADER,
  HTTP_402_PAYMENT_REQUIRED,

  // Types
  type ProtectedRouteConfig,
  type RoutesConfig,
  type X402MiddlewareOptions,
} from "./middleware.js";
