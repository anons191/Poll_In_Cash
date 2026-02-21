import { ethers } from "ethers";
import { writeFileSync } from "fs";

// Use a deterministic test wallet
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat account #0
const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);

async function auth() {
  const address = wallet.address;
  console.log("Wallet address:", address);
  
  // Get nonce
  const nonceRes = await fetch("http://localhost:3001/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: address })
  });
  const nonceData = await nonceRes.json() as { nonce: string; message: string };
  console.log("Nonce:", nonceData.nonce);
  
  // Sign the message
  const signature = await wallet.signMessage(nonceData.message);
  console.log("Signature:", signature.slice(0, 50) + "...");
  
  // Verify
  const verifyRes = await fetch("http://localhost:3001/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: address,
      signature,
      nonce: nonceData.nonce
    })
  });
  const verifyData = await verifyRes.json() as { token: string };
  console.log("Token:", verifyData.token?.slice(0, 50) + "...");
  
  // Save token
  writeFileSync("/tmp/pollincash_token.txt", verifyData.token);
  writeFileSync("/tmp/pollincash_wallet.txt", address);
  console.log("Token saved to /tmp/pollincash_token.txt");
}

auth().catch(console.error);
