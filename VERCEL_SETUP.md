# Vercel Deployment Setup Guide

This guide covers the steps needed to complete Vercel deployment setup.

## Automated Setup via CLI

The Vercel CLI can handle most of the setup. Run:

```bash
npx vercel
```

This will:
1. Authenticate you with Vercel
2. Link your project to the existing Vercel project
3. Allow you to set environment variables

## Manual Steps (if CLI doesn't work)

### 1. Connect Git Repository

Go to: https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/git

1. Click "Connect Git Provider"
2. Select "GitHub"
3. Authorize Vercel to access your repositories
4. Select repository: `anons191/Poll_In_Cash`
5. Select branch: `main`

### 2. Add Environment Variables

Go to: https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/environment-variables

Add each of these variables (get values from your `.env.local` or Firebase/Thirdweb dashboards):

#### Required Variables:

**Thirdweb:**
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` - Your Thirdweb Client ID
- `NEXT_PUBLIC_CHAIN` - Set to `base-sepolia` for staging

**Firebase (Client-side):**
- `NEXT_PUBLIC_FIREBASE_API_KEY` - From Firebase project settings
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - `your-project-id.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - `your-project-id.appspot.com`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - From Firebase settings
- `NEXT_PUBLIC_FIREBASE_APP_ID` - From Firebase settings

#### Optional (can add later):
- `OPENAI_API_KEY` - For receipt parsing
- `WLD_API_KEY` - Worldcoin API key
- `INSIGHT_CLIENT_ID` - Thirdweb Insight client ID

### 3. Deploy

After connecting Git and adding environment variables:
- Vercel will automatically deploy on your next push to `main`
- Or trigger a manual deployment from the Deployments tab

## Verify Deployment

Once deployed, check:
1. Build logs for any errors
2. Function logs for runtime issues
3. Test the staging URL to ensure app loads

## Troubleshooting

If build fails:
- Check that all `NEXT_PUBLIC_*` variables are set
- Verify Firebase project is accessible
- Check build logs in Vercel dashboard

