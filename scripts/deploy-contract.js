#!/usr/bin/env node
/**
 * Deploy PollEscrow contract using Thirdweb SDK
 * Usage: node scripts/deploy-contract.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function deployContract() {
  try {
    // Dynamic import for ES modules
    const { createThirdwebClient, getContract, sendTransaction, waitForReceipt } = await import('thirdweb');
    const { baseSepolia } = await import('thirdweb/chains');
    const { readContract } = await import('thirdweb');
    const { privateKeyToAccount } = await import('thirdweb/wallets');

    const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
    if (!SECRET_KEY) {
      console.error('❌ THIRDWEB_SECRET_KEY not found in .env.local');
      process.exit(1);
    }

    const USDC_TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const PLATFORM_TREASURY = '0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b';

    console.log('Deploying PollEscrow contract to Base Sepolia...\n');
    console.log('Constructor parameters:');
    console.log(`  USDC Token: ${USDC_TOKEN}`);
    console.log(`  Platform Treasury: ${PLATFORM_TREASURY}\n`);

    // Create Thirdweb client
    const client = createThirdwebClient({
      secretKey: SECRET_KEY,
    });

    // Read the contract source
    const contractPath = path.join(__dirname, '../contracts/PollEscrow.sol');
    const contractSource = fs.readFileSync(contractPath, 'utf8');

    console.log('⚠️  Programmatic deployment via SDK requires the contract to be compiled first.');
    console.log('📝 For now, please use the Thirdweb Dashboard:');
    console.log('   1. Go to https://thirdweb.com/dashboard');
    console.log('   2. Click "Deploy Contract" → "Upload Contract"');
    console.log('   3. Upload: contracts/PollEscrow.sol');
    console.log('   4. Network: Base Sepolia');
    console.log(`   5. Constructor params: ${USDC_TOKEN}, ${PLATFORM_TREASURY}`);
    console.log('\nOr use the interactive CLI:');
    console.log('   cd contracts');
    console.log('   thirdweb deploy PollEscrow.sol -k YOUR_SECRET_KEY');
    console.log('   (Then select Base Sepolia and enter constructor params when prompted)');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

deployContract();

