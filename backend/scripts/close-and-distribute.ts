#!/usr/bin/env npx tsx
/**
 * Script to close a poll and distribute funds
 * Must be run by the poll creator's wallet
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const POLL_ID = process.argv[2] || "dd7068db-a70a-41a7-a61b-74c592d8bbbe";

async function authenticate(wallet: ethers.Wallet): Promise<string> {
  const walletAddress = wallet.address;

  // Get nonce
  const nonceRes = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const { nonce, message } = await nonceRes.json();

  // Sign and verify
  const signature = await wallet.signMessage(message);
  const verifyRes = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, signature, nonce }),
  });
  const { token } = await verifyRes.json();

  return token;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Poll Close & Distribute");
  console.log("=".repeat(60));
  console.log();

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Poll ID: ${POLL_ID}`);
  console.log();

  // Authenticate
  console.log("[1] Authenticating...");
  const token = await authenticate(wallet);
  console.log("    Authenticated!");
  console.log();

  // Get poll details
  console.log("[2] Getting poll details...");
  const pollRes = await fetch(`${API_BASE_URL}/polls/${POLL_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!pollRes.ok) {
    const error = await pollRes.text();
    console.log(`    ERROR: ${error}`);
    return;
  }

  const poll = await pollRes.json();
  console.log(`    Title: ${poll.title}`);
  console.log(`    Status: ${poll.status}`);
  console.log(`    Contract ID: ${poll.contractPollId}`);
  console.log(`    Responses: ${poll.responseCount}`);
  console.log(`    Is Owner: ${poll.isOwner}`);
  console.log();

  if (!poll.isOwner) {
    console.log("ERROR: You are not the owner of this poll!");
    console.log("Only the poll creator can close and distribute funds.");
    return;
  }

  // Close poll
  if (poll.status === "active") {
    console.log("[3] Closing poll...");
    const closeRes = await fetch(`${API_BASE_URL}/polls/${POLL_ID}/close`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!closeRes.ok) {
      const error = await closeRes.text();
      console.log(`    ERROR: ${error}`);
      return;
    }

    const closeResult = await closeRes.json();
    console.log(`    Status: ${closeResult.status}`);
    console.log(`    TX Hash: ${closeResult.txHash || "N/A"}`);
    console.log();
  } else if (poll.status !== "closed") {
    console.log(`[3] Poll status is ${poll.status}, cannot close.`);
    return;
  } else {
    console.log("[3] Poll already closed.");
    console.log();
  }

  // Distribute funds
  console.log("[4] Distributing funds...");
  const distributeRes = await fetch(`${API_BASE_URL}/polls/${POLL_ID}/distribute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!distributeRes.ok) {
    const error = await distributeRes.text();
    console.log(`    ERROR: ${error}`);
    return;
  }

  const distributeResult = await distributeRes.json();
  console.log(`    Status: ${distributeResult.status}`);
  console.log(`    TX Hash: ${distributeResult.txHash}`);
  console.log(`    Message: ${distributeResult.message}`);
  console.log();

  console.log("=".repeat(60));
  console.log("  Distribution Complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);
