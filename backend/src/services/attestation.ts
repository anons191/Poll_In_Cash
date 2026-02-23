/**
 * Attestation signing service for PollPool responses
 *
 * Creates cryptographic attestations that prove a participant is eligible
 * to respond to a poll. The attestation is verified on-chain by the contract.
 */

import { Wallet, keccak256, solidityPacked, getBytes } from "ethers";
import { POLLPOOL_ADDRESS } from "../config/chain.js";

/**
 * Get the attestation signer wallet from environment
 * This wallet must match the attestationSigner address in the deployed contract
 */
function getAttestationSigner(): Wallet {
  const privateKey = process.env.ATTESTATION_SIGNER_KEY;
  if (!privateKey) {
    throw new Error(
      "ATTESTATION_SIGNER_KEY environment variable is required. " +
      "This must be the private key corresponding to the attestationSigner address in the contract."
    );
  }
  return new Wallet(privateKey);
}

/**
 * Create an attestation signature for a poll response
 *
 * The signature proves that the attestation signer (trusted backend)
 * has verified the participant is eligible for this poll.
 *
 * @param pollId - The on-chain poll ID (contract poll ID, not database ID)
 * @param participantAddress - The wallet address of the participant
 * @returns The attestation signature as a hex string
 */
export async function createAttestationSignature(
  pollId: bigint,
  participantAddress: string
): Promise<`0x${string}`> {
  const signer = getAttestationSigner();

  // Create the message hash that the contract expects
  // keccak256(abi.encodePacked(pollId, participant, contractAddress))
  const messageHash = keccak256(
    solidityPacked(
      ["uint256", "address", "address"],
      [pollId, participantAddress, POLLPOOL_ADDRESS]
    )
  );

  // Sign the message using EIP-191 personal sign (which adds the Ethereum prefix)
  // This matches what the contract expects via ECDSA.recover + toEthSignedMessageHash
  const signature = await signer.signMessage(getBytes(messageHash));

  return signature as `0x${string}`;
}

/**
 * Get the attestation signer's address
 * Useful for verifying the contract is configured with the correct signer
 */
export function getAttestationSignerAddress(): string {
  const signer = getAttestationSigner();
  return signer.address;
}
