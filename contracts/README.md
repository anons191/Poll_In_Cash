# PollEscrow Smart Contract

This directory contains the PollEscrow smart contract for managing USDC escrow and payouts.

## Contract Overview

**PollEscrow.sol** handles:
- Creating polls with USDC escrow deposits
- Completing polls and executing payouts (90% user, 10% platform fee)
- Tracking nullifier hashes to prevent double-voting
- Managing poll lifecycle (active/closed states)

## Features

- **ReentrancyGuard**: Protects against reentrancy attacks
- **SafeERC20**: Safe token transfers using OpenZeppelin's library
- **Nullifier Hash Tracking**: Prevents World ID proof reuse
- **Platform Fee**: Automatically calculates 10% fee for treasury

## Deployment

### Via Thirdweb Dashboard (Recommended)

1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Create a new contract
3. Upload `PollEscrow.sol`
4. Deploy to **Base Sepolia** testnet
5. Constructor parameters:
   - `_usdcToken`: `0x081827b8C3Aa05287b5aA2bC3051fbE638F33152`
   - `_platformTreasury`: `0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b`

### Via Thirdweb CLI

```bash
npx thirdweb deploy
```

Select:
- Network: Base Sepolia
- Contract: PollEscrow.sol
- Enter constructor parameters

## Dependencies

Requires OpenZeppelin contracts:
- `@openzeppelin/contracts` (install via npm or use remix)

## Functions

### createPoll(uint256 _rewardPool, uint256 _rewardPerUser, uint256 _maxCompletions)
Creates a new poll and escrows USDC.

### completePoll(uint256 _pollId, bytes32 _nullifierHash)
Completes a poll and executes payout (90% user, 10% platform).

### getPollInfo(uint256 _pollId)
Returns poll details.

### isNullifierHashUsed(uint256 _pollId, bytes32 _nullifierHash)
Checks if a nullifier hash has been used (prevents double-voting).

## Events

- `PollCreated`: Emitted when a poll is created
- `PollCompleted`: Emitted when a poll is completed and payout executed
- `PollClosed`: Emitted when a poll is closed

