# Deploy PollEscrow Contract - Updated with Correct USDC Address

## Quick Deployment via Thirdweb Dashboard

### Step 1: Go to Thirdweb Dashboard
Visit: https://thirdweb.com/dashboard

### Step 2: Deploy Contract
1. Click **"Deploy Contract"** or go to **"Contracts"** → **"New Contract"**
2. Select **"Upload Contract"**
3. Upload the file: `contracts/PollEscrow.sol`

### Step 3: Configure Deployment
- **Network:** Select **Base Sepolia** (testnet)
- **Constructor Parameters:**
  ```
  _usdcToken: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  _platformTreasury: 0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b
  ```

### Step 4: Deploy
- Review and confirm
- Wait for deployment (~30 seconds)
- **Copy the deployed contract address**

### Step 5: Update Environment Variables

Once you have the new contract address, run:

```bash
# Add the new contract address to .env.local
echo "" >> .env.local
echo "NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS=<NEW_CONTRACT_ADDRESS>" >> .env.local
echo "POLL_ESCROW_CONTRACT_ADDRESS=<NEW_CONTRACT_ADDRESS>" >> .env.local
```

**Replace `<NEW_CONTRACT_ADDRESS>` with the actual deployed address!**

### Important Notes:
- ✅ **USDC Token Address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (CORRECT)
- ✅ **Platform Treasury:** `0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b`
- ✅ **Network:** Base Sepolia testnet
- ⚠️ **Make sure to use the CORRECT USDC address** - this is the updated one!

After deployment, your frontend will automatically detect the new contract and the USDC address mismatch error should be resolved.

