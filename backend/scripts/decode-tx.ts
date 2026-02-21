import { createPublicClient, http, decodeEventLog, decodeFunctionData, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const TX_HASH = "0x2d1eaa3f7743f3dc7f1f9ac8f293459bd0692c79d5365bdc4c53fd84e4cd8d75";

// PollPool events and functions
const POLLPOOL_ABI = parseAbi([
  "function closePoll(uint256 _pollId)",
  "function distribute(uint256 _pollId)",
  "event PollClosed(uint256 indexed pollId, uint256 participantCount)",
  "event FundsDistributed(uint256 indexed pollId, uint256 totalDistributed, uint256 participantCount, uint256 returnedToCreator)",
]);

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  console.log("=".repeat(60));
  console.log("TRANSACTION DECODE");
  console.log("=".repeat(60));

  // Get transaction
  const tx = await client.getTransaction({ hash: TX_HASH as `0x${string}` });

  console.log("\nTransaction Input:");
  try {
    const decoded = decodeFunctionData({
      abi: POLLPOOL_ABI,
      data: tx.input,
    });
    console.log(`  Function: ${decoded.functionName}`);
    console.log(`  Args: ${JSON.stringify(decoded.args)}`);
    console.log(`  Poll ID passed: ${decoded.args[0].toString()}`);
  } catch (e: any) {
    console.log(`  Error decoding: ${e.message}`);
  }

  // Get receipt with logs
  const receipt = await client.getTransactionReceipt({ hash: TX_HASH as `0x${string}` });

  console.log("\nEvent Logs:");
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLLPOOL_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log(`  Event: ${decoded.eventName}`);
      console.log(`  Args: ${JSON.stringify(decoded.args, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v)}`);
    } catch (e) {
      console.log(`  Raw log topic: ${log.topics[0]?.slice(0, 20)}...`);
    }
  }

  // Now check distribute tx
  console.log("\n" + "=".repeat(60));
  console.log("DISTRIBUTE TRANSACTION");
  console.log("=".repeat(60));

  const distTxHash = "0x3c380414da3a08d3d427097fc8b668f1996a78398ea7234d8dcb5f251220b563";
  const distTx = await client.getTransaction({ hash: distTxHash as `0x${string}` });
  const distReceipt = await client.getTransactionReceipt({ hash: distTxHash as `0x${string}` });

  console.log("\nTransaction Input:");
  try {
    const decoded = decodeFunctionData({
      abi: POLLPOOL_ABI,
      data: distTx.input,
    });
    console.log(`  Function: ${decoded.functionName}`);
    console.log(`  Poll ID passed: ${decoded.args[0].toString()}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  console.log("\nEvent Logs:");
  for (const log of distReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: POLLPOOL_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log(`  Event: ${decoded.eventName}`);
      console.log(`  Args: ${JSON.stringify(decoded.args, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v)}`);
    } catch (e) {
      // Try USDC Transfer event
      const transferAbi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
      try {
        const decoded = decodeEventLog({
          abi: transferAbi,
          data: log.data,
          topics: log.topics,
        });
        console.log(`  Event: Transfer (USDC)`);
        console.log(`  From: ${decoded.args.from}`);
        console.log(`  To: ${decoded.args.to}`);
        console.log(`  Amount: ${Number(decoded.args.value) / 1e6} USDC`);
      } catch (e2) {
        console.log(`  Unknown event`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
