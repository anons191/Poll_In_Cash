# Worldcoin-Agent.md — World ID Integration Guide for Poll in Cash Agents

This document defines how Poll in Cash AI agents and services should integrate and work with **Worldcoin’s World ID** system for user verification (proof of personhood). World ID provides a zero-PII, privacy-preserving way to prove one-human-one-vote using zero-knowledge proofs, without requiring personal information storage.

## ✅ Why World ID

- Free to use (no per-user cost)
- Zero-knowledge proof of uniqueness
- Users control their own identity
- No PII ever exposed to or stored by our app
- Wallet-compatible, crypto-native experience

---

## 🔐 1. World ID Concept

World ID allows users to prove:
- They are a **unique human**
- They have not yet voted in a given context (poll)

World ID uses:
- Biometric verification (Orb iris scan)
- A mobile app (World App) for proof generation
- zk-SNARKs for anonymous proof-of-uniqueness

---

## 🔌 2. Frontend Integration (Next.js / JS)

Use **IDKit Widget** from Worldcoin:

```ts
import { IDKitWidget } from '@worldcoin/idkit';

<IDKitWidget
  action="poll-vote-xyz" // Unique identifier for poll session
  onSuccess={(proof) => handleProof(proof)}
  app_id="app_staging_pollincash" // Replace with real app_id
  signal={userWalletAddress}
>
  {({ open }) => <button onClick={open}>Verify with World ID</button>}
</IDKitWidget>
```

- `action` = unique string for the voting session
- `signal` = optional wallet address or session identifier

---

## 📬 3. Backend Proof Verification

Use Worldcoin’s API or SDK to verify the proof returned from the frontend.

### Option 1: Hosted API (recommended)

```ts
POST https://developer.worldcoin.org/api/v1/verify

Headers:
  Authorization: Bearer {API_KEY}
Body:
  {
    merkle_root,
    nullifier_hash,
    proof,
    credential_type,
    action,
    signal
  }
```

### Option 2: On-chain (advanced)

- Use World ID’s contracts to verify proof on Base chain
- Gas efficient: use when running on-chain polls or smart contract gated voting

---

## 🧠 4. Agent Responsibilities

All AI agents that interact with user data must:
- Never store or request PII
- Only check if a user has a valid World ID proof
- Allow users to submit their World ID via the widget or API
- Accept proof once verified and associate it with the poll completion
- Ensure each World ID is used only once per poll (via `nullifier_hash`)

---

## 🔐 5. Privacy & Data

- No personal identity data is accessed or stored
- No photo ID, name, or email is required
- Each proof is **unique per app context** (nullifier_hash is different for each poll)
- Ensures **unlinkability** between apps (apps can't collude to deanonymize)

---

## 🔄 6. Token Gating or Reward Eligibility

Agents can:
- Require successful World ID verification before allowing poll participation
- Use `nullifier_hash` to track participation (1 proof = 1 vote)
- Reject reused proofs for the same `action`

---

## 📚 7. Resources

- [World ID Docs](https://id.worldcoin.org/docs)
- [IDKit JS SDK](https://id.worldcoin.org/docs/verify/using-idkit)
- [API Reference](https://id.worldcoin.org/docs/verify/api)
- [On-chain Verification](https://id.worldcoin.org/docs/verify/using-smart-contracts)

---

## 📦 8. File Structure (Agent Context)

```
/src/lib/worldcoin.ts         ← World ID SDK and verification utils
/components/WorldIDVerify.tsx ← Widget button for user verification
/functions/agents/worldid.ts  ← Agent logic for proof validation
/docs/Worldcoin-Agent.md      ← This file
```

---

This is the official World ID integration plan for Poll in Cash. All agent-based verification flows must comply.
