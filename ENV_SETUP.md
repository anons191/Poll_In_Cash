# Environment Variables Setup for Week 2

## Add to `.env.local`

Since `.env.local` is gitignored and can't be edited directly, please add these variables manually:

```bash
# Thirdweb Engine (Server-side)
THIRDWEB_SECRET_KEY=5qT4Nc3va3I2woNWfhoCgI6niJBOwF2VbNKac8yI8mBS5qiG011CYzVakT_0Vrhi1W6c9GP9XuMKeW2svW9mjg

# Worldcoin World ID
WORLDCOIN_APP_ID=app_fdb7cb09a40c41a0b6bf9c7eab56b47c
WLD_API_KEY=api_a2V5X2M2NjU4ODEzYjdjZGVlZjAzMmRlODQ5YjJjOTIxNDA1OnNrX2RlN2YwZWU0OTNkMzYzOWYzZGVmMzJlNDlhMmMzNzEyYTY5ZDAxOTRiM2I4YTM0NA

# Smart Contract Configuration (Base Sepolia)
USDC_TOKEN_ADDRESS=0x081827b8C3Aa05287b5aA2bC3051fbE638F33152
PLATFORM_TREASURY_WALLET=0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b
POLL_ESCROW_CONTRACT_ADDRESS=# Will be set after contract deployment
```

## Quick Add Command

You can add these all at once by running:

```bash
cat >> .env.local << 'EOF'

# Thirdweb Engine (Server-side)
THIRDWEB_SECRET_KEY=5qT4Nc3va3I2woNWfhoCgI6niJBOwF2VbNKac8yI8mBS5qiG011CYzVakT_0Vrhi1W6c9GP9XuMKeW2svW9mjg

# Worldcoin World ID
WORLDCOIN_APP_ID=app_fdb7cb09a40c41a0b6bf9c7eab56b47c
WLD_API_KEY=api_a2V5X2M2NjU4ODEzYjdjZGVlZjAzMmRlODQ5YjJjOTIxNDA1OnNrX2RlN2YwZWU0OTNkMzYzOWYzZGVmMzJlNDlhMmMzNzEyYTY5ZDAxOTRiM2I4YTM0NA

# Smart Contract Configuration (Base Sepolia)
USDC_TOKEN_ADDRESS=0x081827b8C3Aa05287b5aA2bC3051fbE638F33152
PLATFORM_TREASURY_WALLET=0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b
POLL_ESCROW_CONTRACT_ADDRESS=# Will be set after contract deployment
EOF
```

## Verification

After adding, verify the variables are set:
```bash
grep -E "THIRDWEB_SECRET_KEY|WORLDCOIN_APP_ID|USDC_TOKEN_ADDRESS" .env.local
```

## Notes

- `POLL_ESCROW_CONTRACT_ADDRESS` will be automatically added after we deploy the contract
- All these values are for **Base Sepolia testnet** (staging environment)
- Never commit `.env.local` to git (already in .gitignore)

