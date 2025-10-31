# Poll in Cash

A decentralized polling platform that rewards verified users in **USDC on Base** for completing polls. Built with Next.js, Thirdweb, Worldcoin World ID, and Firebase.

## Overview

Poll in Cash connects poll creators, participants, and data buyers through a trustless system using smart contracts, Worldcoin for ID verification, and Firebase for off-chain data handling.

### Core Features

- **Proof of Personhood**: Every participant verified via Worldcoin World ID
- **Instant Rewards**: Smart contract disburses rewards immediately upon completion
- **No PII Storage**: Personal info never stored in our database
- **Fair Compensation**: Transparent reward logic, 10% platform fee
- **Scalable + Trustless**: Thirdweb on Base handles all payouts and escrow

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) + TypeScript
- **Blockchain**: Thirdweb on Base (mainnet/testnet)
- **Identity**: Worldcoin World ID (IDKit widget + verification API)
- **Backend**: Firebase (Firestore, Storage, Functions)
- **Smart Contracts**: PollEscrow.sol via Thirdweb Engine

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Firebase CLI (install globally: `npm install -g firebase-tools`)
- Firebase project (for backend services)
- Thirdweb account (for blockchain integration)
- Worldcoin API key (for identity verification)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd poll-in-cash
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your environment variables in `.env.local`:
   - Get `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` from [Thirdweb Dashboard](https://thirdweb.com/dashboard)
   - Get `THIRDWEB_SECRET_KEY` from Thirdweb Dashboard
   - Configure Firebase credentials from your Firebase project settings
   - Get `WLD_API_KEY` from [Worldcoin Developer Portal](https://developer.worldcoin.org)
   - Optional: Add `OPENAI_API_KEY` for receipt parsing

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
/src
  /app              # Next.js App Router routes
  /components        # React components
    /ui             # shadcn/ui components (optional)
  /lib              # Utility libraries
    thirdweb.ts     # Thirdweb client configuration
    contracts.ts    # Smart contract helpers
    firebase.ts     # Firebase client SDK
    firebaseAdmin.ts # Firebase admin SDK (server-only)
    worldcoin.ts    # Worldcoin ID verification
    ocr.ts          # OCR and receipt parsing
  /types            # TypeScript type definitions
/functions          # Firebase Cloud Functions
/docs              # Project documentation
```

## Environment Variables

See `.env.example` for all required and optional environment variables.

### Required for MVP
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- `THIRDWEB_SECRET_KEY`
- `NEXT_PUBLIC_CHAIN` (base or base-sepolia)
- Firebase configuration variables
- `WLD_API_KEY`

### Optional
- `OPENAI_API_KEY` (for receipt parsing)
- `SENDGRID_API_KEY` / `TWILIO_API_KEY` (for notifications)

## Development Workflow

1. **Type Checking**: `npm run typecheck`
2. **Linting**: `npm run lint`
3. **Development Server**: `npm run dev`
4. **Build**: `npm run build`
5. **Start Production**: `npm start`

## Deployment

### Staging Deployment (Vercel)

The project is configured for Vercel deployment. To deploy:

1. **Connect to Vercel:**
   ```bash
   npx vercel
   ```
   Or connect your GitHub repo directly at [vercel.com](https://vercel.com)

2. **Set Environment Variables:**
   Add all required environment variables from `.env.example` in Vercel's project settings.

3. **Deploy:**
   Vercel will automatically deploy on every push to `main` branch.

### CI/CD

GitHub Actions are configured to run lint and typecheck on every push and pull request. See `.github/workflows/ci.yml` for details.

## Firebase Functions

Firebase Functions are located in the `/functions` directory.

### Setup

1. Install Firebase CLI globally (if not already installed):
```bash
npm install -g firebase-tools
```

2. Install function dependencies:
```bash
cd functions
npm install
```

3. Initialize Firebase (if not already done):
```bash
firebase init functions
```

### Local Development

```bash
cd functions
npm run dev    # Starts Firebase emulators
# or
npm run serve  # Alias for dev
```

Note: Make sure you have the Firebase CLI installed and your Firebase project initialized before running the dev server.

### Deploy

```bash
cd functions
npm run deploy
```

## Documentation

- [Product Requirements Document](./docs/PRD_Poll_in_Cash.md)
- [Agent Operations Guide](./docs/AGENT_OPERATIONS.md)
- [Thirdweb Integration](./docs/Thirdweb-Agent.md)
- [Firebase Patterns](./docs/Firebase-Agents.md)
- [Worldcoin Integration](./docs/Worldcoin-Agent.md)

## Security

- Never commit `.env.local` files
- Never expose `THIRDWEB_SECRET_KEY` to the client
- All contract writes go through server-side Engine
- No PII is stored in the database

## License

Private project - All rights reserved

## Contact

For questions or issues, contact the project owner.
