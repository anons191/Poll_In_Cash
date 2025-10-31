import { getContract, type ThirdwebContract } from "thirdweb";
import { client, chain } from "./thirdweb";
import { pollEscrowABI } from "./pollEscrowABI";

/**
 * Get PollEscrow contract instance (client-side)
 */
export function getEscrow(address: string) {
  return getContract({ 
    client, 
    chain, 
    address: address as `0x${string}`, 
    abi: pollEscrowABI as any
  });
}

/**
 * Get PollEscrow contract address from environment
 */
export function getPollEscrowAddress(): string {
  const address = process.env.NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("POLL_ESCROW_CONTRACT_ADDRESS not set in environment variables");
  }
  return address;
}

/**
 * Calculate payout amounts (90% user, 10% platform fee)
 */
export function calcPayout(amount: bigint): { user: bigint; fee: bigint } {
  // 10% platform fee (1000 basis points out of 10000)
  const fee = (amount * 1000n) / 10000n;
  return { user: amount - fee, fee };
}

/**
 * Convert USDC amount (6 decimals) to BigInt
 * Example: 1 USDC = 1000000 (6 decimals)
 */
export function usdcToBigInt(amount: number): bigint {
  return BigInt(Math.floor(amount * 1_000_000));
}

/**
 * Convert BigInt USDC amount to number (6 decimals)
 */
export function bigIntToUsdc(amount: bigint): number {
  return Number(amount) / 1_000_000;
}
