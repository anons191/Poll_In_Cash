# Deployment Information

## PollEscrow Contract Deployment

**Contract Address:** `0x52D535058Fc5757bf60A3a2F8AeB19039d3EbbFc`

**Network:** Base Sepolia Testnet

**Deployment Date:** October 31, 2025

**Constructor Parameters:**
- USDC Token: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ✅ (Correct address)
- Platform Treasury: `0x5f71c75fc0af4423afbf3ed244db6dc9fe6e664b`

**Explorer:** https://sepolia.basescan.org/address/0x52D535058Fc5757bf60A3a2F8AeB19039d3EbbFc

---

## Current Deployments

Your app is already deployed and live on Vercel:

**Latest Deployment URLs:**
- https://poll-in-cash-1ixpeuct3-merrell-acostas-projects.vercel.app (4 minutes ago)
- https://poll-in-cash-otuk7pzqk-merrell-acostas-projects.vercel.app (7 minutes ago)
- https://poll-in-cash-5k880k3m7-merrell-acostas-projects.vercel.app (15 minutes ago)

All deployments show status: **● Ready** in Production environment.

## Git Integration

Deployments appear to be working. To verify Git auto-deployment:

1. **Check Git Connection**: Visit https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/git
   - If connected, you'll see your GitHub repository listed
   - Future pushes to `main` will auto-deploy

2. **Test Auto-Deployment**: Make a small change and push:
   ```bash
   # Make a small change (e.g., update README)
   echo "# Test deployment" >> README.md
   git add README.md
   git commit -m "Test: Trigger Vercel auto-deployment"
   git push origin main
   ```
   
   If Git is connected, Vercel will automatically deploy within 1-2 minutes.

## Manual Deployment

You can always deploy manually using:
```bash
vercel --prod
```

## Environment Variables

All required environment variables are configured:
- ✅ Thirdweb configuration
- ✅ Firebase configuration  
- ✅ All set for Production, Preview, and Development

## Status

✅ **Week 1 Staging Deployment: COMPLETE**
- App is live and deployed
- Environment variables configured
- Ready for Week 2 development

