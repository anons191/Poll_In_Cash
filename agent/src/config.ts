/**
 * Agent Configuration
 *
 * Loads configuration from environment variables and provides defaults.
 * Configuration values for API connection, polling behavior, and user preferences.
 *
 * @module agent/config
 */

import { config as dotenvConfig } from 'dotenv';
import type { AgentConfig } from './types.js';
import { DEFAULT_AGENT_CONFIG } from './types.js';

// Load environment variables
dotenvConfig();

/**
 * Parse a comma-separated string into an array
 */
function parseStringList(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse a number from environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load agent configuration from environment variables
 * Falls back to defaults for any missing values
 */
export function loadConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  const envConfig: AgentConfig = {
    // API Configuration
    apiBaseUrl: process.env.AGENT_API_BASE_URL ||
                process.env.API_BASE_URL ||
                DEFAULT_AGENT_CONFIG.apiBaseUrl,

    // Polling Configuration
    pollingIntervalMs: parseNumber(
      process.env.AGENT_POLLING_INTERVAL_MS,
      DEFAULT_AGENT_CONFIG.pollingIntervalMs
    ),

    // Payout Configuration
    minimumPayoutUsdc: parseNumber(
      process.env.AGENT_MINIMUM_PAYOUT_USDC,
      DEFAULT_AGENT_CONFIG.minimumPayoutUsdc
    ),

    // Mode Configuration
    autoMode: parseBoolean(
      process.env.AGENT_AUTO_MODE,
      DEFAULT_AGENT_CONFIG.autoMode
    ),

    // Concurrency Configuration
    maxConcurrentResponses: parseNumber(
      process.env.AGENT_MAX_CONCURRENT_RESPONSES,
      DEFAULT_AGENT_CONFIG.maxConcurrentResponses
    ),

    // Topic Exclusions
    excludedTopics: parseStringList(process.env.AGENT_EXCLUDED_TOPICS) ||
                    DEFAULT_AGENT_CONFIG.excludedTopics,

    // Network Configuration
    network: (process.env.AGENT_NETWORK as 'base-sepolia' | 'base-mainnet') ||
             DEFAULT_AGENT_CONFIG.network,

    // Profile Configuration
    profilePath: process.env.AGENT_PROFILE_PATH ||
                 DEFAULT_AGENT_CONFIG.profilePath,

    // Logging Configuration
    verbose: parseBoolean(
      process.env.AGENT_VERBOSE,
      DEFAULT_AGENT_CONFIG.verbose
    ),
  };

  // Merge with any overrides
  return {
    ...envConfig,
    ...overrides,
  };
}

/**
 * Validate configuration values
 * Throws an error if any values are invalid
 */
export function validateConfig(config: AgentConfig): void {
  // Validate API URL
  try {
    new URL(config.apiBaseUrl);
  } catch {
    throw new Error(`Invalid API base URL: ${config.apiBaseUrl}`);
  }

  // Validate polling interval (minimum 10 seconds)
  if (config.pollingIntervalMs < 10000) {
    throw new Error(`Polling interval must be at least 10000ms, got: ${config.pollingIntervalMs}`);
  }

  // Validate minimum payout (must be positive)
  if (config.minimumPayoutUsdc < 0) {
    throw new Error(`Minimum payout must be non-negative, got: ${config.minimumPayoutUsdc}`);
  }

  // Validate max concurrent responses (must be positive)
  if (config.maxConcurrentResponses < 1) {
    throw new Error(`Max concurrent responses must be at least 1, got: ${config.maxConcurrentResponses}`);
  }

  // Validate network
  if (!['base-sepolia', 'base-mainnet'].includes(config.network)) {
    throw new Error(`Invalid network: ${config.network}. Must be 'base-sepolia' or 'base-mainnet'`);
  }
}

/**
 * Create a validated configuration from environment
 */
export function createConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  const config = loadConfig(overrides);
  validateConfig(config);
  return config;
}

/**
 * Get configuration summary for logging (hides sensitive values)
 */
export function getConfigSummary(config: AgentConfig): string {
  return [
    `API Base URL: ${config.apiBaseUrl}`,
    `Network: ${config.network}`,
    `Polling Interval: ${config.pollingIntervalMs}ms`,
    `Minimum Payout: ${config.minimumPayoutUsdc} USDC`,
    `Auto Mode: ${config.autoMode}`,
    `Max Concurrent: ${config.maxConcurrentResponses}`,
    `Excluded Topics: ${config.excludedTopics.length > 0 ? config.excludedTopics.join(', ') : 'none'}`,
    `Profile Path: ${config.profilePath}`,
    `Verbose: ${config.verbose}`,
  ].join('\n');
}

// Export default config for convenience
export const defaultConfig = DEFAULT_AGENT_CONFIG;

// Contract address constant (must match backend POLLPOOL_CONTRACT_ADDRESS)
export const POLL_CONTRACT_ADDRESS = '0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a';

// USDC contract address on Base Sepolia
export const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS ||
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
