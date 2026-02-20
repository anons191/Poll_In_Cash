#!/usr/bin/env npx tsx
/**
 * Deploy PollPoolV2 (hardened version) to Base Sepolia using Thirdweb SDK
 */

import "dotenv/config";
import { createThirdwebClient } from "thirdweb";
import { deployContract } from "thirdweb/deploys";
import { baseSepolia } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import * as fs from "fs";
import * as path from "path";

// Import the PollPoolV2 ABI and bytecode
const PollPoolV2Artifact = require("../../contracts/artifacts/src/PollPoolV2.sol/PollPoolV2.json");

// ============ Configuration ============

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const TREASURY_ADDRESS = process.env.TREASURY_WALLET_ADDRESS || "0x495721378c27a51a2bd7f176bad570d5148c88d5";
const ATTESTATION_SIGNER = process.env.ATTESTATION_SIGNER_ADDRESS || process.env.DEPLOYER_PRIVATE_KEY;

// ============ Deployment ============

async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         PollPoolV2 Deployment to Base Sepolia             ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  // Validate environment
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  if (!secretKey) {
    throw new Error("THIRDWEB_SECRET_KEY environment variable is not set");
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY environment variable is not set");
  }

  if (!ATTESTATION_SIGNER) {
    throw new Error("ATTESTATION_SIGNER_ADDRESS environment variable is not set");
  }

  // Create client and account
  const client = createThirdwebClient({ secretKey });
  const account = privateKeyToAccount({ client, privateKey });

  console.log("Configuration:");
  console.log(`  Deployer:           ${account.address}`);
  console.log(`  USDC Address:       ${USDC_ADDRESS}`);
  console.log(`  Treasury Address:   ${TREASURY_ADDRESS}`);
  console.log(`  Attestation Signer: ${ATTESTATION_SIGNER}`);
  console.log(`  Network:            Base Sepolia (${baseSepolia.id})`);
  console.log("");

  console.log("Deploying PollPoolV2...");

  // Deploy the contract
  const contractAddress = await deployContract({
    client,
    chain: baseSepolia,
    account,
    abi: PollPoolV2Artifact.abi,
    bytecode: PollPoolV2Artifact.bytecode as `0x${string}`,
    constructorParams: {
      _usdc: USDC_ADDRESS,
      _treasury: TREASURY_ADDRESS,
      _attestationSigner: ATTESTATION_SIGNER,
    },
  });

  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║                  Deployment Successful!                   ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Contract Address:  ${contractAddress}`);
  console.log(`  Network:           Base Sepolia`);
  console.log(`  Chain ID:          ${baseSepolia.id}`);
  console.log("");
  console.log("  BaseScan:          https://sepolia.basescan.org/address/" + contractAddress);
  console.log("");
  console.log("  Update your .env:");
  console.log(`  POLLPOOL_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("");

  // Update .env file
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    envContent = "";
  }

  const regex = /^POLLPOOL_CONTRACT_ADDRESS=.*/m;
  const newLine = `POLLPOOL_CONTRACT_ADDRESS=${contractAddress}`;

  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, newLine);
  } else {
    envContent = envContent.trim() + "\n" + newLine + "\n";
  }

  fs.writeFileSync(envPath, envContent);
  console.log("  .env file updated automatically!");
  console.log("");

  // Features summary
  console.log("PollPoolV2 Features:");
  console.log("  - AccessControl (role-based permissions)");
  console.log("  - Pausable (emergency stop)");
  console.log("  - Pull-based claims (claimPayout)");
  console.log("  - Batch distribution (distributeBatch)");
  console.log("  - 24hr timelock on admin changes");
  console.log("  - 90-day claim expiry + sweep");
  console.log("  - Contract metadata URI support");
  console.log("");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
