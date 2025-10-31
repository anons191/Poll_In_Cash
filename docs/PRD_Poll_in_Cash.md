# Poll in Cash — Product Requirements Document (PRD)

**Version:** 1.0  
**Author:** Merrell Acosta  
**Date:** 2025-10-31  
**Status:** MVP Scope Approved  

---

## 1. Overview

**Poll in Cash** is a decentralized polling platform that rewards verified users in **USDC on Base** for completing polls.  
It connects **poll creators**, **participants**, and **data buyers** through a trustless system using **smart contracts (Thirdweb)**, **Worldcoin for ID verification**, and **Firebase** for off-chain data handling.

### Mission
Empower users to monetize their opinions while ensuring data integrity, verified participation, and instant crypto payouts.

### Core Principles
- **Proof of Personhood**: Every participant verified via Worldcoin World ID.
- **Instant Rewards**: Smart contract disburses rewards immediately upon completion.
- **No PII Storage**: Personal info never stored in our database.
- **Fair Compensation**: Transparent reward logic, 10% platform fee.
- **Scalable + Trustless**: Thirdweb on Base handles all payouts and escrow.

---

## 2. Goals & Objectives

| Goal | Description | Success Metric |
|------|--------------|----------------|
| ✅ Verified participation | Ensure every respondent is a unique human | 100% verified users via Worldcoin |
| 💵 Instant USDC rewards | Pay users immediately after poll completion | Sub-1 minute payouts per poll |
| 📊 Creator transparency | Allow poll creators to set reward pools | 95% poll fund utilization |
| 🔒 User privacy | No personally identifiable info stored | Zero PII in Firestore |
| 📈 Data resale MVP | Enable poll creators to export aggregated data | CSV export functional by Week 4 |

---

## 3. Target Users

### 3.1 Poll Participants
- Individuals verified via **Worldcoin World ID**
- Want to earn stablecoin rewards for answering polls
- Provide anonymous demographic and purchasing data

### 3.2 Poll Creators
- Brands, researchers, or DAOs conducting paid surveys
- Deposit USDC reward pool + define poll logic
- Access CSV exports or use API to retrieve data

### 3.3 Data Buyers (Phase 2)
- Purchase aggregated poll results via CSV or API
- Verified via same KYC/World ID flow as creators

---

## 4. Core Features (MVP)

| Category | Feature | Description |
|-----------|----------|--------------|
| **Auth** | Wallet connect | Thirdweb ConnectKit + Base chain |
| | World ID verify | IDKit widget → proof verification API |
| **Poll Creation** | Creator dashboard | Create polls, set reward pool, define per-user payout |
| | Smart contract escrow | Thirdweb Engine deploys & manages USDC pool |
| **Poll Participation** | Proof gate | User must verify World ID before poll access |
| | Instant payout | Contract executes payout upon completion (minus 10% fee) |
| **Data Storage** | Firestore | Store poll metadata, anonymized responses |
| **OCR/AI Matching** | Receipt upload (optional) | Image upload → OCR → AI category tagging |
| **Data Export** | CSV download | Poll creators can export their results |
| **Payments** | USDC payout | Automated from contract escrow |
| **Notifications** | Email/SMS alerts | Firebase functions + SendGrid/Twilio |
| **Admin Controls** | Fraud review (future) | Admin dashboard for dispute resolution |

---

## 5. System Architecture

### Frontend
- Next.js (TypeScript)
- Thirdweb React SDK
- IDKit for World ID widget
- Tailwind UI + shadcn/ui components

### Backend / Infra
- Firebase (Auth, Firestore, Storage, Functions)
- Thirdweb Engine for contract writes
- Thirdweb Insight for event indexing
- OpenAI (for OCR receipt parsing)
- SendGrid/Twilio (for notifications)

### Smart Contracts
- **PollEscrow.sol** (Thirdweb deployed)
  - Holds USDC reward pool
  - Tracks participation
  - Executes payouts
  - Emits PollCreated, PollCompleted events
- Managed via Thirdweb Engine → Base Chain

### Identity Verification
- Worldcoin World ID (IDKit + Verify API)
  - Proof-of-personhood for one-person-one-vote
  - Zero PII exposure
  - Nullifier hash stored in Firestore to prevent double voting

### Payments
- USDC only (ERC-20 on Base)
- Platform fee = 10% (sent to platform treasury wallet)
- User payout = 90%
- Engine handles transactions + optional gas sponsorship

---

## 6. Data Flow

```
[User Wallet Connects] 
     ↓
[World ID Proof Verified] 
     ↓
[Firestore stores verification hash]
     ↓
[User completes poll]
     ↓
[Smart Contract payout → USDC to wallet]
     ↓
[Event logged via Thirdweb Insight]
     ↓
[Creator retrieves CSV / aggregated data]
```

---

## 7. Database Schema (Firestore)

### Collections

**`polls`**
| Field | Type | Description |
|--------|------|--------------|
| id | string | UUID / contract poll ID |
| creator_wallet | string | Creator’s Base address |
| question | string | Poll question text |
| options | array | Answer options |
| reward_per_user | number | USDC reward per completion |
| total_pool | number | Total reward pool |
| created_at | timestamp | Creation date |

**`verifications`**
| Field | Type | Description |
|--------|------|--------------|
| poll_id | string | Poll ID |
| wallet | string | User wallet address |
| nullifier_hash | string | Unique World ID proof identifier |
| verified_at | timestamp | When user verified |

**`responses`**
| Field | Type | Description |
|--------|------|--------------|
| poll_id | string | Poll reference |
| wallet | string | Respondent wallet |
| answers | array | Selected answers |
| submitted_at | timestamp | Submission time |

---

## 8. Success Metrics (MVP)
| Metric | Target |
|---------|--------|
| Verified unique voters | 1,000+ |
| Average payout time | < 60 seconds |
| Smart contract failure rate | < 1% |
| Data export errors | < 2% |
| Poll creation success | > 95% |

---

## 9. Timeline (4-Week MVP)

| Week | Focus | Deliverables |
|------|--------|--------------|
| **1** | Setup & Infrastructure | Firebase, Thirdweb, repo setup, environment keys |
| **2** | Contracts + Auth | PollEscrow contract, wallet connect, World ID verification |
| **3** | Frontend + Logic | Poll creation, participation, payout UI |
| **4** | Testing + Exports | CSV export, Insight event testing, QA, launch |

---

## 10. Future Features (Post-MVP)

- **On-chain governance** for poll ranking
- **DAO participation** (polls for token holders)
- **Advanced analytics dashboards**
- **Creator subscription tiers**
- **Data buyer marketplace**
- **Mobile app version**
- **Gasless voting sponsorships**

---

## 11. Risks & Mitigation

| Risk | Mitigation |
|------|-------------|
| Fraudulent participants | World ID gating |
| Smart contract exploit | Use audited Thirdweb templates |
| Gas spikes on Base | Engine sponsorship / batch payouts |
| PII exposure | Never store raw data |
| OCR misclassification | Manual correction option + AI retraining |

---

## 12. Definitions
- **Creator:** Entity funding a poll with USDC rewards.
- **Participant:** Verified user completing polls for rewards.
- **PollEscrow:** Smart contract handling reward logic.
- **World ID Proof:** Zero-knowledge proof verifying human uniqueness.

---

## 13. Ownership & Communication

| Role | Name | Responsibility |
|------|------|----------------|
| Product Owner | Merrell Acosta | Vision, scope, approvals |
| Tech Lead | Merrell Acosta | Architecture, implementation |
| Agents | AI Assistants | Support in code, docs, automation |

---

**This PRD defines the MVP scope for Poll in Cash. Any scope or stack changes must be documented in `/docs/CHANGELOG.md`.**

