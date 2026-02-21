/**
 * Chain Configuration
 * Unified config that switches between testnet and mainnet based on CHAIN_ENV
 */

export type ChainEnv = "mainnet" | "testnet";

export interface ChainConfig {
  env: ChainEnv;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcAddress: `0x${string}`;
  pollPoolAddress: `0x${string}`;
}

const CHAIN_ENV: ChainEnv = (process.env.CHAIN_ENV as ChainEnv) || "testnet";

const configs: Record<ChainEnv, Omit<ChainConfig, "env" | "pollPoolAddress">> = {
  mainnet: {
    chainId: 8453,
    chainName: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  testnet: {
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrl: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

// Get PollPool address from env (required)
const pollPoolAddress = process.env.POLLPOOL_CONTRACT_ADDRESS as `0x${string}`;

if (!pollPoolAddress && process.env.NODE_ENV !== "test") {
  console.warn("WARNING: POLLPOOL_CONTRACT_ADDRESS not set");
}

export const chainConfig: ChainConfig = {
  env: CHAIN_ENV,
  ...configs[CHAIN_ENV],
  pollPoolAddress: pollPoolAddress || ("0x0000000000000000000000000000000000000000" as `0x${string}`),
};

// Export individual values for convenience
export const {
  chainId: CHAIN_ID,
  chainName: CHAIN_NAME,
  rpcUrl: RPC_URL,
  explorerUrl: EXPLORER_URL,
  usdcAddress: USDC_ADDRESS,
  pollPoolAddress: POLLPOOL_ADDRESS,
} = chainConfig;

export const isMainnet = CHAIN_ENV === "mainnet";
export const isTestnet = CHAIN_ENV === "testnet";
