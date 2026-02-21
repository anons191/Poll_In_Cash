import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RESPONDENT_WALLET = "0x9df3281fe4403f60c99da183eff960458cd251b2";

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  console.log("=".repeat(60));
  console.log("ON-CHAIN TRANSACTION SUMMARY");
  console.log("=".repeat(60));

  console.log("\n📋 POLL 1 (Veterans in Nevada)");
  console.log("  Close TX: https://sepolia.basescan.org/tx/0x2d1eaa3f7743f3dc7f1f9ac8f293459bd0692c79d5365bdc4c53fd84e4cd8d75");
  console.log("  Distribute TX: https://sepolia.basescan.org/tx/0x3c380414da3a08d3d427097fc8b668f1996a78398ea7234d8dcb5f251220b563");

  console.log("\n📋 POLL 3 (Las Vegas Food Service)");
  console.log("  Close TX: https://sepolia.basescan.org/tx/0x41547204f881edd4537959b8046dd2aabc02e1dd85f595443af13748f916401c");
  console.log("  Distribute TX: https://sepolia.basescan.org/tx/0x438d1e274a9b56e2ab73698d81590126567188053235a3ad2d046242238a5d1b");

  console.log("\n" + "=".repeat(60));
  console.log("USDC WALLET BALANCE");
  console.log("=".repeat(60));

  console.log(`\nRespondent Wallet: ${RESPONDENT_WALLET}`);

  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [RESPONDENT_WALLET as `0x${string}`],
  });

  const balanceFormatted = formatUnits(balance, 6);
  console.log(`USDC Balance: ${balanceFormatted} USDC`);

  // Calculate expected earnings
  // Poll 1: 5 USDC pool, 1 participant, 90% to participants = 4.5 USDC
  // Poll 3: 5 USDC pool, 1 participant, 90% to participants = 4.5 USDC
  console.log(`\nExpected from Poll 1: ~4.50 USDC (90% of 5 USDC pool)`);
  console.log(`Expected from Poll 3: ~4.50 USDC (90% of 5 USDC pool)`);
  console.log(`\nNote: Previous balance was 4.5 USDC`);
  console.log(`Expected new balance: ~13.5 USDC`);

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
