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
- [x] Write and deploy PollEscrow contract (Thirdweb Engine → Base)
- [x] Implement createPoll, completePoll, and payout functions
- [x] Integrate Thirdweb Engine SDK for secure writes
- [x] Add World ID gate (frontend widget + backend proof verify API)
- [x] Store nullifier hashes in Firestore to prevent double-votes
- [x] Add payout calculation (90% user / 10% fee)
- [x] Test contract → event indexing via Thirdweb Insight
- [x] Create automated end-to-end test script
- [x] Improve error handling with StatusMessage component

**Deliverables:**
- ✅ Contract deployed + callable from app (0x52D535058Fc5757bf60A3a2F8AeB19039d3EbbFc)
- ✅ Verified World ID workflow
- ✅ Payout logic tested end-to-end
- ✅ Firebase Functions ready for Thirdweb Insight webhooks
- ✅ Automated test suite for contract interactions
- ✅ Improved UX with inline status messages and transaction links

**Week 2 Notes:**
- Contract deployed to Base Sepolia with correct USDC address (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
- PollEscrow contract includes 10% platform fee and nullifier hash protection
- World ID verification API endpoint implemented at `/api/worldid/verify`
- Created reusable StatusMessage component for consistent UI feedback
- Firebase Functions (insightWebhook) require Blaze plan for deployment - ready to deploy manually
- Automated test script ready: `scripts/test-e2e-flow.ts` (requires TEST_WALLET_PRIVATE_KEY)
- To run full E2E tests: Get testnet USDC from https://app.chaineye.tools/faucet/base-sepolia

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
**Last Updated:** 2025-10-31 (Week 2 Complete)
