import { ethers, network } from "hardhat";

/**
 * Deploy PollPoolV2 with claim-based payout model for testnet testing
 *
 * This script deploys:
 * 1. MockUSDC (if not using existing)
 * 2. PollPoolV2 with new claim-based model
 *
 * Run with: npx hardhat run scripts/deploy-v2-testnet.ts --network baseSepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=== DEPLOYING POLLPOOL V2 (CLAIM MODEL) ===\n");
  console.log("Network:", network.name);
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("ERROR: Deployer has no ETH. Get some from a faucet first.");
    console.log("Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    process.exit(1);
  }

  // Check if we should use existing USDC or deploy new MockUSDC
  let usdcAddress = process.env.USDC_ADDRESS;

  if (!usdcAddress) {
    // 1. Deploy MockUSDC
    console.log("--- Deploying MockUSDC ---");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);

    // Mint some USDC to deployer for testing
    const mintAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
    await mockUSDC.mint(deployer.address, mintAmount);
    console.log("Minted 100,000 USDC to deployer\n");
  } else {
    console.log("Using existing USDC at:", usdcAddress, "\n");
  }

  // 2. Deploy PollPoolV2
  console.log("--- Deploying PollPoolV2 ---");
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const attestationSigner = process.env.ATTESTATION_SIGNER || deployer.address;

  console.log("Treasury:", treasuryAddress);
  console.log("Attestation Signer:", attestationSigner);

  const PollPoolV2 = await ethers.getContractFactory("PollPoolV2");
  const pollPoolV2 = await PollPoolV2.deploy(
    usdcAddress,
    treasuryAddress,
    attestationSigner
  );
  await pollPoolV2.waitForDeployment();
  const pollPoolV2Address = await pollPoolV2.getAddress();
  console.log("PollPoolV2 deployed to:", pollPoolV2Address);

  // Verify roles
  const DEFAULT_ADMIN_ROLE = await pollPoolV2.DEFAULT_ADMIN_ROLE();
  const PAUSER_ROLE = await pollPoolV2.PAUSER_ROLE();
  const SWEEPER_ROLE = await pollPoolV2.SWEEPER_ROLE();

  console.log("\nRoles assigned to deployer:");
  console.log("  DEFAULT_ADMIN_ROLE:", await pollPoolV2.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("  PAUSER_ROLE:", await pollPoolV2.hasRole(PAUSER_ROLE, deployer.address));
  console.log("  SWEEPER_ROLE:", await pollPoolV2.hasRole(SWEEPER_ROLE, deployer.address));

  // Summary
  console.log("\n=== DEPLOYMENT COMPLETE ===\n");
  console.log("Environment variables to update:");
  console.log("-------------------------------------------");
  console.log(`# Base Sepolia (Testnet)`);
  console.log(`USDC_ADDRESS=${usdcAddress}`);
  console.log(`POLLPOOL_V2_CONTRACT_ADDRESS=${pollPoolV2Address}`);
  console.log(`TREASURY_ADDRESS=${treasuryAddress}`);
  console.log(`ATTESTATION_SIGNER=${attestationSigner}`);
  console.log("-------------------------------------------");

  console.log("\nVerification commands:");
  console.log(`npx hardhat verify --network ${network.name} ${pollPoolV2Address} "${usdcAddress}" "${treasuryAddress}" "${attestationSigner}"`);

  // Output JSON for easy parsing
  const deploymentInfo = {
    contract: "PollPoolV2",
    version: "2.0.0",
    features: ["claim-based payouts", "90-day claim window", "sweep unclaimed"],
    network: network.name,
    chainId: network.config.chainId,
    addresses: {
      pollPoolV2: pollPoolV2Address,
      usdc: usdcAddress,
      treasury: treasuryAddress,
      attestationSigner: attestationSigner,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  console.log("\nDeployment JSON:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n=== NEW POLL LIFECYCLE ===");
  console.log("1. Creator creates poll with USDC funding (pays gas)");
  console.log("2. Agents submit responses with attestation (pay gas)");
  console.log("3. Creator closes poll (pays gas)");
  console.log("4. Creator finalizes payouts (pays gas) - calculates per-person amount");
  console.log("5. Agents claim their payout (pay gas) - 90 day window");
  console.log("6. After 90 days, treasury can sweep unclaimed funds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
