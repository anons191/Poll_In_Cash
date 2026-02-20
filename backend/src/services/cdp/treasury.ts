/**
 * CDP Treasury Wallet Service
 *
 * Manages the platform treasury wallet that receives platform fees
 * and holds funds for x402 payment processing.
 *
 * The treasury wallet is created programmatically and its address
 * is stored in environment variables for consistent access.
 *
 * @module services/cdp/treasury
 */

import { randomUUID } from "crypto";
import {
  CdpEvmWalletProvider,
  type CdpWalletProviderConfig,
} from "@coinbase/agentkit";
import {
  type WalletAddress,
  SUPPORTED_NETWORKS,
  type SupportedNetwork,
  toWalletAddress,
  assertWalletAddress,
  getUsdcAddress,
  CHAIN_IDS,
} from "../../types/wallet.js";

// ============ Configuration ============

/**
 * Treasury wallet configuration
 */
export interface TreasuryConfig {
  /** The treasury wallet address */
  address: WalletAddress;
  /** The network the treasury is on */
  networkId: SupportedNetwork;
  /** Chain ID for the network */
  chainId: number;
  /** USDC contract address on this network */
  usdcAddress: WalletAddress;
}

/**
 * Get the treasury wallet address from environment
 * @throws Error if TREASURY_WALLET_ADDRESS is not set
 */
export function getTreasuryAddress(): WalletAddress {
  const address = process.env.TREASURY_WALLET_ADDRESS;

  if (!address) {
    throw new Error(
      "TREASURY_WALLET_ADDRESS environment variable is required. " +
        "Run `npx tsx src/services/cdp/create-treasury.ts` to create a treasury wallet."
    );
  }

  return assertWalletAddress(address);
}

/**
 * Get the full treasury configuration
 */
export function getTreasuryConfig(): TreasuryConfig {
  const networkId =
    process.env.NODE_ENV === "production"
      ? SUPPORTED_NETWORKS.BASE_MAINNET
      : SUPPORTED_NETWORKS.BASE_SEPOLIA;

  return {
    address: getTreasuryAddress(),
    networkId,
    chainId: CHAIN_IDS[networkId],
    usdcAddress: getUsdcAddress(),
  };
}

/**
 * Check if treasury is configured
 * x402 works on Base Sepolia via the Coinbase facilitator at https://www.x402.org/facilitator
 */
export function isTreasuryConfigured(): boolean {
  return Boolean(process.env.TREASURY_WALLET_ADDRESS);
}

// ============ Treasury Wallet Provider ============

/**
 * Create a provider for the treasury wallet
 *
 * This should only be used for administrative operations.
 * Most operations should just use the treasury address directly.
 *
 * @returns CdpEvmWalletProvider for the treasury wallet
 */
export async function getTreasuryProvider(): Promise<CdpEvmWalletProvider> {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    throw new Error("CDP credentials are required to access treasury wallet");
  }

  const treasuryAddress = getTreasuryAddress();
  const networkId =
    process.env.NODE_ENV === "production"
      ? SUPPORTED_NETWORKS.BASE_MAINNET
      : SUPPORTED_NETWORKS.BASE_SEPOLIA;

  const config: CdpWalletProviderConfig = {
    apiKeyId,
    apiKeySecret,
    walletSecret,
    address: treasuryAddress as `0x${string}`,
    networkId,
  };

  return CdpEvmWalletProvider.configureWithWallet(config);
}

// ============ Treasury Wallet Creation ============

/**
 * Result from creating a new treasury wallet
 */
export interface CreatedTreasuryWallet {
  /** The treasury wallet address */
  address: WalletAddress;
  /** The wallet name from CDP */
  name?: string;
  /** The network */
  networkId: SupportedNetwork;
  /** Environment variable to set */
  envVar: string;
}

/**
 * Create a new treasury wallet
 *
 * This should only be called once during initial setup.
 * The returned address should be stored in TREASURY_WALLET_ADDRESS.
 *
 * @param networkId - The network to create the treasury on (defaults to base-sepolia)
 * @returns The created treasury wallet information
 */
export async function createTreasuryWallet(
  networkId?: SupportedNetwork
): Promise<CreatedTreasuryWallet> {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    throw new Error(
      "CDP credentials (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET) are required"
    );
  }

  const network = networkId || SUPPORTED_NETWORKS.BASE_SEPOLIA;

  // Generate a new UUID for the treasury wallet
  // Note: Each call creates a new wallet. Store the address in env vars after creation.
  const idempotencyKey = randomUUID();

  const config: CdpWalletProviderConfig = {
    apiKeyId,
    apiKeySecret,
    walletSecret,
    networkId: network,
    idempotencyKey,
  };

  const provider = await CdpEvmWalletProvider.configureWithWallet(config);
  const exported = await provider.exportWallet();

  const address = toWalletAddress(exported.address);
  if (!address) {
    throw new Error(`Invalid treasury address returned: ${exported.address}`);
  }

  return {
    address,
    name: exported.name,
    networkId: network,
    envVar: `TREASURY_WALLET_ADDRESS=${address}`,
  };
}

// ============ Treasury Balance Functions ============

/**
 * Get the ETH balance of the treasury wallet
 *
 * @returns The treasury ETH balance in wei
 */
export async function getTreasuryBalance(): Promise<bigint> {
  const provider = await getTreasuryProvider();
  return provider.getBalance();
}

/**
 * Get the USDC balance of the treasury wallet
 *
 * @returns The treasury USDC balance (in 6 decimal units)
 */
export async function getTreasuryUsdcBalance(): Promise<bigint> {
  const provider = await getTreasuryProvider();
  const usdcAddress = getUsdcAddress();
  const treasuryAddress = getTreasuryAddress();

  const result = await provider.readContract({
    address: usdcAddress as `0x${string}`,
    abi: [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "balanceOf",
    args: [treasuryAddress as `0x${string}`],
  });

  return result;
}

/**
 * Format USDC balance to human-readable string
 *
 * @param balance - The USDC balance in 6 decimal units
 * @returns Formatted string (e.g., "100.50")
 */
export function formatUsdcBalance(balance: bigint): string {
  const balanceStr = balance.toString().padStart(7, "0");
  const intPart = balanceStr.slice(0, -6) || "0";
  const decPart = balanceStr.slice(-6);
  return `${intPart}.${decPart}`;
}

// ============ x402 Integration ============

/**
 * Get treasury configuration for x402 payment middleware
 *
 * @returns Configuration object for x402 payTo address
 */
export function getX402TreasuryConfig(): {
  payTo: WalletAddress;
  network: string;
  chainId: number;
} {
  const config = getTreasuryConfig();

  // x402 uses CAIP-2 chain identifiers
  const caip2NetworkId = `eip155:${config.chainId}`;

  return {
    payTo: config.address,
    network: caip2NetworkId,
    chainId: config.chainId,
  };
}
