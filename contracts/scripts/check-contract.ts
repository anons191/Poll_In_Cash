import { ethers, network } from "hardhat";

async function main() {
  const address = process.env.CONTRACT_ADDRESS || "0x85EB12A68246B4bBe63CE4b75F2796bf37D7CEA4";

  console.log(`Network: ${network.name}`);
  console.log(`Checking contract at: ${address}`);

  const code = await ethers.provider.getCode(address);

  if (code === "0x") {
    console.log("No contract code found at this address");
  } else {
    console.log(`Contract code found! Length: ${code.length} bytes`);
    console.log(`Code starts with: ${code.slice(0, 66)}...`);
  }
}

main().catch(console.error);
