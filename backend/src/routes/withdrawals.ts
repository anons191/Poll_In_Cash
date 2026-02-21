import { Hono } from "hono";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { db } from "../db/index.js";
import { withdrawals, type NewWithdrawal } from "../db/schema.js";
import { requireAuth, getUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const withdrawalsRouter = new Hono<AppEnv>();

// ============ Configuration ============

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const BRIDGE_WALLET = process.env.BRIDGE_WALLET_ADDRESS || "0x495721378c27a51a2bd7f176bad570d5148c88d5";
const MIN_WITHDRAWAL = 0.5; // 0.50 USDC minimum

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============ Helpers ============

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
}

async function getAgentWalletClient(agentPrivateKey: string) {
  const account = privateKeyToAccount(agentPrivateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
}

async function getUsdcBalance(walletAddress: string): Promise<string> {
  const client = getPublicClient();
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  });
  return formatUnits(balance, 6);
}

// ============ Validation Schemas ============

const withdrawRequestSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= MIN_WITHDRAWAL;
    },
    { message: `Minimum withdrawal is ${MIN_WITHDRAWAL} USDC` }
  ),
  destinationAddress: z.string().refine(
    (val) => isAddress(val),
    { message: "Invalid destination address" }
  ),
  destinationType: z.enum(["wallet", "cashapp", "venmo", "bank"]),
  destinationHandle: z.string().optional(), // e.g., $cashtag, @venmo
});

// ============ Routes ============

/**
 * GET /agent/withdraw/balance
 * Returns current USDC balance of the agent wallet
 */
withdrawalsRouter.get("/balance", requireAuth, async (c) => {
  const user = getUser(c);

  try {
    const balance = await getUsdcBalance(user.walletAddress);

    return c.json({
      walletAddress: user.walletAddress,
      balance,
      currency: "USDC",
      network: "base-sepolia",
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    return c.json({ error: "Failed to fetch balance" }, 500);
  }
});

/**
 * POST /agent/withdraw
 * Request a withdrawal from agent wallet
 */
withdrawalsRouter.post("/", requireAuth, async (c) => {
  const user = getUser(c);
  const body = await c.req.json();

  // Validate request
  const parseResult = withdrawRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: "Invalid request", details: parseResult.error.issues },
      400
    );
  }

  const { amount, destinationAddress, destinationType, destinationHandle } =
    parseResult.data;
  const amountNum = parseFloat(amount);

  // Check balance
  const currentBalance = await getUsdcBalance(user.walletAddress);
  const balanceNum = parseFloat(currentBalance);

  if (balanceNum < amountNum) {
    return c.json(
      {
        error: "Insufficient balance",
        requested: amount,
        available: currentBalance,
      },
      400
    );
  }

  // Determine actual destination
  // For non-wallet destinations, send to bridge wallet
  const actualDestination =
    destinationType === "wallet" ? destinationAddress : BRIDGE_WALLET;

  // Get agent private key from environment
  // In production, this would be securely managed per-user
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY;
  if (!agentPrivateKey) {
    return c.json({ error: "Agent wallet not configured" }, 500);
  }

  // Verify the agent wallet matches the authenticated user
  const agentAccount = privateKeyToAccount(agentPrivateKey as `0x${string}`);
  if (agentAccount.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
    return c.json({ error: "Wallet mismatch - not authorized" }, 403);
  }

  // Create withdrawal record
  const [withdrawal] = await db
    .insert(withdrawals)
    .values({
      agentWallet: user.walletAddress.toLowerCase(),
      destinationType,
      destinationAddress: actualDestination.toLowerCase(),
      destinationHandle,
      amountUsdc: amount,
      feeUsdc: "0", // No fees on Base
      status: "processing",
    } as NewWithdrawal)
    .returning();

  try {
    // Execute transfer on-chain
    const walletClient = await getAgentWalletClient(agentPrivateKey);
    const publicClient = getPublicClient();

    const amountWei = parseUnits(amount, 6);

    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [actualDestination as `0x${string}`, amountWei],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      // Update withdrawal record
      await db
        .update(withdrawals)
        .set({
          txHash,
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(withdrawals.id, withdrawal.id));

      // Get new balance
      const newBalance = await getUsdcBalance(user.walletAddress);

      return c.json({
        success: true,
        withdrawal: {
          id: withdrawal.id,
          amount,
          destinationType,
          destinationAddress: actualDestination,
          destinationHandle,
          txHash,
          status: "completed",
          fee: "0",
        },
        previousBalance: currentBalance,
        newBalance,
        explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      });
    } else {
      // Transaction failed
      await db
        .update(withdrawals)
        .set({
          txHash,
          status: "failed",
          errorMessage: "Transaction reverted",
        })
        .where(eq(withdrawals.id, withdrawal.id));

      return c.json(
        { error: "Transaction failed", txHash },
        500
      );
    }
  } catch (error) {
    console.error("Withdrawal error:", error);

    // Update withdrawal record with error
    await db
      .update(withdrawals)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(withdrawals.id, withdrawal.id));

    return c.json(
      {
        error: "Withdrawal failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * GET /agent/withdraw/history
 * Returns list of past withdrawals
 */
withdrawalsRouter.get("/history", requireAuth, async (c) => {
  const user = getUser(c);

  const userWithdrawals = await db.query.withdrawals.findMany({
    where: eq(withdrawals.agentWallet, user.walletAddress.toLowerCase()),
    orderBy: desc(withdrawals.requestedAt),
    limit: 50,
  });

  return c.json({
    withdrawals: userWithdrawals.map((w) => ({
      id: w.id,
      amount: w.amountUsdc,
      fee: w.feeUsdc,
      destinationType: w.destinationType,
      destinationAddress: w.destinationAddress,
      destinationHandle: w.destinationHandle,
      status: w.status,
      txHash: w.txHash,
      errorMessage: w.errorMessage,
      requestedAt: w.requestedAt.toISOString(),
      completedAt: w.completedAt?.toISOString() || null,
      explorerUrl: w.txHash
        ? `https://sepolia.basescan.org/tx/${w.txHash}`
        : null,
    })),
  });
});

export default withdrawalsRouter;
