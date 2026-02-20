import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying PollPool contract...");
  console.log("Network:", network.name);
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  // USDC addresses
  const USDC_ADDRESSES: { [key: string]: string } = {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC (Circle's testnet USDC)
    hardhat: "", // Will deploy mock for testing
    localhost: "", // Will deploy mock for testing
  };

  let usdcAddress = USDC_ADDRESSES[network.name];

  // Deploy mock USDC for local testing
  if (!usdcAddress) {
    console.log("Deploying MockUSDC for local testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);
  }

  // Get treasury and attestation signer from environment
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const attestationSigner = process.env.ATTESTATION_SIGNER || deployer.address;

  console.log("\nDeployment parameters:");
  console.log("  USDC address:", usdcAddress);
  console.log("  Treasury address:", treasuryAddress);
  console.log("  Attestation signer:", attestationSigner);

  // Deploy PollPool
  const PollPool = await ethers.getContractFactory("PollPool");
  const pollPool = await PollPool.deploy(
    usdcAddress,
    treasuryAddress,
    attestationSigner
  );

  await pollPool.waitForDeployment();
  const pollPoolAddress = await pollPool.getAddress();

  console.log("\n✅ PollPool deployed to:", pollPoolAddress);
  console.log("\nVerification command:");
  console.log(`npx hardhat verify --network ${network.name} ${pollPoolAddress} "${usdcAddress}" "${treasuryAddress}" "${attestationSigner}"`);

  // Write deployment info to file
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    pollPool: pollPoolAddress,
    usdc: usdcAddress,
    treasury: treasuryAddress,
    attestationSigner: attestationSigner,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  console.log("\nDeployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
