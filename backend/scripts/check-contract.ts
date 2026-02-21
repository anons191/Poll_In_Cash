import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const POLLPOOL_ADDRESS = process.env.POLLPOOL_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RESPONDENT_WALLET = "0x9df3281fe4403f60c99da183eff960458cd251b2";
const CREATOR_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const POLL_ABI = [
  {
    name: "getPoll",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [{
      components: [
        { name: "creator", type: "address" },
        { name: "title", type: "string" },
        { name: "criteriaHash", type: "bytes32" },
        { name: "totalFunded", type: "uint256" },
        { name: "distributablePool", type: "uint256" },
        { name: "participantCap", type: "uint256" },
        { name: "participantCount", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "status", type: "uint8" }
      ],
      name: "poll",
      type: "tuple"
    }]
  },
  {
    name: "getParticipants",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pollId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }]
  }
] as const;

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

const statusMap = ["Active", "Closed", "Distributed", "Cancelled"];

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  console.log("=".repeat(60));
  console.log("ON-CHAIN CONTRACT STATE");
  console.log("=".repeat(60));
  console.log(`\nPollPool Contract: ${POLLPOOL_ADDRESS}`);

  // Check poll 1001
  console.log("\n📋 POLL 1001 (Veterans in Nevada):");
  try {
    const poll1 = await client.readContract({
      address: POLLPOOL_ADDRESS,
      abi: POLL_ABI,
      functionName: "getPoll",
      args: [1001n]
    });
    console.log(`  Status: ${statusMap[poll1.status]}`);
    console.log(`  Creator: ${poll1.creator}`);
    console.log(`  Total Funded: ${formatUnits(poll1.totalFunded, 6)} USDC`);
    console.log(`  Distributable Pool: ${formatUnits(poll1.distributablePool, 6)} USDC`);
    console.log(`  Participants: ${poll1.participantCount.toString()}/${poll1.participantCap.toString()}`);
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Check poll 1003
  console.log("\n📋 POLL 1003 (Las Vegas Food Service):");
  try {
    const poll3 = await client.readContract({
      address: POLLPOOL_ADDRESS,
      abi: POLL_ABI,
      functionName: "getPoll",
      args: [1003n]
    });
    console.log(`  Status: ${statusMap[poll3.status]}`);
    console.log(`  Creator: ${poll3.creator}`);
    console.log(`  Total Funded: ${formatUnits(poll3.totalFunded, 6)} USDC`);
    console.log(`  Distributable Pool: ${formatUnits(poll3.distributablePool, 6)} USDC`);
    console.log(`  Participants: ${poll3.participantCount.toString()}/${poll3.participantCap.toString()}`);
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Check USDC balances
  console.log("\n💰 USDC BALANCES:");

  const respondentBalance = await client.readContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [RESPONDENT_WALLET as `0x${string}`]
  });
  console.log(`  Respondent (${RESPONDENT_WALLET.slice(0,10)}...): ${formatUnits(respondentBalance, 6)} USDC`);

  const creatorBalance = await client.readContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [CREATOR_WALLET as `0x${string}`]
  });
  console.log(`  Creator (${CREATOR_WALLET.slice(0,10)}...): ${formatUnits(creatorBalance, 6)} USDC`);

  const contractBalance = await client.readContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [POLLPOOL_ADDRESS]
  });
  console.log(`  Contract (${POLLPOOL_ADDRESS.slice(0,10)}...): ${formatUnits(contractBalance, 6)} USDC`);

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
