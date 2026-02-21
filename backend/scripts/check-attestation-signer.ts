import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const POLLPOOL_ADDRESS = "0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a" as `0x${string}`;

const ABI = [
  {
    name: "attestationSigner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "treasury",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const attestationSigner = await client.readContract({
    address: POLLPOOL_ADDRESS,
    abi: ABI,
    functionName: "attestationSigner",
  });

  const treasury = await client.readContract({
    address: POLLPOOL_ADDRESS,
    abi: ABI,
    functionName: "treasury",
  });

  const owner = await client.readContract({
    address: POLLPOOL_ADDRESS,
    abi: ABI,
    functionName: "owner",
  });

  console.log("PollPool Contract State:");
  console.log(`  Owner: ${owner}`);
  console.log(`  Treasury: ${treasury}`);
  console.log(`  Attestation Signer: ${attestationSigner}`);
}

main().catch(console.error);
