# Thirdweb-Agent.md — Integration Guide for Poll in Cash Agents

This document defines how all agents and backend services in Poll in Cash should interact with the blockchain using **Thirdweb**. All blockchain logic (contracts, wallets, transactions, event indexing, gasless UX) must be implemented via **Thirdweb SDKs**, **Thirdweb Engine**, or **Thirdweb Insight** — targeting the **Base** blockchain.

## 🔐 1. Thirdweb Credentials

- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` → used in frontend for wallet connect, contract hooks.
- `THIRDWEB_SECRET_KEY` → used in backend agents (not exposed to client).

Store both in environment variables. **Never expose `THIRDWEB_SECRET_KEY` on frontend.**

## 🔌 2. Contract Access (SDK / Engine)

### 2.1 Frontend Access (React)

Use the Thirdweb React SDK:

```ts
import { getContract, useContractRead, useContractWrite } from "thirdweb/react";

const { contract } = useContract("<address>");
const { data } = useContractRead(contract, "rewardPerComplete");
```

### 2.2 Backend Access (Server SDK)

Used in Firebase Functions or agents:

```ts
import { createThirdwebClient, getContract } from "thirdweb";
const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });

const contract = getContract({ client, address: "<contract_address>", chain: base, abi });
await contract.write("markCompleteAndPay", [user, signature]);
```

Use `@thirdweb-dev/sdk` v5+ or newer TS SDK.

## 🔗 3. Chain Config (Base L2)

Use predefined chain object:

```ts
import { base } from "thirdweb/chains";

const contract = getContract({ client, chain: base, ... });
```

Chain ID: `8453` (mainnet), or `84532` (Base Sepolia testnet).

## 🧠 4. Wallet Connection

Frontend should use:

```ts
import { ConnectButton } from "thirdweb/react";
<ConnectButton client={client} />
```

Configure with `activeChain="base"` in `ThirdwebProvider`.

## 🛠️ 5. Contract Deployment

- Deploy contracts via `npx thirdweb deploy` or the [Thirdweb dashboard](https://thirdweb.com/dashboard).
- Target the Base network.
- Copy deployed addresses into environment variables.
- Dashboard allows ABI browsing, function testing, role management.

## 🧾 6. Event Indexing (Insight)

Use Thirdweb Insight to track contract events:

### REST Polling
```ts
fetch("https://8453.insight.thirdweb.com/v1/<client_id>/events/<contract_addr>/<event_signature>")
```

### Webhooks (Preferred)
Agents can register Insight webhook subscriptions:
- Trigger on `PollCompleted`, `Paid`, or `Purchased` events.
- Route data to Firebase Functions.

## ⚡ 7. Gas Sponsorship (EIP-7702 or 4337)

Use gasless transactions to improve UX.

### For Smart Wallets (EIP-4337)
```ts
import { smartWallet, embeddedWallet, metamaskWallet } from "thirdweb/wallets";

const wallet = smartWallet({
  factoryAddress,
  gasless: true,
  client,
  personalWallets: [metamaskWallet(), embeddedWallet()]
});
```

### For EOAs (EIP-7702)
```ts
const wallet = embeddedWallet({
  executionMode: { mode: "EIP7702", sponsorGas: true }
});
```

Paymasters auto-configured for common use cases.

## 🛰️ 8. Engine (Relayer API)

Use Thirdweb Engine for backend relayed txs:

```ts
POST https://api.thirdweb.com/v1/transactions
Headers:
  Authorization: Bearer <secret_key>
Body:
  { contractAddress, encodedFunction, chainId, ... }
```

Or use the server SDK:

```ts
const sdk = createThirdwebSDK({ secretKey });
await sdk.getContract(addr).write("function", [...args]);
```

Used for: payouts, refunds, dataset listings, admin writes.

## 🔐 9. Security Guidelines

- Never expose `THIRDWEB_SECRET_KEY` to frontend.
- Use `.env` and Firebase secret config for secure storage.
- Validate event data from Insight (don't trust blindly).
- Use Insight with pagination or webhooks — not high-frequency polling.

## 📦 10. File Structure Example

```
/src/lib/thirdweb.ts      ← client + base chain
/src/lib/contracts.ts     ← contract wrappers
/functions/agents/        ← server-side SDK + Engine API calls
.env.local                ← keys
/docs/Thirdweb-Agent.md   ← this file
```

## ✅ 11. Responsibilities

All agents that interact with contracts must:
- Use Thirdweb for all write/read txs.
- Log transactions with `logs/agent_runs/{}`.
- Use Engine for backend txs (payouts, refunds, listings).
- Use Insight for event-based triggers (poll completions, purchases).

## 📚 12. Resources

- [Thirdweb SDK Docs](https://portal.thirdweb.com/typescript)
- [Thirdweb Insight Docs](https://portal.thirdweb.com/insight)
- [Thirdweb Gas Sponsorship](https://portal.thirdweb.com/wallets/gasless)
- [Base Support in Thirdweb](https://portal.thirdweb.com/deploy/deploying-to-base)
- [Engine & Transactions API](https://portal.thirdweb.com/engine)

---

This document is enforced in code review. All blockchain interactions must comply.
