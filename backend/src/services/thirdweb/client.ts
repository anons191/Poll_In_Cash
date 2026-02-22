/**
 * Thirdweb client and contract interaction helpers
 * Server-side Thirdweb client for PollPool contract interactions
 *
 * Uses dynamic chain configuration from config/chain.ts to support
 * both testnet (Base Sepolia) and mainnet (Base) deployments.
 */

import { createThirdwebClient, getContract, readContract, prepareContractCall, sendTransaction, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import type {
  WalletAddress,
  TransactionReceipt,
  TransactionStatus,
} from "../../types/wallet.js";
import {
  toWalletAddress,
  toTransactionHash,
} from "../../types/wallet.js";

// Import dynamic chain configuration
import {
  CHAIN_ID,
  CHAIN_NAME,
  RPC_URL,
  EXPLORER_URL,
  USDC_ADDRESS,
  POLLPOOL_ADDRESS,
  isMainnet,
} from "../../config/chain.js";

// Import the PollPool ABI (inlined for deployment compatibility)
import { POLLPOOL_ABI } from "../../contracts/pollpool-abi.js";

// ============ Types ============

/**
 * Poll status enum matching the Solidity contract
 */
export enum PollStatus {
  Active = 0,
  Closed = 1,
  Distributed = 2,
  Cancelled = 3,
}

/**
 * Poll data structure from the contract
 */
export interface PollData {
  creator: WalletAddress;
  title: string;
  criteriaHash: string;
  totalFunded: bigint;
  distributablePool: bigint;
  participantCap: bigint;
  participantCount: bigint;
  expiresAt: bigint;
  status: PollStatus;
}

/**
 * Distribution result from contract
 */
export interface DistributionResult {
  participantCount: bigint;
  payoutPerPerson: bigint;
  returnedToCreator: bigint;
}

// ============ Client Setup ============

/**
 * Get the Thirdweb client instance (singleton)
 */
let _client: ReturnType<typeof createThirdwebClient> | null = null;

export function getThirdwebClient() {
  if (!_client) {
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error("THIRDWEB_SECRET_KEY environment variable is not set");
    }
    _client = createThirdwebClient({
      secretKey,
    });
  }
  return _client;
}

/**
 * Dynamic chain configuration based on CHAIN_ENV
 * Uses defineChain to create a chain object compatible with thirdweb
 */
let _chain: ReturnType<typeof defineChain> | null = null;

export function getChain() {
  if (!_chain) {
    _chain = defineChain({
      id: CHAIN_ID,
      name: CHAIN_NAME,
      rpc: RPC_URL,
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      blockExplorers: [
        {
          name: isMainnet ? "BaseScan" : "BaseScan Sepolia",
          url: EXPLORER_URL,
        },
      ],
    });
  }
  return _chain;
}

/**
 * @deprecated Use getChain() instead - supports both mainnet and testnet
 */
export function getBaseSepoliaChain() {
  return getChain();
}

/**
 * Get the PollPool contract instance
 * Uses dynamic chain from config (mainnet or testnet based on CHAIN_ENV)
 */
export function getPollPoolContract() {
  if (!POLLPOOL_ADDRESS || POLLPOOL_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("POLLPOOL_CONTRACT_ADDRESS environment variable is not set");
  }

  return getContract({
    client: getThirdwebClient(),
    chain: getChain(),
    address: POLLPOOL_ADDRESS,
    abi: POLLPOOL_ABI as any,
  });
}

/**
 * Get the USDC contract instance
 * Uses dynamic chain and USDC address from config (mainnet or testnet based on CHAIN_ENV)
 */
export function getUsdcContract() {
  // Standard ERC20 ABI for approve and allowance
  const erc20Abi = [
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
  ] as const;

  return getContract({
    client: getThirdwebClient(),
    chain: getChain(),
    address: USDC_ADDRESS,
    abi: erc20Abi,
  });
}

// ============ Read Functions ============

/**
 * Read poll state from the contract
 * @param pollId - The poll ID to query
 * @returns Poll data or null if not found
 */
export async function readPollState(pollId: bigint): Promise<PollData | null> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function getPoll(uint256 _pollId) view returns ((address creator, string title, bytes32 criteriaHash, uint256 totalFunded, uint256 distributablePool, uint256 participantCap, uint256 participantCount, uint256 expiresAt, uint8 status))",
      params: [pollId],
    });

    const creatorAddress = toWalletAddress(result.creator);
    if (!creatorAddress) {
      return null;
    }

    return {
      creator: creatorAddress,
      title: result.title,
      criteriaHash: result.criteriaHash,
      totalFunded: result.totalFunded,
      distributablePool: result.distributablePool,
      participantCap: result.participantCap,
      participantCount: result.participantCount,
      expiresAt: result.expiresAt,
      status: result.status as PollStatus,
    };
  } catch (error) {
    console.error(`Error reading poll state for pollId ${pollId}:`, error);
    return null;
  }
}

/**
 * Get participants for a poll
 * @param pollId - The poll ID
 * @returns Array of participant addresses
 */
export async function getParticipants(pollId: bigint): Promise<WalletAddress[]> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function getParticipants(uint256 _pollId) view returns (address[])",
      params: [pollId],
    });

    return result
      .map((addr: string) => toWalletAddress(addr))
      .filter((addr): addr is WalletAddress => addr !== null);
  } catch (error) {
    console.error(`Error getting participants for pollId ${pollId}:`, error);
    return [];
  }
}

/**
 * Check if a user has participated in a poll
 * @param pollId - The poll ID
 * @param userAddress - The user's wallet address
 * @returns True if the user has participated
 */
export async function hasUserParticipated(
  pollId: bigint,
  userAddress: WalletAddress
): Promise<boolean> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function hasParticipated(uint256, address) view returns (bool)",
      params: [pollId, userAddress],
    });

    return result;
  } catch (error) {
    console.error(`Error checking participation for pollId ${pollId}:`, error);
    return false;
  }
}

/**
 * Calculate the payout per person for a poll
 * @param pollId - The poll ID
 * @returns Payout per person in USDC (6 decimals)
 */
export async function calculatePayout(pollId: bigint): Promise<bigint> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function calculatePayout(uint256 _pollId) view returns (uint256 payoutPerPerson)",
      params: [pollId],
    });

    return result;
  } catch (error) {
    console.error(`Error calculating payout for pollId ${pollId}:`, error);
    return 0n;
  }
}

/**
 * Check if a poll has expired
 * @param pollId - The poll ID
 * @returns True if the poll is expired
 */
export async function isPollExpired(pollId: bigint): Promise<boolean> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function isPollExpired(uint256 _pollId) view returns (bool)",
      params: [pollId],
    });

    return result;
  } catch (error) {
    console.error(`Error checking expiration for pollId ${pollId}:`, error);
    return false;
  }
}

/**
 * Get the next poll ID from the contract
 * @returns The next poll ID that will be assigned
 */
export async function getNextPollId(): Promise<bigint> {
  try {
    const contract = getPollPoolContract();

    const result = await readContract({
      contract,
      method: "function nextPollId() view returns (uint256)",
      params: [],
    });

    return result;
  } catch (error) {
    console.error("Error getting next poll ID:", error);
    return 0n;
  }
}

// ============ Write Functions ============

/**
 * Get a wallet account from private key for server-side transactions
 */
function getServerAccount() {
  const privateKey = process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("SERVER_WALLET_PRIVATE_KEY environment variable is not set");
  }
  return privateKeyToAccount({
    client: getThirdwebClient(),
    privateKey,
  });
}

/**
 * Close a poll on-chain
 * @param pollId - The poll ID to close
 * @returns Transaction receipt
 */
export async function closePoll(pollId: bigint): Promise<TransactionReceipt> {
  const contract = getPollPoolContract();
  const account = getServerAccount();

  const transaction = prepareContractCall({
    contract,
    method: "function closePoll(uint256 _pollId)",
    params: [pollId],
  });

  const txResult = await sendTransaction({
    transaction,
    account,
  });

  const hash = toTransactionHash(txResult.transactionHash);
  if (!hash) {
    throw new Error(`Invalid transaction hash: ${txResult.transactionHash}`);
  }

  return {
    hash,
    status: "confirmed" as TransactionStatus,
    // Note: Additional receipt details can be fetched using waitForReceipt
  };
}

/**
 * Distribute funds for a closed poll
 * @param pollId - The poll ID to distribute
 * @returns Transaction receipt
 */
export async function distribute(pollId: bigint): Promise<TransactionReceipt> {
  const contract = getPollPoolContract();
  const account = getServerAccount();

  const transaction = prepareContractCall({
    contract,
    method: "function distribute(uint256 _pollId)",
    params: [pollId],
  });

  const txResult = await sendTransaction({
    transaction,
    account,
  });

  const hash = toTransactionHash(txResult.transactionHash);
  if (!hash) {
    throw new Error(`Invalid transaction hash: ${txResult.transactionHash}`);
  }

  return {
    hash,
    status: "confirmed" as TransactionStatus,
  };
}

/**
 * Submit a poll response with attestation (called on behalf of a user)
 * This is used when a user submits a response through our system
 * @param pollId - The poll ID
 * @param attestationSignature - The attestation signature proving eligibility
 * @returns Transaction receipt
 */
export async function submitResponse(
  pollId: bigint,
  attestationSignature: `0x${string}`
): Promise<TransactionReceipt> {
  const contract = getPollPoolContract();
  const account = getServerAccount();

  const transaction = prepareContractCall({
    contract,
    method: "function submitResponse(uint256 _pollId, bytes _attestationSignature)",
    params: [pollId, attestationSignature],
  });

  const txResult = await sendTransaction({
    transaction,
    account,
  });

  const hash = toTransactionHash(txResult.transactionHash);
  if (!hash) {
    throw new Error(`Invalid transaction hash: ${txResult.transactionHash}`);
  }

  return {
    hash,
    status: "confirmed" as TransactionStatus,
  };
}

// ============ Configuration ============

/**
 * Current network configuration (dynamic based on CHAIN_ENV)
 * - mainnet: Base (Chain ID 8453)
 * - testnet: Base Sepolia (Chain ID 84532)
 */
export const NETWORK_CONFIG = {
  chainId: CHAIN_ID,
  name: CHAIN_NAME,
  rpcUrl: RPC_URL,
  blockExplorer: EXPLORER_URL,
  usdcAddress: USDC_ADDRESS,
  pollPoolAddress: POLLPOOL_ADDRESS,
  isMainnet,
} as const;

/**
 * @deprecated Use NETWORK_CONFIG instead
 */
export const BASE_SEPOLIA_CONFIG = NETWORK_CONFIG;

/**
 * Re-export chain ID for convenience (from config)
 */
export { CHAIN_ID };
