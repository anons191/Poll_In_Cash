/**
 * Contract deployment helper using Thirdweb SDK
 * Deploys PollPool.sol to Base Sepolia
 */

import "dotenv/config";
import { createThirdwebClient } from "thirdweb";
import { deployContract } from "thirdweb/deploys";
import { baseSepolia } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import type { WalletAddress, TransactionHash } from "../../types/wallet.js";
import { toWalletAddress, USDC_ADDRESSES } from "../../types/wallet.js";
import * as fs from "fs";
import * as path from "path";

// Import the PollPool ABI and bytecode using require for JSON
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PollPoolArtifact = require("../../contracts/PollPool.json");

// ============ Types ============

/**
 * Deployment configuration for PollPool contract
 */
export interface DeploymentConfig {
  /** USDC token address on the network */
  usdcAddress: WalletAddress;
  /** Treasury address for platform fees */
  treasuryAddress: WalletAddress;
  /** Attestation signer address for verifying poll responses */
  attestationSignerAddress: WalletAddress;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  /** Deployed contract address */
  contractAddress: WalletAddress;
  /** Deployment transaction hash */
  transactionHash: TransactionHash;
  /** Network deployed to */
  network: string;
  /** Chain ID */
  chainId: number;
  /** Block number where contract was deployed */
  blockNumber?: number;
}

// ============ Client Setup ============

/**
 * Create Thirdweb client for deployment
 */
function createDeploymentClient() {
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  if (!secretKey) {
    throw new Error("THIRDWEB_SECRET_KEY environment variable is not set");
  }
  return createThirdwebClient({
    secretKey,
  });
}

/**
 * Get deployer account from private key
 */
function getDeployerAccount(client: ReturnType<typeof createThirdwebClient>) {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY or SERVER_WALLET_PRIVATE_KEY environment variable is not set");
  }
  return privateKeyToAccount({
    client,
    privateKey,
  });
}

// ============ Deployment Functions ============

/**
 * Deploy PollPool contract to Base Sepolia
 * @param config - Deployment configuration
 * @returns Deployment result with contract address
 */
export async function deployPollPool(config: DeploymentConfig): Promise<DeploymentResult> {
  console.log("Starting PollPool deployment to Base Sepolia...");
  console.log("Configuration:");
  console.log(`  USDC Address: ${config.usdcAddress}`);
  console.log(`  Treasury Address: ${config.treasuryAddress}`);
  console.log(`  Attestation Signer: ${config.attestationSignerAddress}`);

  const client = createDeploymentClient();
  const account = getDeployerAccount(client);

  console.log(`  Deployer Address: ${account.address}`);

  // Deploy using Thirdweb's deployContract
  const contractAddress = await deployContract({
    client,
    chain: baseSepolia,
    account,
    abi: PollPoolArtifact.abi,
    bytecode: PollPoolArtifact.bytecode as `0x${string}`,
    constructorParams: {
      _usdc: config.usdcAddress as string,
      _treasury: config.treasuryAddress as string,
      _attestationSigner: config.attestationSignerAddress as string,
    },
  });

  const validatedAddress = toWalletAddress(contractAddress);
  if (!validatedAddress) {
    throw new Error(`Invalid contract address returned: ${contractAddress}`);
  }

  console.log(`PollPool deployed successfully!`);
  console.log(`  Contract Address: ${validatedAddress}`);

  // Return the deployment result
  // Note: deployContract in thirdweb doesn't return tx hash directly
  return {
    contractAddress: validatedAddress,
    transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as TransactionHash,
    network: "base-sepolia",
    chainId: baseSepolia.id,
  };
}

/**
 * Deploy PollPool with default Base Sepolia configuration
 * Uses environment variables for addresses
 * @returns Deployment result
 */
export async function deployPollPoolWithDefaults(): Promise<DeploymentResult> {
  // Get addresses from environment or use defaults
  const usdcAddress = USDC_ADDRESSES["base-sepolia"];

  const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS || process.env.TREASURY_ADDRESS;
  if (!treasuryAddress) {
    throw new Error("TREASURY_WALLET_ADDRESS environment variable is not set");
  }
  const validatedTreasury = toWalletAddress(treasuryAddress);
  if (!validatedTreasury) {
    throw new Error(`Invalid TREASURY_WALLET_ADDRESS: ${treasuryAddress}`);
  }

  const attestationSignerAddress = process.env.ATTESTATION_SIGNER_ADDRESS;
  if (!attestationSignerAddress) {
    throw new Error("ATTESTATION_SIGNER_ADDRESS environment variable is not set");
  }
  const validatedAttestationSigner = toWalletAddress(attestationSignerAddress);
  if (!validatedAttestationSigner) {
    throw new Error(`Invalid ATTESTATION_SIGNER_ADDRESS: ${attestationSignerAddress}`);
  }

  return deployPollPool({
    usdcAddress,
    treasuryAddress: validatedTreasury,
    attestationSignerAddress: validatedAttestationSigner,
  });
}

/**
 * Update .env file with deployed contract address
 * @param contractAddress - The deployed contract address
 */
export async function updateEnvWithContractAddress(contractAddress: WalletAddress): Promise<void> {
  const envPath = path.join(process.cwd(), ".env");

  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    // .env file doesn't exist, create it
    envContent = "";
  }

  // Check if POLLPOOL_CONTRACT_ADDRESS already exists
  const regex = /^POLLPOOL_CONTRACT_ADDRESS=.*/m;
  const newLine = `POLLPOOL_CONTRACT_ADDRESS=${contractAddress}`;

  if (regex.test(envContent)) {
    // Replace existing line
    envContent = envContent.replace(regex, newLine);
  } else {
    // Add new line
    envContent = envContent.trim() + "\n" + newLine + "\n";
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Updated .env with POLLPOOL_CONTRACT_ADDRESS=${contractAddress}`);
}

/**
 * Full deployment flow: deploy and update .env
 * @returns Deployment result
 */
export async function deployAndConfigure(): Promise<DeploymentResult> {
  const result = await deployPollPoolWithDefaults();
  await updateEnvWithContractAddress(result.contractAddress);
  return result;
}

// ============ Verification ============

/**
 * Verify that a contract is deployed at the given address
 * @param contractAddress - The contract address to verify
 * @returns True if contract exists
 */
export async function verifyDeployment(contractAddress: WalletAddress): Promise<boolean> {
  const client = createDeploymentClient();

  try {
    // Try to call a view function on the contract
    const { getContract, readContract } = await import("thirdweb");

    const contract = getContract({
      client,
      chain: baseSepolia,
      address: contractAddress,
    });

    // Try to read the USDC address (a simple getter)
    const result = await readContract({
      contract,
      method: "function usdc() view returns (address)",
      params: [],
    });

    return result !== undefined;
  } catch (error) {
    console.error("Deployment verification failed:", error);
    return false;
  }
}

// ============ CLI Support ============

/**
 * Run deployment from command line
 * Usage: npx tsx src/services/thirdweb/deploy.ts
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
PollPool Contract Deployment Script

Usage: npx tsx src/services/thirdweb/deploy.ts [options]

Options:
  --help              Show this help message
  --verify <address>  Verify deployment at address

Environment Variables Required:
  THIRDWEB_SECRET_KEY         - Thirdweb secret key for API access
  DEPLOYER_PRIVATE_KEY        - Private key for deployment wallet (or SERVER_WALLET_PRIVATE_KEY)
  TREASURY_ADDRESS            - Address to receive platform fees
  ATTESTATION_SIGNER_ADDRESS  - Address that signs attestations

Example:
  THIRDWEB_SECRET_KEY=xxx DEPLOYER_PRIVATE_KEY=xxx TREASURY_ADDRESS=0x... ATTESTATION_SIGNER_ADDRESS=0x... npx tsx src/services/thirdweb/deploy.ts
    `);
    process.exit(0);
  }

  if (args.includes("--verify")) {
    const addressIndex = args.indexOf("--verify") + 1;
    const address = args[addressIndex];
    if (!address) {
      console.error("Please provide an address to verify");
      process.exit(1);
    }

    const validatedAddress = toWalletAddress(address);
    if (!validatedAddress) {
      console.error("Invalid address format");
      process.exit(1);
    }

    const isDeployed = await verifyDeployment(validatedAddress);
    console.log(`Contract at ${address} is ${isDeployed ? "deployed" : "NOT deployed"}`);
    process.exit(isDeployed ? 0 : 1);
  }

  // Default: run deployment
  try {
    const result = await deployAndConfigure();
    console.log("\nDeployment Complete!");
    console.log("==================");
    console.log(`Contract Address: ${result.contractAddress}`);
    console.log(`Network: ${result.network}`);
    console.log(`Chain ID: ${result.chainId}`);
    console.log("\nAdd this to your .env file:");
    console.log(`POLLPOOL_CONTRACT_ADDRESS=${result.contractAddress}`);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Export main for use as a module
export { main as runDeployment };

// Run the deployment when script is executed directly
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
