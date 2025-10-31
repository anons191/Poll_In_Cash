import { getContract, type ThirdwebContract } from "thirdweb";
import { client, chain } from "./thirdweb";

export function getEscrow(address: string, abi: any): ThirdwebContract {
  return getContract({ client, chain, address, abi });
}

export function calcPayout(amount: bigint): { user: bigint; fee: bigint } {
  // 10% platform fee
  const fee = (amount * 10n) / 100n;
  return { user: amount - fee, fee };
}
