# AGENT_OPERATIONS.md — Poll in Cash Engineering Agent Playbook

**Purpose:** This file tells any AI/automation agent exactly how to work inside our repo, what libraries/services are allowed, and the guardrails it must follow. Treat this as the source of truth for code changes and operational behavior.

---

## 0) Repo & Tech Stack (authoritative)
- **Framework:** Next.js (App Router) + TypeScript
- **Design:** Tailwind (optional), shadcn/ui (optional)
- **Blockchain:** **Thirdweb only** (wallet connect, contracts, Engine, Insight, gas sponsorship) on **Base** (8453; test: Base Sepolia)
- **Identity / Proof-of-Personhood:** **Worldcoin World ID** via IDKit; no PII storage
- **Storage/DB:** **Firebase** (Firestore + Storage + Functions)
- **OCR/AI:** Hybrid — client uploads images → backend OCR via Vision (if available) or Tesseract; **OpenAI** used for receipt parsing/categorization only (never as the sole OCR)
- **Payments/Rewards:** USDC on Base, payouts are on-chain to user wallet; platform fee = **10%** of user payout per poll
- **Notifications:** Email/SMS (SendGrid/Twilio or Firebase Extensions), plus in-app toasts; push later
- **Data Sales (MVP):** Creators can export CSVs or consume the **Data Sales API** (HTTP). No live PII; only aggregated or consented fields.

---

## 1) Hard Rules (must follow)
1. **Blockchain = Thirdweb only.** Use:
   - React SDK (`thirdweb/react`) for wallet & hooks
   - TypeScript SDK (`thirdweb`) for server/agents
   - **Engine / Transactions API** for server-side writes
   - **Insight** for event indexing & webhooks
2. **No secrets in client.** Only `NEXT_PUBLIC_*` allowed in the browser.
3. **World ID required** before poll participation. Use IDKit; verify proof server-side; enforce **one-proof-per-poll** via `nullifier_hash`.
4. **No PII storage** in our DB. Agents must avoid fetching, storing, or logging PII (IDs, selfies, SSNs). Store only verification status/flags.
5. **USDC payouts = on-chain**. Never use Stripe to send funds to wallets. Stripe may be used later for fiat on/off ramps, not for MVP payouts.
6. **Least-privilege writes.** All contract/admin writes go through server-side Engine with scoped keys. Never embed `THIRDWEB_SECRET_KEY` in frontend.
7. **Idempotency everywhere.** Use idempotency keys for payouts, webhook handlers, and OCR jobs to avoid dupes.
8. **Logging without secrets.** Redact addresses only when asked; never log private keys, JWTs, or webhook payloads containing sensitive tokens.
9. **Schema first.** Update types and zod schemas before implementing handlers or UI forms.
10. **Tests > guesses.** Add minimal tests for contract utils, proof verification, and payout math before merges touching those paths.

---

## 2) Directory Conventions
```
/src
  /app
    (routes, server actions)
  /components
    /ui
  /lib
    firebase.ts         # client SDK
    firebaseAdmin.ts    # server admin (in functions or server-only files)
    thirdweb.ts         # createThirdwebClient + base chain
    contracts.ts        # wrappers + typed calls
    worldcoin.ts        # IDKit helpers + server verify util
    ocr.ts              # OCR and OpenAI parsing utilities
  /types                # zod + type definitions
/functions              # Firebase Functions: webhooks, agents, cron
/docs                   # engineering & agent docs (this file, Thirdweb-Agent.md, Worldcoin-Agent.md, Firebase-Agents.md, PRD.md)
```
- **Server-only code** lives in `/functions` or Next.js server files (`app/(routes)/api/.../route.ts`). Never import server files into client components.

---

## 3) Environment Variables
**Client (safe):**
```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=
NEXT_PUBLIC_CHAIN=base|base-sepolia
```
**Server (secret):**
```
THIRDWEB_SECRET_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_APP_ID=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OPENAI_API_KEY=
WLD_API_KEY=            # if using hosted verify API
INSIGHT_CLIENT_ID=      # thirdweb client id for Insight REST
SENDGRID_API_KEY=|TWILIO_API_KEY= (if used)
```
- Add placeholders to `.env.example`; never commit `.env.local`.

---

## 4) Agent Behaviors (how to propose & apply changes)
**When creating or modifying code, the agent must:**
1. **Plan → Diff → Validate.**
   - Post a short plan (goal, files to touch)
   - Produce **unified diffs** (patch format) for files
   - Include any new env keys in `.env.example`
2. **Respect style & safety.**
   - TypeScript strict
   - zod for input validation (API routes, forms)
   - Avoid breaking exports; keep imports relative to `@/*`
3. **Add minimal tests** for:
   - `lib/worldcoin.ts`: proof verification happy/invalid/replay cases
   - `lib/contracts.ts`: amount math (payout – 10% fee)
   - `functions/webhooks`: idempotency and signature checks
4. **Run checks** (CI assumed):
   - `npm run typecheck`
   - `npm run lint`
5. **Open a PR description** including:
   - Purpose & scope
   - Risk and rollback
   - Env/key changes
   - Manual test steps & screenshots (if UI)

---

## 5) Allowed Libraries & Services
- **Thirdweb:** wallets, contracts, Engine (server writes), Insight (events, webhooks), gas sponsorship (EIP-7702 / 4337)
- **Worldcoin World ID:** IDKit widget (client), verify API (server), on-chain verify (optional)
- **Firebase:** Firestore (data), Storage (receipts), Functions (webhooks/agents)
- **OpenAI:** text-only parsing/classification of OCR output; do not send raw PII images by default
- **OCR:** Tesseract/Cloud Vision; store extracted, non-PII tokens (e.g., SKU hashes, merchant name) for matching
- **Email/SMS:** SendGrid/Twilio (opt-in), respect user consent; no PII in message bodies

**Disallowed:** writing raw private keys, using non-Thirdweb Web3 libs for chain writes, storing PII, committing build artifacts or `.env`.

---

## 6) Core Flows (agent checklists)

### 6.1 Wallet & Auth (Thirdweb)
- Add `<ConnectButton client={client} />` in layout
- `ThirdwebProvider` with `activeChain=base`
- SIWE (optional) if we need session-bound API calls

### 6.2 World ID Gate
- Render IDKit with `action="poll:<pollId>"` and `signal=<wallet>`
- On success, POST proof to `/api/worldid/verify`
- Server validates proof; write `{ pollId, nullifier_hash, wallet, ts }` to Firestore `verifications`
- Enforce one-proof-per-poll via unique index on `(pollId, nullifier_hash)`

### 6.3 Create Poll (Creator)
- Form → zod schema → Firestore `polls`
- Deploy/point to PollEscrow contract on Base
- Use Thirdweb write (Engine) to set escrow terms (USDC address, pool, fee=10%)
- Index `PollCreated` via Insight webhook → update Firestore

### 6.4 Complete Poll (Participant)
- Require World ID verified entry for the poll
- On submit, call contract `completeAndPayout(pollId)` with user wallet
- Engine sponsors gas if configured; write off-chain completion record
- Index `Payout` event via Insight to confirm and reconcile

### 6.5 Data Sales (MVP)
- Creator defines dataset export → Agent prepares CSV from Firestore (no PII)
- Optionally emit DataSale contract event for auditability
- Host CSV for time-limited download; log sale with checksum

---

## 7) Security & Compliance
- **Webhooks:** verify signatures (Stripe/Worldcoin/Thirdweb Insight if applicable); respond 2xx only after durable write
- **Reentrancy / Double-spend:** on payouts, rely on contract non-reentrancy + Firestore transaction with idempotency key
- **Receipts:** store images; extract tokens (merchant, product names) and hashed lines for matching; purge images on request
- **Access control:** admin actions require server Engine + role checks on contract
- **Backups:** do not export raw user data; only derived, consented aggregates

---

## 8) PR Checklist (must pass)
- [ ] Types OK; no `any` introduced
- [ ] zod schemas for any new inputs
- [ ] `.env.example` updated
- [ ] No secrets/client leaks
- [ ] Unit tests for critical paths
- [ ] Manual steps documented
- [ ] Rollback plan (revert or feature flag)

---

## 9) Helpful Stubs (to use as canonical)

**`src/lib/thirdweb.ts`**
```ts
import { createThirdwebClient } from "thirdweb";
import { base, baseSepolia } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const chain =
  process.env.NEXT_PUBLIC_CHAIN === "base-sepolia" ? baseSepolia : base;
```

**`src/lib/worldcoin.ts`**
```ts
export type WorldIDProof = {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  credential_type: "orb" | "phone";
  action: string;
  signal?: string;
};

export async function verifyWorldID(proof: WorldIDProof) {
  const res = await fetch("https://developer.worldcoin.org/api/v1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WLD_API_KEY}`,
    },
    body: JSON.stringify(proof),
  });
  if (!res.ok) throw new Error("World ID verification failed");
  const data = await res.json();
  if (!data?.success) throw new Error("Invalid World ID proof");
  return data;
}
```

**`src/lib/contracts.ts`**
```ts
import { getContract } from "thirdweb";
import { client, chain } from "./thirdweb";

export function getEscrow(address: string, abi: any) {
  return getContract({ client, chain, address, abi });
}

export function calcPayout(amount: bigint) {
  // 10% platform fee
  const fee = (amount * 10n) / 100n;
  return { user: amount - fee, fee };
}
```

---

## 10) Contact & Ownership
- Code Owners: @you (Merrell) for app, @agents for automation PRs
- Any deviation from this playbook must be approved in PR with rationale

---

**This playbook is binding for all automation agents and enforceable during code review.**
