import { ethers, network } from "hardhat";

/**
 * Deploy MockUSDC and a new PollPool for testnet testing
 * This allows the "Mint Test USDC" button to work in the frontend
 *
 * Run with: npx hardhat run scripts/deploy-testnet.ts --network baseSepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=== DEPLOYING TEST CONTRACTS ===\n");
  console.log("Network:", network.name);
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("ERROR: Deployer has no ETH. Get some from a faucet first.");
    console.log("Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    process.exit(1);
  }

  // 1. Deploy MockUSDC
  console.log("--- Deploying MockUSDC ---");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", mockUSDCAddress);

  // Mint some USDC to deployer for testing
  const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  await mockUSDC.mint(deployer.address, mintAmount);
  console.log("Minted 10,000 USDC to deployer\n");

  // 2. Deploy PollPool with MockUSDC
  console.log("--- Deploying PollPool ---");
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const attestationSigner = process.env.ATTESTATION_SIGNER || deployer.address;

  console.log("Treasury:", treasuryAddress);
  console.log("Attestation Signer:", attestationSigner);

  const PollPool = await ethers.getContractFactory("PollPool");
  const pollPool = await PollPool.deploy(
    mockUSDCAddress,
    treasuryAddress,
    attestationSigner
  );
  await pollPool.waitForDeployment();
  const pollPoolAddress = await pollPool.getAddress();
  console.log("PollPool deployed to:", pollPoolAddress);

  // Summary
  console.log("\n=== DEPLOYMENT COMPLETE ===\n");
  console.log("Add these to your frontend/.env.local:");
  console.log("-------------------------------------------");
  console.log(`NEXT_PUBLIC_TEST_USDC_ADDRESS=${mockUSDCAddress}`);
  console.log(`NEXT_PUBLIC_POLLPOOL_CONTRACT_ADDRESS=${pollPoolAddress}`);
  console.log("-------------------------------------------");

  console.log("\nVerification commands:");
  console.log(`npx hardhat verify --network ${network.name} ${mockUSDCAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${pollPoolAddress} "${mockUSDCAddress}" "${treasuryAddress}" "${attestationSigner}"`);

  // Also output JSON for easy parsing
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    mockUSDC: mockUSDCAddress,
    pollPool: pollPoolAddress,
    treasury: treasuryAddress,
    attestationSigner: attestationSigner,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  console.log("\nDeployment JSON:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
