/**
 * Thirdweb client setup for Poll in Cash frontend
 * Configures the client with in-app wallet (email + social login)
 */

import { createThirdwebClient, defineChain } from "thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";

// ============ Configuration Constants ============

/**
 * Base Sepolia chain configuration
 */
export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpc: "https://sepolia.base.org",
  blockExplorers: [
    {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  ],
  testnet: true,
});

/**
 * USDC contract address on Base Sepolia
 */
export const USDC_ADDRESS = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as const;

/**
 * Test USDC (MockUSDC) contract address for testnet minting
 * Falls back to standard USDC_ADDRESS if not set
 */
export const TEST_USDC_ADDRESS = (process.env.NEXT_PUBLIC_TEST_USDC_ADDRESS || USDC_ADDRESS) as `0x${string}`;

/**
 * PollPool contract address (from environment)
 */
export function getPollPoolAddress(): string {
  const address = process.env.NEXT_PUBLIC_POLLPOOL_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("NEXT_PUBLIC_POLLPOOL_CONTRACT_ADDRESS environment variable is not set");
  }
  return address;
}

// ============ Thirdweb Client ============

/**
 * Get the Thirdweb client instance
 * Uses NEXT_PUBLIC_THIRDWEB_CLIENT_ID for client-side operations
 */
let _client: ReturnType<typeof createThirdwebClient> | null = null;

export function getThirdwebClient() {
  if (!_client) {
    const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    if (!clientId) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID environment variable is not set");
    }
    _client = createThirdwebClient({
      clientId,
    });
  }
  return _client;
}

// ============ Wallet Configuration ============

/**
 * In-app wallet configuration with email and social login
 * This creates embedded wallets for users without requiring MetaMask or other browser extensions
 */
export const inAppWalletConfig = inAppWallet({
  auth: {
    options: [
      "email",
      "google",
      "apple",
      "discord",
      "x",
    ],
  },
  // Smart wallet for gasless transactions
  smartAccount: {
    chain: baseSepolia,
    sponsorGas: true, // Enable gas sponsorship
  },
});

/**
 * All supported wallets for the connect modal
 * Includes both in-app wallet (email/social) and external wallets
 */
export const supportedWallets = [
  inAppWalletConfig,
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("walletConnect"),
];

/**
 * Recommended wallets to show first in the connect modal
 */
export const recommendedWallets = [
  inAppWalletConfig,
  createWallet("io.metamask"),
];

// ============ API Helpers ============

/**
 * Backend API base URL
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Request a nonce from the backend for wallet authentication
 * @param walletAddress - The wallet address to authenticate
 * @returns The nonce and message to sign
 */
export async function requestNonce(walletAddress: string): Promise<{
  nonce: string;
  message: string;
  expiresAt: string;
}> {
  const response = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to request nonce");
  }

  return response.json();
}

/**
 * Verify a signed message with the backend and get a JWT
 * @param walletAddress - The wallet address
 * @param signature - The signed message
 * @param nonce - The nonce used for signing
 * @returns JWT token and user info
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<{
  token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress, signature, nonce }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to verify signature");
  }

  return response.json();
}

// ============ Token Storage ============

const TOKEN_STORAGE_KEY = "poll_in_cash_token";

/**
 * Store the JWT token in localStorage
 * @param token - The JWT token to store
 */
export function storeAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

/**
 * Get the stored JWT token
 * @returns The stored token or null
 */
export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

/**
 * Clear the stored JWT token
 */
export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Check if user is authenticated
 * @returns True if a token is stored
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// ============ Contract Helpers ============

/**
 * Standard ERC20 ABI for USDC interactions
 */
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * PollPool contract ABI (key functions only)
 */
export const POLLPOOL_ABI = [
  {
    name: "createPoll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_title", type: "string" },
      { name: "_criteriaHash", type: "bytes32" },
      { name: "_participantCap", type: "uint256" },
      { name: "_duration", type: "uint256" },
      { name: "_fundAmount", type: "uint256" },
    ],
    outputs: [{ name: "pollId", type: "uint256" }],
  },
  {
    name: "getPoll",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "title", type: "string" },
          { name: "criteriaHash", type: "bytes32" },
          { name: "totalFunded", type: "uint256" },
          { name: "distributablePool", type: "uint256" },
          { name: "participantCap", type: "uint256" },
          { name: "participantCount", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "submitResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_pollId", type: "uint256" },
      { name: "_attestationSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "closePoll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "distribute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "calculatePayout",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [{ name: "payoutPerPerson", type: "uint256" }],
  },
] as const;

// ============ Utility Functions ============

/**
 * Format USDC amount (6 decimals) to human-readable string
 * @param amount - Amount in smallest units (6 decimals)
 * @returns Formatted string like "10.50"
 */
export function formatUsdcAmount(amount: bigint): string {
  const value = Number(amount) / 1_000_000;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Parse human-readable USDC amount to contract units
 * @param amount - Amount like "10.50"
 * @returns BigInt in smallest units
 */
export function parseUsdcAmount(amount: string): bigint {
  const value = parseFloat(amount);
  if (isNaN(value) || value < 0) {
    throw new Error("Invalid USDC amount");
  }
  return BigInt(Math.round(value * 1_000_000));
}

/**
 * Shorten a wallet address for display
 * @param address - Full wallet address
 * @returns Shortened like "0x1234...5678"
 */
export function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
