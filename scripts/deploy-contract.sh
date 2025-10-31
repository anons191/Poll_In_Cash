#!/bin/bash
# Deploy PollEscrow contract to Base Sepolia using Thirdweb

set -e

echo "Deploying PollEscrow contract to Base Sepolia..."
echo ""

# Get environment variables
USDC_TOKEN="0x081827b8C3Aa05287b5aA2bC3051fbE638F33152"
PLATFORM_TREASURY="0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b"
SECRET_KEY=$(grep "THIRDWEB_SECRET_KEY" ../.env.local | cut -d '=' -f2)

if [ -z "$SECRET_KEY" ]; then
  echo "❌ THIRDWEB_SECRET_KEY not found in .env.local"
  exit 1
fi

echo "Constructor parameters:"
echo "  USDC Token: $USDC_TOKEN"
echo "  Platform Treasury: $PLATFORM_TREASURY"
echo ""

cd contracts

echo "Deploying contract..."
thirdweb deploy PollEscrow.sol \
  --network base-sepolia \
  --constructor-params "$USDC_TOKEN" "$PLATFORM_TREASURY" \
  -k "$SECRET_KEY"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Copy the deployed contract address"
echo "2. Add to .env.local:"
echo "   NEXT_PUBLIC_POLL_ESCROW_CONTRACT_ADDRESS=<address>"
echo "   POLL_ESCROW_CONTRACT_ADDRESS=<address>"

