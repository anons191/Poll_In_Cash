import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const POLLPOOL_ADDRESS = "0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a" as `0x${string}`;

const ABI = [
  {
    name: "nextPollId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const nextId = await client.readContract({
    address: POLLPOOL_ADDRESS,
    abi: ABI,
    functionName: "nextPollId",
  });

  console.log(`Next Poll ID: ${nextId}`);
  console.log(`\nThis means polls 0 to ${Number(nextId) - 1} exist on-chain (if any)`);

  // Let's check if poll 0, 1, 2 exist
  const POLL_ABI = [{
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
  }] as const;

  console.log("\nChecking existing polls:");
  for (let i = 0; i < Math.min(Number(nextId), 5); i++) {
    try {
      const poll = await client.readContract({
        address: POLLPOOL_ADDRESS,
        abi: POLL_ABI,
        functionName: "getPoll",
        args: [BigInt(i)]
      });
      if (poll.creator !== "0x0000000000000000000000000000000000000000") {
        console.log(`\nPoll ${i}: ${poll.title}`);
        console.log(`  Creator: ${poll.creator}`);
        console.log(`  Status: ${["Active", "Closed", "Distributed", "Cancelled"][poll.status]}`);
      }
    } catch (e) {
      // skip
    }
  }
}

main().catch(console.error);
