# Poll in Cash — 4-Week Development Plan

**Objective:** Deliver the full MVP of Poll in Cash within 4 weeks, including wallet-based authentication, World ID verification, USDC reward payouts on Base, and data export features.

---

## WEEK 1 — Foundations & Infrastructure
**Goal:** Establish core stack, repository, environment setup, and authentication pipeline.

### Tasks
- [x] Initialize Next.js + TypeScript app structure
- [x] Configure Firebase project (Firestore, Storage, Functions)
- [x] Add TailwindCSS + shadcn/ui for UI (TailwindCSS complete; shadcn/ui optional)
- [x] Setup Thirdweb SDK + connect to Base chain
- [x] Create environment files (.env, .env.example)
- [x] Connect GitHub + initial CI check (lint + typecheck)
- [x] Deploy staging build to Vercel or Firebase Hosting (Vercel configured)
- [x] Write initial `thirdweb.ts`, `firebase.ts`, `worldcoin.ts` scaffolds

**Deliverables:**
- ✅ Base app online (staging) - Ready for Vercel deployment
- ✅ Firebase and Thirdweb integrated
- ✅ Typecheck, lint, build pipeline passes

---

## WEEK 2 — Contracts, Wallets & Verification
**Goal:** Implement smart contract escrow and integrate Worldcoin ID verification.

### Tasks
- [ ] Write and deploy PollEscrow contract (Thirdweb Engine → Base)
- [ ] Implement createPoll, completePoll, and payout functions
- [ ] Integrate Thirdweb Engine SDK for secure writes
- [ ] Add World ID gate (frontend widget + backend proof verify API)
- [ ] Store nullifier hashes in Firestore to prevent double-votes
- [ ] Add payout calculation (90% user / 10% fee)
- [ ] Test contract → event indexing via Thirdweb Insight

**Deliverables:**
- ✅ Contract deployed + callable from app
- ✅ Verified World ID workflow
- ✅ Payout logic tested end-to-end

---

## WEEK 3 — Poll UI, Payouts & Data Flow
**Goal:** Complete user-facing polling flows with verified entry and automatic payout.

### Tasks
- [ ] Build Creator Dashboard (create/manage polls)
- [ ] Add participant view (World ID verify + answer submission)
- [ ] Integrate on-submit payout logic
- [ ] Sync contract events to Firestore (via Insight webhooks)
- [ ] Display poll history + reward receipts in UI
- [ ] Add Firestore validation rules for responses/verifications
- [ ] Test full flow: connect → verify → complete → payout

**Deliverables:**
- ✅ Working poll participation flow
- ✅ Firestore + Thirdweb events synchronized
- ✅ UI supports verified payouts

---

## WEEK 4 — Data Export, QA & Launch
**Goal:** Wrap up MVP, testing, and release candidate.

### Tasks
- [ ] Implement CSV export for poll results (Firebase Storage)
- [ ] Add admin console for viewing polls and payouts
- [ ] QA all flows (wallet connect, verification, payouts, export)
- [ ] Design and deploy marketing/landing page
- [ ] Beta launch prep (announcement post, visuals)
- [ ] Set up analytics tracking for poll completions

**Deliverables:**
- ✅ Live MVP with verified participants
- ✅ CSV export ready for creators
- ✅ QA signoff + beta announcement

---

## MVP SUCCESS CRITERIA
| Metric | Target |
|---------|---------|
| Verified participants | 1,000+ |
| Completed polls | 100+ |
| Avg payout time | < 1 minute |
| Contract success rate | 99%+ |
| Data export errors | < 2% |

---

## POST-MVP (Month 2+)
- Add Data Buyer marketplace
- Creator subscription tiers
- DAO voting for poll ranking
- Mobile app rollout

---

**Maintainer:** Merrell Acosta  
**File:** `/docs/WEEKLY_PLAN.md`  
**Last Updated:** 2025-10-31
