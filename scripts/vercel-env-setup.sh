#!/bin/bash
# Vercel Environment Variables Setup Script
# This script helps you add environment variables to Vercel

echo "Vercel Environment Variables Setup"
echo "===================================="
echo ""
echo "This script will help you add environment variables to your Vercel project."
echo "Make sure you have your .env.local file ready with all the values."
echo ""
read -p "Press Enter to continue..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your environment variables first."
    exit 1
fi

echo ""
echo "Available commands to add environment variables:"
echo ""
echo "For Production:"
echo "vercel env add NEXT_PUBLIC_THIRDWEB_CLIENT_ID production"
echo ""
echo "For Preview:"
echo "vercel env add NEXT_PUBLIC_THIRDWEB_CLIENT_ID preview"
echo ""
echo "For Development:"
echo "vercel env add NEXT_PUBLIC_THIRDWEB_CLIENT_ID development"
echo ""
echo "After linking your project with 'vercel link', you can add variables one by one."
echo "Or use the Vercel dashboard: https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/environment-variables"
echo ""

