#!/bin/bash
# Non-interactive script to add environment variables from .env.local to Vercel

set -e

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.local file not found!"
    exit 1
fi

echo "Adding environment variables from .env.local to Vercel..."
echo ""

# Function to add env var to Vercel
add_to_vercel() {
    local var_name=$1
    local var_value=$2
    local env_type=${3:-production}
    
    if [ -z "$var_value" ]; then
        echo "⚠️  Skipping $var_name (empty value)"
        return
    fi
    
    echo "Adding $var_name to $env_type..."
    echo "$var_value" | vercel env add "$var_name" "$env_type" --yes 2>&1 | grep -v "^Adding" || true
    echo "✅ Added $var_name"
}

# Read .env.local and extract NEXT_PUBLIC_ variables
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Remove quotes from value
    value=$(echo "$value" | sed 's/^"//;s/"$//' | sed "s/^'//;s/'$//")
    
    # Only process NEXT_PUBLIC_ variables
    if [[ "$key" =~ ^NEXT_PUBLIC_ ]]; then
        add_to_vercel "$key" "$value" "production"
        add_to_vercel "$key" "$value" "preview"
        add_to_vercel "$key" "$value" "development"
    fi
done < "$ENV_FILE"

echo ""
echo "✅ Environment variables added to Vercel!"

