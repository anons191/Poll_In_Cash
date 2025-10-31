# Firebase-Agents.md — Poll in Cash Expectations & Patterns

> How every agent and backend component should interact with **Firebase** for the Poll in Cash MVP. Covers Firestore schemas, Storage conventions, Functions triggers/HTTP endpoints, idempotency, retries, logging/metrics, and security rules. Opinionated so our agents behave consistently.

---

## 0) Design Principles

- **Least PII**: store only what we must (verification status, provider tokens, derived tags). Never persist raw identity docs or receipt images after processing.
- **Deterministic & Idempotent**: all agents accept `idempotency_key` and are safe to retry without side effects.
- **Event-Driven**: prefer Firestore/Storage triggers and on-chain listeners writing back to Firestore. UI hits HTTP endpoints that enqueue work.
- **Observable**: every agent writes a `logs/agent_runs/{run_id}` record with timings, inputs HMAC, and status. Use structured logs.
- **Time-Bound Links**: signed URLs expire; API keys are scoped with TTL.
- **Strong Isolation**: service accounts are least-privileged; production and staging are separate projects & datasets.

---

## 1) Firestore Data Model (Collections & Shapes)

> Collection names and representative document shapes. Use snake_case keys. Always include `created_at` and `updated_at` (server timestamps).

### 1.1 `users/{uid}`
```json
{
  "wallet": "0x...",
  "roles": ["respondent","creator","buyer"],
  "stripe_identity_status": "unverified|verified|requires_input",
  "consent": { "doc_scan": true, "data_resale": true },
  "notification_prefs": { "email": true, "sms": false },
  "created_at": "...",
  "updated_at": "..."
}
```

### 1.2 `profiles/{uid}`
```json
{
  "tags": ["bought.brand=RanchersChoice","bought.category=steak","bought.frequency=often"],
  "segments": ["steak_buyers_recent_30d"],
  "quality_score": 0.92,
  "updated_at": "..."
}
```

### 1.3 `polls/{poll_id}`
```json
{
  "creator_uid": "uid",
  "title": "Beef brand preference 2025",
  "reward": 1000000,  // USDC 6dp (1.00 USDC = 1_000_000)
  "cap": 250,
  "targeting_rules": {
    "required": ["bought.category=steak"],
    "brand": "RanchersChoice",
    "date_window_days": 30,
    "min_frequency": 2
  },
  "escrow_address": "0x...",
  "status": "draft|live|paused|closed",
  "created_at": "...",
  "updated_at": "..."
}
```

### 1.4 `completions/{poll_id}_{uid}` (flat collection for simpler queries)
```json
{
  "poll_id": "poll123",
  "uid": "uid123",
  "started_at": "...",
  "finished_at": "...",
  "checks": { "time_on_task_ms": 74000, "attention_passed": true },
  "model_signals": { "entropy": 0.71, "free_text_score": 0.88 },
  "verdict": "pending|valid|invalid|manual_review",
  "oracle_sig": null,
  "sig_expires_at": null,
  "tx_status": "pending|confirmed|failed",
  "tx_hash": null,
  "created_at": "...",
  "updated_at": "..."
}
```

### 1.5 `payout_logs/{poll_id}_{uid}`
```json
{
  "poll_id": "poll123",
  "uid": "uid123",
  "amount": 900000,    // net to user
  "fee": 100000,       // 10%
  "tx_hash": "0x...",
  "block_time": 1730253000,
  "created_at": "..."
}
```

### 1.6 `ocr_jobs/{job_id}`
```json
{
  "uid": "uid123",
  "image_path": "uploads/temp/uid123/abc.jpg",
  "status": "queued|ocr_done|parsed|tagged|error",
  "ocr_confidence": 0.84,
  "used_provider": "vision|textract|openai_vision",
  "error": null,
  "created_at": "...",
  "updated_at": "..."
}
```

### 1.7 `datasets/{dataset_id}`
```json
{
  "poll_ids": ["poll123"],
  "schema": { "fields": ["age_bin","brand","choice","rating"] },
  "anonymization": { "k": 10, "bins": { "age": [18,24,34,44,54,64,99] } },
  "price_usdc": 50000000,  // 50 USDC
  "delivery": { "csv_url": null, "api_scope": "dataset_id:poll123" },
  "sales_count": 0,
  "created_at": "...",
  "updated_at": "..."
}
```

### 1.8 `purchases/{purchase_id}`
```json
{
  "buyer_uid": "uidB",
  "dataset_id": "ds_123",
  "tx_hash": "0x...",
  "api_key": "pica_...",
  "expires_at": 1732850000,
  "created_at": "..."
}
```

### 1.9 `logs/agent_runs/{run_id}`
```json
{
  "agent": "ocr_orchestrator",
  "status": "success|failed",
  "latency_ms": 3210,
  "input_hmac": "sha256:...",
  "output_hmac": "sha256:...",
  "error": null,
  "created_at": "..."
}
```

> **Indexes**: add composite indexes on `completions` by `poll_id`, `uid`, `tx_status`; on `payout_logs` by `poll_id` and `uid`; on `purchases` by `dataset_id`, `buyer_uid`.

---

## 2) Storage Layout (Temporary & Derived)

- Raw uploads go to: `uploads/temp/{uid}/{uuid}.{ext}` (scanned, EXIF-stripped).
- After OCR + parsing: **delete** the raw file.
- Derived CSVs live at: `datasets/{dataset_id}/export.csv` (private; served via signed URL with short expiry).
- Disable public listing; bucket is private by default.

---

## 3) Cloud Functions (v2) — HTTP & Triggers

> Use TypeScript. Keep handlers thin; push heavy work to small, composable modules.

### 3.1 HTTP Endpoints (Callable/HTTPS)

- `POST /agents/receipt_intake:start`
  - Body: `{ uid, upload_url, media_metadata, idempotency_key }`
  - Creates `ocr_jobs/{id}` with `status=queued`.
  - Returns `{ receipt_job_id }`

- `POST /agents/dataset:build_and_list`
  - Body: `{ dataset_id, poll_ids[], fields[], anonymization_level, price_usdc, idempotency_key }`
  - Builds CSV, writes `datasets/{dataset_id}`, lists on-chain via DataSaleManager.

- `POST /agents/oracle:sign_completion`
  - Body: `{ poll_id, uid, idempotency_key }`
  - Re-checks completion record; if `verdict=valid` and not paid, signs & broadcasts tx.

- `POST /agents/matching:refresh_for_user`
  - Body: `{ uid }` → recompute top matches and write `matches/{uid}` document.

### 3.2 Firestore Triggers

- `onDocumentCreated("ocr_jobs/{id}")` → run OCR orchestrator (primary OCR → fallback → set `ocr_done`).  
- `onDocumentUpdated("ocr_jobs/{id}")` where `status` transitions to `ocr_done` → call Parser/Tagger, then profile tagging.  
- `onDocumentUpdated("profiles/{uid}")` tags changed → Matching Agent recomputes feed (throttled).  
- `onDocumentCreated("completions/{poll_id_uid}")` → if checks pass set `verdict=pending`; when UI finishes, an evaluator sets `valid|invalid`.  
- `onDocumentUpdated("completions/{poll_id_uid}")` where `verdict=valid` and `tx_status=pending` → Oracle Signer Agent.

### 3.3 Scheduled (Cron)

- `every 10 minutes` — Admin Moderation Agent (cluster anomalies, IP velocity, duplicate devices).  
- `daily` — purge expired CSV signed URLs & stale API keys; rotate KMS-wrapped secrets if policy requires.

---

## 4) Code Patterns (TypeScript Examples)

### 4.1 Firestore Helpers
```ts
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const db = getFirestore();

export const now = () => FieldValue.serverTimestamp();
export const upsert = async (col: string, id: string, data: any) =>
  db.collection(col).doc(id).set({ ...data, updated_at: now() }, { merge: true });

export const create = async (col: string, data: any) =>
  db.collection(col).add({ ...data, created_at: now(), updated_at: now() });

export const once = async (col: string, id: string) =>
  (await db.collection(col).doc(id).get()).data();
```

### 4.2 Idempotency Guard
```ts
export async function withIdempotency(key: string, run: () => Promise<any>) {
  const ref = db.collection("logs/idempotency_keys").doc(key);
  const snap = await ref.get();
  if (snap.exists) return snap.data(); // already processed
  const res = await run();
  await ref.set({ result: res, created_at: now() });
  return res;
}
```

### 4.3 Structured Agent Run Log
```ts
import crypto from "crypto";

function hmac(obj: any) {
  return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

export async function logRun(agent: string, input: any, output: any, error?: any) {
  await create("logs/agent_runs", {
    agent,
    status: error ? "failed" : "success",
    latency_ms: output?.latency_ms ?? null,
    input_hmac: hmac(input),
    output_hmac: hmac(output),
    error: error ? String(error) : null
  });
}
```

### 4.4 Storage Signed URL (Short TTL)
```ts
import { getStorage } from "firebase-admin/storage";

export async function makeSignedUrl(path: string, minutes = 48 * 60) {
  const bucket = getStorage().bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + minutes * 60 * 1000
  });
  return url;
}
```

### 4.5 Delete Raw Upload
```ts
export async function deleteIfExists(path: string) {
  const bucket = getStorage().bucket();
  try { await bucket.file(path).delete(); } catch {}
}
```

---

## 5) Security Rules (Firestone & Storage)

> Lock down writes to sensitive collections; only backend service accounts perform certain transitions.

### 5.1 Firestore Rules (sketch)
```
// Pseudo-rules; translate to Firebase Security Rules syntax
match /databases/{database}/documents {
  match /users/{uid} {
    allow read: if request.auth.uid == uid;
    allow write: if request.auth.uid == uid;  // only their own prefs, not roles/status
  }

  match /profiles/{uid} {
    allow read: if request.auth.uid == uid;
    allow write: if false; // only agents write tags
  }

  match /polls/{poll_id} {
    allow read: if true;
    allow write: if isCreator(request.auth.uid); // function checks role
  }

  match /completions/{id} {
    allow read: if request.auth.uid != null && isOwnerOrCreator();
    allow write: if request.auth.uid == resource.data.uid; // user writes answers only
  }

  match /payout_logs/{id} {
    allow read: if isOwnerOrCreator();
    allow write: if false; // only agents
  }

  match /datasets/{dataset_id} {
    allow read: if isBuyerOrSeller();
    allow write: if isCreator(request.auth.uid); // builder agent via service account
  }

  match /purchases/{purchase_id} {
    allow read: if request.auth.uid == resource.data.buyer_uid || isAdmin();
    allow write: if false; // created by agent
  }

  match /logs/{doc=**} {
    allow read, write: if isServiceAccount(); // never public
  }
}
```

### 5.2 Storage Rules
- Only allow uploading to `uploads/temp/{uid}/...` by the same `uid`.
- Disallow reading from `uploads/temp/**` for public; only service accounts may read/write.
- `datasets/**` readable only via signed URLs (agents generate short-lived links).

---

## 6) Reliability: Retries, Backoff, Dead Letters

- Use **Functions retry** for transient failures (HTTP 5xx from third parties).
- Implement **exponential backoff** for oracle signing + on-chain sends.
- On repeated failures, write a case to `admin_queue/{id}` for human review.
- For high-volume tasks (e.g., dataset builds), prefer **Cloud Tasks** or chunked workers.

---

## 7) Local Dev & Testing

- **Emulators**: Firestore, Storage, Functions (`firebase emulators:start`). Provide seed scripts for collections (users, polls).
- **Fixtures**: keep `fixtures/receipts/*.jpg` for OCR tests.
- **Unit tests**: schema validators & agents pure functions (Jest). Avoid network in unit tests; mock SDK calls.
- **Integration tests**: run emulators; exercise HTTP endpoints and Firestore triggers end-to-end.

---

## 8) Monitoring & Metrics

- Use **Cloud Logging** structured logs for all agents with `agent`, `run_id`, `latency_ms`, `status`.
- Emit **custom metrics** (e.g., `payout_latency_seconds`, `ocr_confidence_avg`) via Cloud Monitoring (optional).
- Set alerts for: error rate > 2% over 5m, OCR fallback spike, oracle tx failures, and event listener lags.

---

## 9) Data Lifecycle & Deletion

- Raw images: deleted immediately after `status=tagged`.
- User-initiated deletion: remove `profiles/{uid}`, `matches/{uid}`, redact `completions` free-text (keep minimal aggregates if policy allows).
- Datasets: immutable once sold; ensure they contain only anonymized/aggregated data.

---

## 10) Copy/Paste: Minimal HTTP Function (v2)

```ts
// functions/src/http/receiptIntake.ts
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { create } from "../lib/db";
import { logRun } from "../lib/logs";

export const receiptIntake = onRequest({ cors: true }, async (req, res) => {
  const runInput = { path: req.path, body: req.body };
  try {
    const { uid, upload_url, media_metadata, idempotency_key } = req.body;
    // TODO: validate auth & schema

    const jobRef = await create("ocr_jobs", {
      uid, image_path: upload_url, status: "queued"
    });

    await logRun("receipt_intake", runInput, { job_id: jobRef.id });
    res.status(200).json({ receipt_job_id: jobRef.id });
  } catch (e) {
    logger.error(e);
    await logRun("receipt_intake", runInput, null, e);
    res.status(500).json({ error: "internal_error" });
  }
});
```

---

## 11) Enforcement Checklist (PR Review)

- [ ] No raw images or PII persisted beyond processing stage.  
- [ ] All writes include server timestamps.  
- [ ] Functions handle idempotency & retries.  
- [ ] Firestore indexes updated if new queries added.  
- [ ] Security rules adjusted for any new collections.  
- [ ] Structured logs and run IDs present.  
- [ ] Signed URLs expire; no public buckets.  

---

## 12) Open Questions

- Should we move `completions` to subcollections per poll for very large scale (tradeoff: query complexity vs sharding)?  
- Do we need BigQuery export of Firestore for analytics dashboards at MVP?  
- Should we enforce per-user per-day upload caps at rules or agent level (rate limiting)?
