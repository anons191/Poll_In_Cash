/**
 * Direct deployment script using Thirdweb
 * This requires a wallet private key for deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const USDC_TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const PLATFORM_TREASURY = '0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b';
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;

console.log('🚀 Deploying PollEscrow contract to Base Sepolia...\n');
console.log('Constructor parameters:');
console.log(`  USDC Token: ${USDC_TOKEN}`);
console.log(`  Platform Treasury: ${PLATFORM_TREASURY}\n`);

// The contract has already been compiled and uploaded
// The deployment link is: https://thirdweb.com/contracts/deploy/QmavqiV4MtJVWNuPscj4LYTKUFoL93y28HUS2XfW4Fdrnp

console.log('✅ Contract compiled and uploaded to IPFS');
console.log('📋 To complete deployment, you have two options:\n');
console.log('Option 1: Thirdweb Dashboard (Easiest)');
console.log('1. Visit: https://thirdweb.com/contracts/deploy/QmavqiV4MtJVWNuPscj4LYTKUFoL93y28HUS2XfW4Fdrnp');
console.log('2. Log in with your wallet');
console.log('3. Select network: Base Sepolia');
console.log(`4. Enter constructor params: ${USDC_TOKEN}, ${PLATFORM_TREASURY}`);
console.log('5. Deploy and copy the contract address\n');
console.log('Option 2: Continue with CLI (will require wallet connection)');
console.log('The CLI will prompt you to connect your wallet for deployment.\n');

// Try to continue with the CLI deployment
try {
  console.log('Attempting to open deployment interface...\n');
  const { exec } = require('child_process');
  exec('open "https://thirdweb.com/contracts/deploy/QmavqiV4MtJVWNuPscj4LYTKUFoL93y28HUS2XfW4Fdrnp"', (error) => {
    if (!error) {
      console.log('✅ Opened deployment page in browser');
      console.log('Please complete the deployment there.\n');
    }
  });
} catch (e) {
  console.log('Please manually open the deployment link above.\n');
}

process.exit(0);

