# Poll in Cash — Claude Code Build Guide

## Context

You are building **Poll in Cash**, an agent-powered polling marketplace where AI agents create polls, take polls, and collect USDC payouts on behalf of users — all on the Base blockchain.

Read the full PRD file (`poll-in-cash-prd.docx`) in this project directory before doing anything. That document contains the complete product vision, technical architecture, smart contract design, and roadmap.

## Core Concept (Quick Summary)

1. **Poll creators** fund USDC cash pools via smart contracts on Base
2. **Poll takers' AI agents** discover polls, verify eligibility using locally-stored user profiles, submit responses, and collect payouts
3. **Smart contracts** handle escrow, verification, and automatic USDC distribution
4. Users' sensitive data (IDs, documents) never leaves their device — agents produce attestations locally

## Tech Stack

| Layer | Technology | Docs |
|-------|-----------|------|
| Blockchain | Base (Chain ID: 8453) | https://base.org |
| Token | USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) | ERC-20 on Base |
| Payment Protocol | x402 (Coinbase) | https://docs.cdp.coinbase.com/x402/welcome |
| Agent Wallets | Coinbase Agentic Wallets + AgentKit | https://github.com/coinbase/agentkit |
| App Wallets | Thirdweb In-App Wallets | https://thirdweb.com |
| Onramp/Bridge | Thirdweb Universal Bridge | https://thirdweb.com |
| Gas Sponsorship | Thirdweb | https://thirdweb.com |
| Smart Contracts | Solidity (deploy via Thirdweb) | OpenZeppelin base |
| Backend | Node.js + Express or Hono | — |
| Database | Neon (Serverless Postgres) + Drizzle ORM | https://neon.tech |
| Frontend | Next.js + Thirdweb SDK | — |
| Agent Framework | AgentKit (framework-agnostic) | https://docs.cdp.coinbase.com/agent-kit/welcome |

## Project Structure

```
poll-in-cash/
├── contracts/                # Solidity smart contracts
│   ├── src/
│   │   └── PollPool.sol      # Core poll escrow + distribution contract
│   ├── test/
│   │   └── PollPool.test.ts  # Contract tests
│   └── hardhat.config.ts
├── backend/                  # API server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── polls.ts      # Poll CRUD + lifecycle
│   │   │   ├── agents.ts     # Agent protocol endpoints
│   │   │   ├── auth.ts       # Wallet-based auth
│   │   │   └── payouts.ts    # Payout status + history
│   │   ├── services/
│   │   │   ├── contract.ts   # Smart contract interactions via Thirdweb
│   │   │   ├── x402.ts       # x402 protocol integration
│   │   │   └── attestation.ts # Attestation verification
│   │   ├── db/
│   │   │   ├── schema.ts     # Drizzle ORM schema definitions
│   │   │   ├── index.ts      # Database connection + Drizzle client
│   │   │   └── queries.ts    # Type-safe database queries
│   │   └── index.ts          # Server entry point
│   └── package.json
├── frontend/                 # Next.js web dashboard
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── dashboard/        # Earnings + poll management
│   │   ├── create/           # Poll creation flow
│   │   └── profile/          # User profile management
│   ├── components/
│   └── package.json
├── agent/                    # Agent logic
│   ├── src/
│   │   ├── profile.ts        # .md profile management
│   │   ├── discovery.ts      # Poll discovery + matching
│   │   ├── responder.ts      # Response generation
│   │   ├── attestation.ts    # Local document verification
│   │   └── wallet.ts         # Agentic Wallet integration
│   └── package.json
├── poll-in-cash-prd.docx     # Full PRD (READ THIS FIRST)
└── CLAUDE-CODE-STARTER.md    # This file
```

## Build Order

Work through these phases sequentially. Do NOT skip ahead. Each phase builds on the previous one.

---

### Phase 1: Smart Contract (START HERE)

**Goal:** A working PollPool.sol contract that handles the full poll lifecycle.

**Setup:**
```bash
mkdir poll-in-cash && cd poll-in-cash
mkdir -p contracts/src contracts/test
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
npx hardhat init  # Choose TypeScript project
```

**PollPool.sol must implement:**

1. `createPoll(title, criteriaHash, participantCap, duration)` — Creator calls this with USDC approval. Contract transfers USDC from creator, deducts 10% platform fee (sends to treasury), stores poll metadata.

2. `submitResponse(pollId, attestationSignature)` — Agent submits a poll response. Checks: poll is active, cap not reached, wallet hasn't already participated, attestation signature is valid. Records participation.

3. `closePoll(pollId)` — Closes the poll. Callable by creator or automatically when duration expires. Anyone can call after expiry.

4. `distribute(pollId)` — After close, distributes USDC evenly to all recorded participants. Returns unused funds to creator if cap wasn't reached.

5. `refund(pollId)` — Creator cancels an active poll and reclaims remaining funds (minus payouts already committed).

**Key design decisions:**
- Use OpenZeppelin's `ReentrancyGuard` on all fund-moving functions
- USDC address on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC address on Base Sepolia (testnet): look up the current testnet USDC address
- Platform fee: 10%, sent to a configurable treasury address
- Store a `criteriaHash` (bytes32) on-chain — the actual criteria live off-chain in the database
- Attestation verification: use ECDSA signature recovery to verify the agent's attestation was signed by a trusted attestation provider
- Poll states: `Active`, `Closed`, `Distributed`, `Cancelled`
- Emit events for all state changes: `PollCreated`, `ResponseSubmitted`, `PollClosed`, `FundsDistributed`, `PollCancelled`

**Write comprehensive tests** covering:
- Happy path: create → submit responses → close → distribute
- Edge cases: double submission, submission after close, cap reached, zero participants refund
- Access control: only creator can cancel, anyone can close after expiry
- Fee calculation accuracy
- Partial fill scenarios (fewer participants than cap)

**Test on Base Sepolia before anything else.**

---

### Phase 2: Database Schema

**Goal:** Neon Postgres schema using Drizzle ORM for type-safe queries.

**Why Neon instead of Supabase:**
- Coinbase CDP handles wallet-based auth via Agentic Wallets
- Thirdweb handles in-app wallets for web users
- The wallet IS the user identity — no need for Supabase's built-in auth
- Neon provides pure serverless Postgres with database branching for dev/staging
- No platform lock-in — just a connection string swap if needed

**Setup:**
```bash
cd backend
npm install drizzle-orm postgres
npm install -D drizzle-kit @types/node
```

**Drizzle schema definition (`backend/src/db/schema.ts`):**

Define all tables using Drizzle's TypeScript schema:

```typescript
import { pgTable, uuid, text, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const pollStatusEnum = pgEnum('poll_status', ['draft', 'active', 'closed', 'distributed', 'cancelled']);
export const visibilityEnum = pgEnum('visibility', ['public', 'private']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'confirmed', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const polls = pgTable('polls', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').references(() => users.id).notNull(),
  contractPollId: integer('contract_poll_id'),
  title: text('title').notNull(),
  description: text('description'),
  questions: jsonb('questions').notNull(), // array of question objects
  criteria: jsonb('criteria').notNull(),   // targeting criteria
  criteriaHash: text('criteria_hash').notNull(), // bytes32, matches on-chain
  cashPoolUsdc: decimal('cash_pool_usdc', { precision: 18, scale: 6 }).notNull(),
  participantCap: integer('participant_cap').notNull(),
  status: pollStatusEnum('status').default('draft').notNull(),
  visibility: visibilityEnum('visibility').default('public').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pollResponses = pgTable('poll_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: uuid('poll_id').references(() => polls.id).notNull(),
  agentWallet: text('agent_wallet').notNull(),
  responses: jsonb('responses').notNull(),        // answers to each question
  confidenceScores: jsonb('confidence_scores'),   // per-question confidence
  attestationHash: text('attestation_hash').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: uuid('poll_id').references(() => polls.id).notNull(),
  recipientWallet: text('recipient_wallet').notNull(),
  amountUsdc: decimal('amount_usdc', { precision: 18, scale: 6 }).notNull(),
  txHash: text('tx_hash'),
  status: payoutStatusEnum('status').default('pending').notNull(),
  distributedAt: timestamp('distributed_at'),
});

export const agentProfiles = pgTable('agent_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  verifiedAttributes: jsonb('verified_attributes').default({}).notNull(),
  reliabilityScore: decimal('reliability_score', { precision: 3, scale: 2 }).default('1.0').notNull(),
  pollsCompleted: integer('polls_completed').default(0).notNull(),
  totalEarnedUsdc: decimal('total_earned_usdc', { precision: 18, scale: 6 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Database connection (`backend/src/db/index.ts`):**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

**Migrations with drizzle-kit:**

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push schema directly to database (dev only)
npx drizzle-kit push

# Run migrations
npx drizzle-kit migrate
```

**drizzle.config.ts:**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Auth flow (wallet-based, no Supabase auth):**

1. Client connects wallet (Thirdweb in-app wallet or Agentic Wallet)
2. Client requests a nonce from `POST /auth/nonce`
3. Client signs the nonce with their wallet
4. Client sends signature to `POST /auth/verify`
5. Backend verifies signature using ethers.js `verifyMessage()`
6. Backend issues JWT containing `{ walletAddress, iat, exp }`
7. All subsequent API requests include JWT in Authorization header
8. Backend middleware extracts wallet address from JWT for authorization

**Application-layer authorization (replaces Postgres RLS):**

Instead of Postgres RLS policies, implement authorization in middleware:

```typescript
// Middleware checks JWT wallet address against resource ownership
async function requireOwnership(req, res, next) {
  const walletAddress = req.user.walletAddress; // from JWT
  const poll = await db.query.polls.findFirst({
    where: eq(polls.id, req.params.pollId)
  });

  if (!poll) return res.status(404).json({ error: 'Not found' });

  const creator = await db.query.users.findFirst({
    where: eq(users.id, poll.creatorId)
  });

  if (creator?.walletAddress !== walletAddress) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
```

**Key authorization rules to implement:**
- Users can only read/modify their own user record
- Poll creators can read all responses to their polls
- Poll responses are write-once (no updates after submission)
- Payouts are read-only for users
- Agent profiles belong to their user

---

### Phase 3: Backend API

**Goal:** Node.js API server handling poll lifecycle and agent protocol.

**Key endpoints:**

```
# Auth
POST   /auth/connect          — Wallet-based auth (sign message)

# Polls (Creator-facing)
POST   /polls                 — Create poll (draft)
POST   /polls/:id/fund        — Fund and activate poll on-chain
GET    /polls/:id             — Get poll details + response count
GET    /polls/:id/responses   — Get responses (creator only)
PATCH  /polls/:id/close       — Close poll
DELETE /polls/:id             — Cancel and refund

# Agent Protocol (Agent-facing, x402-enabled)
GET    /agent/polls/discover  — List eligible polls for an agent profile
POST   /agent/polls/:id/match — Check if agent's profile matches criteria
POST   /agent/polls/:id/respond — Submit poll response with attestation
GET    /agent/earnings        — Get agent's payout history

# Dashboard
GET    /dashboard/earnings    — Total earnings, recent payouts
GET    /dashboard/activity    — Recent poll activity
```

**Integrate with:**
- Thirdweb SDK for contract interactions (reading poll state, triggering distribute)
- Drizzle ORM for type-safe database queries (see Phase 2 schema)
- x402 middleware on agent-facing endpoints
- JWT middleware for wallet-based authentication (verify signature → issue token)

---

### Phase 4: Coinbase CDP + Thirdweb Integration

**Goal:** Wire up wallet creation, gas sponsorship, and payment flows.

#### Coinbase CDP Integration (Agent Wallets)

**Setup:**
```bash
cd backend
npm install @coinbase/agentkit @coinbase/cdp-sdk
```

**Programmatic wallet provisioning:**

Wallets are created PROGRAMMATICALLY via `CdpEvmWalletProvider`, not manually. When a new user's agent connects, the backend provisions a wallet automatically:

```typescript
import { CdpEvmWalletProvider } from "@coinbase/agentkit";

// Standard EVM wallet
const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: "base-sepolia", // "base-mainnet" for production
});

// Get wallet address
const address = await walletProvider.getAddress();
```

**Smart Wallets (gasless on Base):**

For gasless transactions, use `CdpSmartWalletProvider` instead:

```typescript
import { CdpSmartWalletProvider } from "@coinbase/agentkit";

const smartWalletProvider = await CdpSmartWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: "base-sepolia",
});
```

**Wallet persistence:**

Export and store wallet data encrypted so wallets persist across sessions:

```typescript
// Export wallet for storage
const walletData = await walletProvider.exportWallet();

// Store encrypted in database (agentProfiles.encryptedWalletData)
// Later, restore wallet from exported data
```

**Environment variables (add to `.env.example`):**
```
CDP_API_KEY_ID=           # From https://portal.cdp.coinbase.com
CDP_API_KEY_SECRET=       # From CDP portal
CDP_WALLET_SECRET=        # Only shown once during key creation - save immediately!
```

#### x402 Integration (Payment-Gated Endpoints)

**Setup:**
```bash
npm install @x402/hono  # or @x402/express if using Express
```

**Implementation:**

x402 is Express/Hono middleware that gates endpoints behind payment. For Poll in Cash, agent discovery endpoints use x402 for the payment flow:

```typescript
import { x402 } from "@x402/hono";

// Gate endpoint behind payment
app.get("/agent/polls/discover", x402({
  price: "0.01", // USDC
  payTo: process.env.TREASURY_ADDRESS,
}), async (c) => {
  // Only reached after payment verified
  const polls = await getDiscoverablePolls();
  return c.json({ polls });
});
```

**Reference implementation:** https://github.com/coinbase/x402

#### Thirdweb Integration (App Wallets + Onramp)

**Setup:**
```bash
cd frontend
npm install thirdweb
```

**In-app wallets (frontend):**

Created via Thirdweb Connect SDK on the frontend for email/social login:

```typescript
import { createThirdwebClient, ConnectButton } from "thirdweb/react";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

// In your component
<ConnectButton client={client} />
```

**Server-side contract interaction:**

```typescript
import { createThirdwebClient, getContract } from "thirdweb";
import { base } from "thirdweb/chains";

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

const pollPoolContract = getContract({
  client,
  chain: base,
  address: process.env.POLLPOOL_CONTRACT_ADDRESS,
});
```

**Universal Bridge for funding:**

Embed as iframe or React component for poll creators to fund pools with credit card → USDC:

```typescript
import { UniversalBridge } from "thirdweb/react";

<UniversalBridge
  client={client}
  destinationChain={base}
  destinationToken="USDC"
  onComplete={(txHash) => {
    // Poll is now funded
  }}
/>
```

**Environment variables (add to `.env.example`):**
```
THIRDWEB_CLIENT_ID=       # From https://thirdweb.com/dashboard
THIRDWEB_SECRET_KEY=      # For server-side operations
```

#### Testing Checklist

- [ ] Agent wallet provisioned via CDP
- [ ] Smart wallet working for gasless transactions
- [ ] Wallet data exported and persisted
- [ ] x402 payment flow working on discovery endpoint
- [ ] Thirdweb in-app wallet connecting
- [ ] Universal Bridge funding flow complete
- [ ] Agent → poll → payout flow working on Base Sepolia

---

### Phase 5: Agent Logic

**Goal:** The agent that discovers polls, matches profiles, and submits responses.

**Core agent capabilities:**
- Profile builder: conversational flow to build the .md profile
- Document scanner: read local documents and extract verification attributes
- Poll discoverer: query the API for matching polls
- Response generator: formulate answers based on user profile and knowledge
- Attestation creator: sign verification attestations locally
- Wallet manager: check balance, view earnings history

---

### Phase 6: Frontend Dashboard

**Goal:** Next.js web app for non-agent interactions.

**Pages:**
- Landing page with value proposition
- Dashboard: earnings summary, recent activity, active polls
- Create Poll: conversational or form-based poll creation
- Profile: view/edit profile, manage verified attributes, wallet balance
- Poll Results: aggregated results view for poll creators

---

## Important Notes

- **Always test on Base Sepolia first.** Never deploy untested contracts to mainnet.
- **The USDC contract on Base mainnet is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.** Do not hardcode this — use environment variables.
- **Gas on Base is sub-cent.** Don't over-optimize for gas; optimize for code clarity and security.
- **x402 is HTTP-native.** It's middleware on your API endpoints, not a separate service. See https://github.com/coinbase/x402 for the Express middleware pattern.
- **Thirdweb has an MCP server** at `https://api.thirdweb.com/mcp` — use it if you need to look up SDK patterns.
- **AgentKit supports multiple frameworks.** Start with the simplest (Vercel AI SDK or direct) and don't over-engineer the agent layer initially.
- **The .md profile file lives on the user's device.** The backend never stores or has access to it. The API only receives attestation results (boolean flags), never raw profile data.
- **Neon database branching** is useful for dev/staging environments. Create branches for feature development without affecting production data.
- **Wallet = Identity.** There's no separate auth system. Coinbase CDP handles agent wallets, Thirdweb handles app wallets. The backend just verifies signatures and issues JWTs containing the wallet address.
- **CDP API keys:** Get from https://portal.cdp.coinbase.com — you need a Coinbase account. The `CDP_WALLET_SECRET` is only shown once during key creation; save it immediately.
- **Thirdweb keys:** Get from https://thirdweb.com/dashboard — create a free project. You need both `THIRDWEB_CLIENT_ID` (public, for frontend) and `THIRDWEB_SECRET_KEY` (private, for backend).
- **Both CDP and Thirdweb keys are needed before starting Phase 4** but NOT before. Phases 1-3 can be completed without them.

## First Prompt to Give Claude Code

Copy and paste this as your first prompt after giving Claude Code access to this file and the PRD:

```
Read CLAUDE-CODE-STARTER.md and poll-in-cash-prd.docx in the project directory. 
These are the complete specs for Poll in Cash — an agent-powered polling marketplace 
on Base blockchain with USDC payouts.

Start with Phase 1: Smart Contract. Set up the Hardhat project and build PollPool.sol 
following the spec in the starter guide. Use OpenZeppelin for security patterns. 
Include comprehensive tests. Configure for Base Sepolia testnet.

Do not skip ahead to other phases. Focus only on getting the smart contract right first.
```

Then for each subsequent phase, prompt:

```
Phase 1 is complete. Move to Phase 2: Database Schema. Follow the spec in
CLAUDE-CODE-STARTER.md. Set up Neon Postgres with Drizzle ORM. Create the
schema definitions, database connection, and drizzle-kit configuration.
Include the wallet-based auth flow (signature verification → JWT).
```

And so on through each phase.
