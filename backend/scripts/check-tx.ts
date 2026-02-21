import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const TX_HASHES = [
  { name: "Poll 1 Close", hash: "0x2d1eaa3f7743f3dc7f1f9ac8f293459bd0692c79d5365bdc4c53fd84e4cd8d75" },
  { name: "Poll 1 Distribute", hash: "0x3c380414da3a08d3d427097fc8b668f1996a78398ea7234d8dcb5f251220b563" },
  { name: "Poll 3 Close", hash: "0x41547204f881edd4537959b8046dd2aabc02e1dd85f595443af13748f916401c" },
  { name: "Poll 3 Distribute", hash: "0x438d1e274a9b56e2ab73698d81590126567188053235a3ad2d046242238a5d1b" },
];

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  console.log("=".repeat(60));
  console.log("TRANSACTION RECEIPTS");
  console.log("=".repeat(60));

  for (const tx of TX_HASHES) {
    console.log(`\n${tx.name}:`);
    console.log(`  Hash: ${tx.hash}`);
    console.log(`  Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);

    try {
      const receipt = await client.getTransactionReceipt({
        hash: tx.hash as `0x${string}`
      });

      console.log(`  Status: ${receipt.status === "success" ? "✅ SUCCESS" : "❌ FAILED"}`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Block: ${receipt.blockNumber}`);

      if (receipt.logs.length > 0) {
        console.log(`  Event Logs: ${receipt.logs.length}`);
      } else {
        console.log(`  Event Logs: None (no state changes)`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
