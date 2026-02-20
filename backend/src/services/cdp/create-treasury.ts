#!/usr/bin/env npx tsx
/**
 * CLI Script: Create Treasury Wallet
 *
 * This script creates a treasury wallet for the Poll in Cash platform
 * and outputs the address to be stored in environment variables.
 *
 * Usage:
 *   npx tsx backend/src/services/cdp/create-treasury.ts
 *
 * Prerequisites:
 *   - CDP_API_KEY_ID environment variable set
 *   - CDP_API_KEY_SECRET environment variable set
 *   - CDP_WALLET_SECRET environment variable set
 *
 * Output:
 *   The script will print the treasury wallet address and the
 *   environment variable to add to your .env file.
 *
 * @module services/cdp/create-treasury
 */

import "dotenv/config";
import { createTreasuryWallet, isTreasuryConfigured, getTreasuryConfig } from "./treasury.js";
import { SUPPORTED_NETWORKS, type SupportedNetwork } from "../../types/wallet.js";

// ============ CLI Configuration ============

interface CliOptions {
  network: SupportedNetwork;
  force: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let network: SupportedNetwork = SUPPORTED_NETWORKS.BASE_SEPOLIA;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--network" || arg === "-n") {
      const networkArg = args[++i];
      if (networkArg === "mainnet" || networkArg === "base-mainnet") {
        network = SUPPORTED_NETWORKS.BASE_MAINNET;
      } else if (networkArg === "sepolia" || networkArg === "base-sepolia") {
        network = SUPPORTED_NETWORKS.BASE_SEPOLIA;
      } else {
        console.error(`Unknown network: ${networkArg}`);
        console.error("Valid networks: sepolia, mainnet, base-sepolia, base-mainnet");
        process.exit(1);
      }
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { network, force };
}

function printHelp(): void {
  console.log(`
Create Treasury Wallet - Poll in Cash Platform

Usage:
  npx tsx backend/src/services/cdp/create-treasury.ts [options]

Options:
  -n, --network <network>  Network to create treasury on (default: base-sepolia)
                           Valid values: sepolia, mainnet, base-sepolia, base-mainnet
  -f, --force              Force creation even if treasury already exists
  -h, --help               Show this help message

Prerequisites:
  Set the following environment variables before running:
  - CDP_API_KEY_ID        Your CDP API key ID
  - CDP_API_KEY_SECRET    Your CDP API key secret
  - CDP_WALLET_SECRET     Your CDP wallet secret

Examples:
  # Create treasury on Base Sepolia (testnet)
  npx tsx backend/src/services/cdp/create-treasury.ts

  # Create treasury on Base mainnet
  npx tsx backend/src/services/cdp/create-treasury.ts --network mainnet

  # Force re-creation even if already configured
  npx tsx backend/src/services/cdp/create-treasury.ts --force
`);
}

// ============ Main Script ============

async function main(): Promise<void> {
  console.log("");
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║        Poll in Cash - Treasury Wallet Setup        ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");

  // Parse CLI arguments
  const options = parseArgs();

  // Check prerequisites
  const missingEnvVars: string[] = [];
  if (!process.env.CDP_API_KEY_ID) missingEnvVars.push("CDP_API_KEY_ID");
  if (!process.env.CDP_API_KEY_SECRET) missingEnvVars.push("CDP_API_KEY_SECRET");
  if (!process.env.CDP_WALLET_SECRET) missingEnvVars.push("CDP_WALLET_SECRET");

  if (missingEnvVars.length > 0) {
    console.error("ERROR: Missing required environment variables:");
    for (const envVar of missingEnvVars) {
      console.error(`  - ${envVar}`);
    }
    console.error("");
    console.error("Please set these variables and try again.");
    console.error("See: https://docs.cdp.coinbase.com/");
    process.exit(1);
  }

  // Check if treasury already exists
  if (isTreasuryConfigured() && !options.force) {
    console.log("Treasury wallet is already configured.");
    console.log("");

    try {
      const config = getTreasuryConfig();
      console.log("Current Treasury Configuration:");
      console.log(`  Address:  ${config.address}`);
      console.log(`  Network:  ${config.networkId}`);
      console.log(`  Chain ID: ${config.chainId}`);
      console.log(`  USDC:     ${config.usdcAddress}`);
    } catch {
      console.log("  (Unable to load current configuration)");
    }

    console.log("");
    console.log("To create a new treasury wallet, run with --force flag.");
    process.exit(0);
  }

  // Create treasury wallet
  console.log(`Creating treasury wallet on ${options.network}...`);
  console.log("");

  try {
    const result = await createTreasuryWallet(options.network);

    console.log("SUCCESS: Treasury wallet created!");
    console.log("");
    console.log("╔════════════════════════════════════════════════════════════════════╗");
    console.log("║  Treasury Wallet Details                                           ║");
    console.log("╠════════════════════════════════════════════════════════════════════╣");
    console.log(`║  Address:  ${result.address.padEnd(54)}║`);
    console.log(`║  Network:  ${result.networkId.padEnd(54)}║`);
    if (result.name) {
      console.log(`║  Name:     ${result.name.padEnd(54)}║`);
    }
    console.log("╚════════════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Add the following to your .env file:");
    console.log("");
    console.log("  ┌────────────────────────────────────────────────────────────────┐");
    console.log(`  │  ${result.envVar.padEnd(64)}│`);
    console.log("  └────────────────────────────────────────────────────────────────┘");
    console.log("");

    if (options.network === SUPPORTED_NETWORKS.BASE_SEPOLIA) {
      console.log("NEXT STEPS:");
      console.log("  1. Copy the TREASURY_WALLET_ADDRESS line above to your .env file");
      console.log("  2. Fund the treasury with testnet USDC from a faucet:");
      console.log("     https://faucet.circle.com/");
      console.log("  3. Start the backend server: npm run dev");
      console.log("");
    } else {
      console.log("NEXT STEPS:");
      console.log("  1. Copy the TREASURY_WALLET_ADDRESS line above to your .env file");
      console.log("  2. Fund the treasury with USDC");
      console.log("  3. Start the backend server: npm run start");
      console.log("");
      console.log("WARNING: You are using mainnet. Real funds will be involved.");
      console.log("");
    }
  } catch (error) {
    console.error("ERROR: Failed to create treasury wallet");
    console.error("");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error("");
        console.error("Stack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
