"use server";

import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { getContract } from "thirdweb";

/**
 * Server-side Thirdweb Engine client for secure contract writes
 * Uses THIRDWEB_SECRET_KEY - NEVER expose to client
 */
export const engineClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

export const engineChain = baseSepolia;

/**
 * Get contract instance for Engine operations
 */
export function getEngineContract(address: string, abi: any) {
  return getContract({
    client: engineClient,
    chain: engineChain,
    address,
    abi,
  });
}

/**
 * Execute a contract write via Engine (server-side)
 * Handles transaction preparation, sending, and receipt waiting
 * 
 * Note: Engine requires proper account configuration.
 * For MVP, we'll use direct contract calls from user's wallet on client-side.
 * Engine can be used for gasless transactions if configured with paymaster.
 * 
 * This function is a stub - Engine account setup requires additional configuration.
 * For now, use client-side contract writes from user's wallet.
 */
export async function executeEngineTransaction(
  contract: ReturnType<typeof getEngineContract>,
  functionName: string,
  params: any[]
) {
  // TODO: Configure Engine account properly
  // Engine requires account setup - for MVP, use client-side writes
  throw new Error("Engine transactions require account configuration. Use client-side contract writes for MVP.");
  
  // Future implementation:
  // const transaction = prepareContractCall({
  //   contract,
  //   method: functionName,
  //   params,
  // });
  // const { transactionHash } = await sendTransaction({
  //   transaction,
  //   account: ... // Engine account configuration needed
  // });
  // return await waitForReceipt({ chain: engineChain, client: engineClient, transactionHash });
}

