#!/bin/bash
# Interactive script to add environment variables to Vercel
# Run this script after you have your .env.local file ready

set -e

echo "========================================="
echo "Vercel Environment Variables Setup"
echo "========================================="
echo ""
echo "This script will help you add environment variables to Vercel."
echo "Make sure you have your values ready from:"
echo "  - Firebase Console (project settings)"
echo "  - Thirdweb Dashboard"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo ""
    echo "⚠️  .env.local file not found!"
    echo "If you have environment variables, we'll add them interactively."
    echo ""
fi

# Function to add env variable
add_env_var() {
    local var_name=$1
    local description=$2
    local default_env=${3:-production}
    
    echo ""
    echo "Adding: $var_name"
    echo "Description: $description"
    
    if [ -f .env.local ]; then
        local value=$(grep "^${var_name}=" .env.local | cut -d '=' -f2- | tr -d '"')
        if [ ! -z "$value" ]; then
            echo "Found in .env.local: ${value:0:20}..."
            read -p "Use this value? (Y/n): " use_value
            if [[ "$use_value" =~ ^[Nn]$ ]]; then
                read -p "Enter value for $var_name: " value
            fi
        else
            read -p "Enter value for $var_name: " value
        fi
    else
        read -p "Enter value for $var_name: " value
    fi
    
    if [ ! -z "$value" ]; then
        echo "Adding to $default_env environment..."
        echo "$value" | vercel env add "$var_name" "$default_env"
        echo "✅ Added $var_name"
    else
        echo "⚠️  Skipped $var_name (empty value)"
    fi
}

echo ""
echo "Which environments should we configure?"
echo "1) Production only"
echo "2) Production + Preview + Development"
read -p "Choice (1 or 2): " env_choice

if [ "$env_choice" == "2" ]; then
    ENVS=("production" "preview" "development")
else
    ENVS=("production")
fi

echo ""
echo "Starting environment variable setup..."
echo "You can skip any variable by pressing Enter (you can add it later)"
echo ""

for env in "${ENVS[@]}"; do
    echo ""
    echo "========================================="
    echo "Configuring $env environment"
    echo "========================================="
    
    # Required variables
    add_env_var "NEXT_PUBLIC_THIRDWEB_CLIENT_ID" "Thirdweb Client ID (get from dashboard)" "$env"
    add_env_var "NEXT_PUBLIC_CHAIN" "Chain: base or base-sepolia" "$env"
    
    # Firebase variables
    add_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" "Firebase API Key" "$env"
    add_env_var "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "Firebase Auth Domain (project-id.firebaseapp.com)" "$env"
    add_env_var "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "Firebase Project ID" "$env"
    add_env_var "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "Firebase Storage Bucket (project-id.appspot.com)" "$env"
    add_env_var "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "Firebase Messaging Sender ID" "$env"
    add_env_var "NEXT_PUBLIC_FIREBASE_APP_ID" "Firebase App ID" "$env"
done

echo ""
echo "========================================="
echo "✅ Environment variable setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Connect Git repository in Vercel dashboard:"
echo "   https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/git"
echo ""
echo "2. Push to GitHub to trigger automatic deployment"
echo ""

