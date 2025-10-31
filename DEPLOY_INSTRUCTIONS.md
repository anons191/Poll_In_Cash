# PollEscrow Contract Deployment - Quick Guide

## ✅ Contract is Ready!
The contract compiled successfully. Now we need to deploy it via Thirdweb Dashboard.

## Deployment Steps (5 minutes)

### Option 1: Thirdweb Dashboard (Recommended - Easiest)

1. **Go to Thirdweb Dashboard:**
   - Visit: https://thirdweb.com/dashboard
   - Sign in with your account

2. **Deploy New Contract:**
   - Click "Deploy Contract" or "Contracts" → "New Contract"
   - Select "Upload Contract"
   - Upload `contracts/PollEscrow.sol`

3. **Configure Deployment:**
   - Network: **Base Sepolia**
   - Constructor Parameters:
     ```
     _usdcToken: 0x081827b8C3Aa05287b5aA2bC3051fbE638F33152
     _platformTreasury: 0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b
     ```

4. **Deploy:**
   - Review and confirm
   - Wait for deployment (~30 seconds)
   - Copy the contract address

5. **Update Environment:**
   ```bash
   # Add to .env.local:
   NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
   POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
   ```

### Option 2: Use Remix IDE (Alternative)

1. Go to https://remix.ethereum.org
2. Create new file: `PollEscrow.sol`
3. Paste contract code
4. Compile (Solidity 0.8.20)
5. Deploy via Injected Provider (MetaMask connected to Base Sepolia)
6. Enter constructor parameters
7. Deploy and copy address

## After Deployment

1. **Verify Contract (Optional):**
   - Visit: https://sepolia.basescan.org
   - Search contract address
   - Verify and publish source code

2. **Test Contract:**
   - Use Thirdweb dashboard to interact with contract
   - Or use our app once address is added to `.env.local`

3. **Set Up Insight Webhooks (Later):**
   - In Thirdweb Dashboard → Insight
   - Register webhook URL pointing to your Firebase Function

## Contract Address Storage

After deployment, the contract address will be stored in:
- `.env.local` (local development)
- Vercel environment variables (production)

## Quick Test

Once deployed, you can test:
```bash
# Check contract is deployed
# Use Thirdweb dashboard to call getPollCounter() - should return 0
```

