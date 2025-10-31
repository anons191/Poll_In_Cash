# Vercel Setup Status

## ✅ Completed Steps

1. **Project Linked**: Project is connected to `merrell-acostas-projects/poll-in-cash`
   - Project ID: `prj_eKT8s8H8ZQGPDAIzn1GOvKI64uX7`
   - Linked via CLI (`.vercel` directory created)

## ⚠️ Remaining Steps (Manual)

### 1. Connect Git Repository (Required)

You need to connect your GitHub repository in the Vercel dashboard:

1. Go to: https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/git
2. Click "Connect Git Provider"
3. Select "GitHub"
4. Authorize Vercel (if not already done)
5. Select repository: `anons191/Poll_In_Cash`
6. Select branch: `main`

This will enable automatic deployments on every push.

### 2. Add Environment Variables (Required)

You need to add environment variables. Two options:

#### Option A: Via Dashboard (Easier)
1. Go to: https://vercel.com/merrell-acostas-projects/poll-in-cash/settings/environment-variables
2. Add each variable from `.env.example`
3. Set environment scope: Production, Preview, and Development

#### Option B: Via CLI Script (Interactive)
```bash
./scripts/setup-vercel-env.sh
```

**Required Variables to Add:**

**Thirdweb:**
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- `NEXT_PUBLIC_CHAIN` (set to `base-sepolia` for staging)

**Firebase (Client-side only - these are safe to expose):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Get these values from:
- **Firebase**: Firebase Console → Project Settings → Your app → Config
- **Thirdweb**: Thirdweb Dashboard → Your project → Settings

### 3. Trigger First Deployment

After connecting Git and adding environment variables:

1. **Automatic**: Push any commit to `main` branch
   ```bash
   git push origin main
   ```

2. **Manual**: Go to Vercel dashboard → Deployments → Deploy

## Verification

Once deployed, check:
- Build succeeds (no errors in logs)
- App loads at your Vercel URL
- No runtime errors in function logs

## Quick Command Reference

```bash
# Link project (already done)
vercel link

# List environment variables
vercel env ls

# Add environment variable (interactive)
vercel env add VARIABLE_NAME production

# Deploy
vercel --prod
```

## Current Status

- ✅ Project linked to Vercel
- ❌ Git repository not connected (requires dashboard)
- ❌ Environment variables not set (requires your values)
- ⏳ Ready for first deployment after above steps

