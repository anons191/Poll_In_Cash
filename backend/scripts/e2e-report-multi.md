# PollPoolV2 Multi-Agent E2E Test Report

**Date:** 2026-02-19
**Contract:** `0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a`
**Network:** Base Sepolia (84532)

## Test Summary

| Test | Description | Result |
|------|-------------|--------|
| Multi-Agent | 3 agents split pot evenly | ✅ PASS |
| Refund | Cancel returns funds to creator | ✅ PASS |
| Partial Fill | 2/5 slots filled, unused funds split | ✅ PASS |

**All 3 tests passed!**

---

## Test 1: Multi-Agent Distribution

**Poll ID:** 4
**Scenario:** 5 USDC poll, 3 agents respond, close, all claim

### Steps Completed

| Step | Result | Transaction |
|------|--------|-------------|
| Create poll | ✅ | [0x56bc8f59...](https://sepolia.basescan.org/tx/0x56bc8f59) |
| Agent 1 submit | ✅ | [0x0a2b3dec...](https://sepolia.basescan.org/tx/0x0a2b3dec93a662a765f23ad3b03ad276110e5f6ff8d744bb40b94b97d1b7f847) |
| Agent 2 submit | ✅ | [0xaf3f14fc...](https://sepolia.basescan.org/tx/0xaf3f14fc8c4a4cd3ecda00db98529e9ceeca0d4530c70db4328e0101bae7db8f) |
| Agent 3 submit | ✅ | [0x4c12c34f...](https://sepolia.basescan.org/tx/0x4c12c34f165c8b27b2e48960b1cb0c8355c4b9018b6a5a291b09bd93eca332da) |
| Close poll | ✅ | [0xf3703fd2...](https://sepolia.basescan.org/tx/0xf3703fd2dcac782f00ac457796a3ce09661247d726fc6465807d869e2fd055e5) |
| Agent 1 claim | ✅ | [0x2c06abe3...](https://sepolia.basescan.org/tx/0x2c06abe31390998aad3f60f73e0d3ccf781fb1dba0a6d7142ea0eb6b43a59e48) |
| Agent 2 claim | ✅ | [0xfa2f6fd0...](https://sepolia.basescan.org/tx/0xfa2f6fd0b054b005e9c36d8ca802b36135cbdcbd0b92a159cd4f6b4b24727f25) |
| Agent 3 claim | ✅ | [0x656b0352...](https://sepolia.basescan.org/tx/0x656b0352793216191cd6f245f19f798cb2a0976574d8721c1060d942ca3086df) |

### Financial Breakdown

| Item | Amount |
|------|--------|
| Poll funded | 5.00 USDC |
| Platform fee (10%) | 0.50 USDC → Treasury |
| Distributable | 4.50 USDC |
| Participants | 3 |
| **Payout per agent** | **1.50 USDC each** |

### Final Verification

- Poll Status: **Distributed**
- Agent 1 USDC: **1.50**
- Agent 2 USDC: **1.50**
- Agent 3 USDC: **1.50**

**Key Finding:** Funds are evenly split among all participants.

---

## Test 2: Refund Flow

**Poll ID:** 1
**Scenario:** 5 USDC poll, 1 agent responds, creator calls refund()

### Steps Completed

| Step | Result | Transaction |
|------|--------|-------------|
| Agent submit | ✅ | [0xe82d9d1f...](https://sepolia.basescan.org/tx/0xe82d9d1f3877b0951a93a40ab1ddaa90a9533c3b00f9ab63bb6d3e8139d1687d) |
| Creator refund | ✅ | [0xe2172a90...](https://sepolia.basescan.org/tx/0xe2172a907d260f170fea1c1e1a9e0d0e6fb6b2ea6d43bf66479df7f0b1346da9) |

### Refund Verification

| Item | Amount |
|------|--------|
| Poll funded | 5.00 USDC |
| Platform fee (10%) | 0.50 USDC (kept by treasury) |
| Distributable | 4.50 USDC |
| **Creator refund** | **4.50 USDC** |
| **Agent payout** | **0.00 USDC** |

### Final Verification

- Poll Status: **Cancelled**
- Creator received: **4.50 USDC** back
- Agent received: **0.00 USDC** (correct - cancelled polls don't pay respondents)

**Key Finding:** Cancelled polls return distributable funds to creator. Respondents do NOT get paid.

---

## Test 3: Partial Fill

**Poll ID:** 3
**Scenario:** 6 USDC poll, cap 5, only 2 agents respond

### Steps Completed

| Step | Result | Transaction |
|------|--------|-------------|
| Agent 1 submit (previous) | ✅ | (from earlier test run) |
| Agent 2 submit | ✅ | [0xcee97000...](https://sepolia.basescan.org/tx/0xcee97000838116f983a0096e7b5250d4308d135a417132a3651f43cc7e669800) |
| Close poll | ✅ | [0x0b03cf87...](https://sepolia.basescan.org/tx/0x0b03cf870ecefbeb3ad5d655b7cbec8855ef41fb5afabbe0ea246fd52d8a6a0d) |
| Agent 1 claim | ✅ | [0x8757296f...](https://sepolia.basescan.org/tx/0x8757296fd82ab37db867ef8ab3ca466354ffcab7b864292ebc436a14f071f37e) |
| Agent 2 claim | ✅ | [0xb7b74d36...](https://sepolia.basescan.org/tx/0xb7b74d3689d9988513db717176d11d1c75fc76e14671b4b6aa0caba5c3dd6685) |

### Financial Breakdown

| Item | Amount |
|------|--------|
| Poll funded | 6.00 USDC |
| Platform fee (10%) | 0.60 USDC → Treasury |
| Distributable | 5.40 USDC |
| Participant cap | 5 |
| Actual participants | 2 |
| Unfilled slots | 3 |
| **Payout per agent** | **2.70 USDC each** |

### Final Verification

- Poll Status: **Distributed**
- Participants: **2/5** (3 slots unfilled)
- Agent 1 USDC: **2.70**
- Agent 2 USDC: **2.70**

**Key Finding:** Unused slot funds are split among actual participants. Each participant gets MORE than if all slots were filled (2.70 vs 1.08 if 5 participants).

---

## All Transaction Links

### Test 1: Multi-Agent Distribution
- **Agent 1 submit:** https://sepolia.basescan.org/tx/0x0a2b3dec93a662a765f23ad3b03ad276110e5f6ff8d744bb40b94b97d1b7f847
- **Agent 2 submit:** https://sepolia.basescan.org/tx/0xaf3f14fc8c4a4cd3ecda00db98529e9ceeca0d4530c70db4328e0101bae7db8f
- **Agent 3 submit:** https://sepolia.basescan.org/tx/0x4c12c34f165c8b27b2e48960b1cb0c8355c4b9018b6a5a291b09bd93eca332da
- **Close poll:** https://sepolia.basescan.org/tx/0xf3703fd2dcac782f00ac457796a3ce09661247d726fc6465807d869e2fd055e5
- **Agent 1 claim:** https://sepolia.basescan.org/tx/0x2c06abe31390998aad3f60f73e0d3ccf781fb1dba0a6d7142ea0eb6b43a59e48
- **Agent 2 claim:** https://sepolia.basescan.org/tx/0xfa2f6fd0b054b005e9c36d8ca802b36135cbdcbd0b92a159cd4f6b4b24727f25
- **Agent 3 claim:** https://sepolia.basescan.org/tx/0x656b0352793216191cd6f245f19f798cb2a0976574d8721c1060d942ca3086df

### Test 2: Refund Flow
- **Agent submit:** https://sepolia.basescan.org/tx/0xe82d9d1f3877b0951a93a40ab1ddaa90a9533c3b00f9ab63bb6d3e8139d1687d
- **Refund:** https://sepolia.basescan.org/tx/0xe2172a907d260f170fea1c1e1a9e0d0e6fb6b2ea6d43bf66479df7f0b1346da9

### Test 3: Partial Fill
- **Agent 2 submit:** https://sepolia.basescan.org/tx/0xcee97000838116f983a0096e7b5250d4308d135a417132a3651f43cc7e669800
- **Close poll:** https://sepolia.basescan.org/tx/0x0b03cf870ecefbeb3ad5d655b7cbec8855ef41fb5afabbe0ea246fd52d8a6a0d
- **Agent 1 claim:** https://sepolia.basescan.org/tx/0x8757296fd82ab37db867ef8ab3ca466354ffcab7b864292ebc436a14f071f37e
- **Agent 2 claim:** https://sepolia.basescan.org/tx/0xb7b74d3689d9988513db717176d11d1c75fc76e14671b4b6aa0caba5c3dd6685

---

## Contract Links

- **PollPoolV2:** https://sepolia.basescan.org/address/0x7e12a6a4d5f2ee3630ec4350ba2bb38d1a6cfe2a
- **USDC:** https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **Treasury:** https://sepolia.basescan.org/address/0x495721378c27a51a2bd7f176bad570d5148c88d5

---

## Key Findings Summary

1. **Multi-Agent Distribution:** ✅ Verified
   - Funds are evenly split among all participants
   - Each of 3 agents received exactly 1.50 USDC from 4.50 distributable

2. **Refund Flow:** ✅ Verified
   - Cancelled polls return distributable funds to creator
   - Respondents do NOT get paid on cancelled polls
   - Platform fee (10%) is still kept by treasury

3. **Partial Fill:** ✅ Verified
   - Unused slot funds are split among actual participants
   - With 2/5 slots filled, each participant received 2.70 USDC
   - If all 5 slots were filled, each would only get 1.08 USDC
   - **Bonus for early/only responders!**

---

## Conclusion

**All 3 tests passed on Base Sepolia.** The PollPoolV2 contract correctly handles:

| Scenario | Behavior | Verified |
|----------|----------|----------|
| Multi-agent distribution | Funds split evenly among participants | ✅ |
| Refund/cancel | Distributable returns to creator, respondents get nothing | ✅ |
| Partial fill | Unused slots benefit actual participants | ✅ |
| Platform fee | 10% taken on all polls, kept even on refund | ✅ |
| Pull-based claims | Each participant claims their own payout | ✅ |
