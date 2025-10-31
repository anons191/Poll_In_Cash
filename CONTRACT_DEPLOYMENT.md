# PollEscrow Contract Deployment Guide

## Overview

The PollEscrow contract is ready to deploy. It manages USDC escrow and payouts with a 10% platform fee.

## Deployment Steps

### Option 1: Thirdweb Dashboard (Recommended)

1. **Go to Thirdweb Dashboard:**
   - Visit: https://thirdweb.com/dashboard
   - Create a new contract project or select existing one

2. **Deploy Contract:**
   - Upload `contracts/PollEscrow.sol`
   - Select network: **Base Sepolia** (testnet)
   - Enter constructor parameters:
     - `_usdcToken`: `0x081827b8C3Aa05287b5aA2bC3051fbE638F33152`
     - `_platformTreasury`: `0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b`

3. **Get Contract Address:**
   - After deployment, copy the contract address
   - Update `.env.local`:
     ```bash
     NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
     POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
     ```

### Option 2: Thirdweb CLI

```bash
# Install Thirdweb CLI globally (if not installed)
npm install -g thirdweb

# Deploy contract
cd contracts
thirdweb deploy PollEscrow.sol

# Follow prompts:
# - Select network: Base Sepolia
# - Enter constructor params when prompted
```

## Contract Details

**Constructor Parameters:**
- `_usdcToken`: USDC token address on Base Sepolia
- `_platformTreasury`: Address to receive 10% platform fees

**Key Functions:**
- `createPoll(uint256 _rewardPool, uint256 _rewardPerUser, uint256 _maxCompletions)`: Creates poll and escrows USDC
- `completePoll(uint256 _pollId, bytes32 _nullifierHash)`: Completes poll and executes payout
- `getPollInfo(uint256 _pollId)`: Returns poll details
- `isNullifierHashUsed(uint256 _pollId, bytes32 _nullifierHash)`: Checks if nullifier already used

**Events:**
- `PollCreated(uint256 pollId, address creator, uint256 rewardPool, uint256 rewardPerUser, uint256 maxCompletions)`
- `PollCompleted(uint256 pollId, address participant, uint256 userPayout, uint256 platformFee, bytes32 nullifierHash)`
- `PollClosed(uint256 pollId)`

## Post-Deployment

1. **Update Environment Variables:**
   ```bash
   NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
   POLL_ESCROW_CONTRACT_ADDRESS=<deployed_address>
   ```

2. **Verify Contract on Base Explorer:**
   - Visit: https://sepolia.basescan.org
   - Search for your contract address
   - Verify and publish source code (optional, for transparency)

3. **Test Contract:**
   - Use Thirdweb dashboard to test `createPoll` function
   - Ensure USDC is approved and available for testing

4. **Set Up Insight Webhooks:**
   - In Thirdweb Dashboard, go to Insight
   - Register webhook URL: `https://your-firebase-project.cloudfunctions.net/insightWebhook`
   - Subscribe to `PollCreated`, `PollCompleted`, `PollClosed` events

## Testing

Before deploying to production:
1. Test `createPoll` with small USDC amount
2. Test `completePoll` with valid nullifier hash
3. Verify payout calculation (90% user, 10% platform)
4. Test nullifier hash uniqueness enforcement
5. Verify events are emitted correctly

## USDC Approval

Before creating a poll, users need to:
1. Approve the PollEscrow contract to spend their USDC
2. Approval amount should be >= `rewardPool`

You can create a helper function to handle this in the UI.

