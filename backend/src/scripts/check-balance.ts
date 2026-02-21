import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RESPONDENT_WALLET = "0x9df3281fe4403f60c99da183eff960458cd251b2";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

async function checkBalance() {
  console.log("=== WALLET BALANCE (BEFORE DISTRIBUTION) ===\n");
  console.log("Respondent Wallet:", RESPONDENT_WALLET);
  
  // Get ETH balance
  const ethBalance = await client.getBalance({ address: RESPONDENT_WALLET as `0x${string}` });
  console.log("ETH Balance:", formatUnits(ethBalance, 18), "ETH");
  
  // Get USDC balance
  const usdcBalance = await client.readContract({
    address: USDC_ADDRESS,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [RESPONDENT_WALLET],
  });
  
  console.log("USDC Balance:", formatUnits(usdcBalance as bigint, 6), "USDC");
  console.log("");
}

checkBalance().catch(console.error).finally(() => process.exit(0));
