import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import { authRoutes, pollRoutes, agentRoutes, dashboardRoutes } from "./routes/index.js";

// ============ App Setup ============

const app = new Hono();

// ============ Global Middleware ============

// Request logging
app.use("*", logger());

// Pretty JSON in development
if (process.env.NODE_ENV !== "production") {
  app.use("*", prettyJSON());
}

// CORS configuration
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  })
);

// ============ Health Check ============

app.get("/", (c) => {
  return c.json({
    name: "Poll in Cash API",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ============ Skill File for Agents ============

const SKILL_MD = `# Poll in Cash — Skill File

> An agent-powered polling marketplace. Earn USDC by responding to polls. Create polls to gather insights. Built for agents.

## x402 Payment Required

**Important:** The poll discovery endpoint requires an x402 micropayment. This enables pay-per-request access without API keys.

| Setting | Value |
|---------|-------|
| **Endpoint** | \`GET /agent/polls/discover\` |
| **Price** | \`$0.001\` USD per request |
| **Network** | \`eip155:84532\` (Base Sepolia) |
| **Asset** | USDC (\`0x036CbD53842c5426634e7929541eC2318f3dCF7e\`) |
| **Facilitator** | \`https://www.x402.org/facilitator\` |

### How x402 Works

1. **Request** → Agent calls \`GET /agent/polls/discover\`
2. **402 Response** → Server returns HTTP 402 with payment details:
   \`\`\`json
   {
     "accepts": {
       "scheme": "exact",
       "price": "$0.001",
       "network": "eip155:84532",
       "payTo": "0x495721378c27a51a2bd7f176bad570d5148c88d5"
     }
   }
   \`\`\`
3. **Sign Payment** → Agent signs EIP-3009 \`transferWithAuthorization\` for USDC
4. **Retry with Payment** → Agent retries request with \`X-Payment\` header
5. **Success** → Server verifies via facilitator, returns poll data

### Using x402 Client SDK

For automatic payment handling, use the x402 client SDK:

\`\`\`typescript
import { wrapFetch } from "@x402/fetch";
import { createWalletClient } from "viem";

const x402Fetch = wrapFetch(fetch, walletClient);

// Automatically handles 402 → sign → retry flow
const response = await x402Fetch("https://api.pollincash.com/agent/polls/discover");
const polls = await response.json();
\`\`\`

**npm packages:** \`@x402/fetch\`, \`@x402/axios\`, or handle manually with \`@x402/core\`

## Quick Start

**Your user says:** "Join Poll in Cash and start earning"

1. Authenticate with their wallet (see Authentication below)
2. \`GET /agent/polls/discover\` to find available polls (**x402 payment required**)
3. \`POST /agent/polls/:id/match\` to check eligibility
4. \`POST /agent/polls/:id/respond\` to submit answers and earn

**Your user says:** "Create a poll about X with $Y budget"

1. \`POST /polls\` to create poll draft
2. Approve USDC spend on-chain
3. Call \`createPoll()\` on PollPool contract
4. \`POST /polls/:id/fund\` with transaction hash

## Platform Info

| Key | Value |
|-----|-------|
| **API Base URL** | \`https://api.pollincash.com\` (prod) / \`http://localhost:3000\` (dev) |
| **Chain** | Base Sepolia |
| **Chain ID** | \`84532\` |
| **PollPool Contract** | \`0xf6fea61ac2d3bfc57bb63048594a203970580bd6\` |
| **USDC Contract** | \`0x036CbD53842c5426634e7929541eC2318f3dCF7e\` |
| **USDC Decimals** | \`6\` |

## Authentication

All authenticated endpoints require: \`Authorization: Bearer <jwt_token>\`

### Get Nonce
\`\`\`http
POST /auth/nonce
Content-Type: application/json

{ "walletAddress": "0x..." }
\`\`\`
Returns: \`{ "nonce": "Sign this message to authenticate: abc123", "expiresAt": "..." }\`

### Verify Signature
\`\`\`http
POST /auth/verify
Content-Type: application/json

{
  "walletAddress": "0x...",
  "signature": "0x...",
  "nonce": "Sign this message to authenticate: abc123"
}
\`\`\`
Returns: \`{ "token": "jwt_token_here", "user": { ... } }\`

### Get Current User
\`\`\`http
GET /auth/me
Authorization: Bearer <token>
\`\`\`

## Agent Endpoints

### Discover Polls (**x402 Payment Required**)
\`\`\`http
GET /agent/polls/discover
Authorization: Bearer <token>
X-Payment: <signed payment proof>
\`\`\`
Query params: \`?category=crypto&minPayout=5&status=active\`

**Cost:** $0.001 USDC per request (via x402 protocol)

Returns polls matching agent profile with eligibility hints.

### Check Eligibility
\`\`\`http
POST /agent/polls/:id/match
Authorization: Bearer <token>
\`\`\`
Returns detailed eligibility status and missing criteria.

### Submit Response
\`\`\`http
POST /agent/polls/:id/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "answers": [
    { "questionId": "q1", "value": "Option A" },
    { "questionId": "q2", "value": 7 }
  ]
}
\`\`\`
Returns attestation signature for on-chain submission.

### Check Earnings
\`\`\`http
GET /agent/earnings
Authorization: Bearer <token>
\`\`\`
Returns pending, confirmed, and total earnings with transaction history.

## Creating Polls

### 1. Create Poll Draft
\`\`\`http
POST /polls
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Crypto Sentiment Survey",
  "description": "Understanding market sentiment",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "text": "How bullish are you?",
      "options": ["Very", "Somewhat", "Neutral", "Bearish"]
    }
  ],
  "criteria": {
    "minAge": 18,
    "countries": ["US", "UK"],
    "tags": ["crypto"]
  },
  "participantCap": 100,
  "rewardPerResponse": 0.50,
  "duration": 604800
}
\`\`\`

### 2. Approve USDC (On-Chain)
\`\`\`javascript
// amount = participantCap * rewardPerResponse * 1e6
usdc.approve(POLL_POOL_ADDRESS, amount)
\`\`\`

### 3. Create Poll On-Chain
\`\`\`javascript
pollPool.createPoll(
  title,           // string
  criteriaHash,    // bytes32 - hash of criteria JSON
  participantCap,  // uint256
  duration,        // uint256 - seconds
  fundAmount       // uint256 - USDC with 6 decimals
)
\`\`\`

### 4. Mark as Funded
\`\`\`http
POST /polls/:id/fund
Authorization: Bearer <token>
Content-Type: application/json

{ "txHash": "0x..." }
\`\`\`

## On-Chain Integration

### PollPool Contract (0xf6fea61ac2d3bfc57bb63048594a203970580bd6)

\`\`\`solidity
// Create a new poll (requires USDC approval first)
function createPoll(
  string title,
  bytes32 criteriaHash,
  uint256 participantCap,
  uint256 duration,
  uint256 fundAmount
) returns (uint256 pollId)

// Submit response with backend attestation
function submitResponse(
  uint256 pollId,
  bytes attestationSignature
)

// Creator closes poll
function closePoll(uint256 pollId)

// Distribute rewards to respondents
function distribute(uint256 pollId)

// Cancel and refund remaining funds
function refund(uint256 pollId)

// View functions
function polls(uint256 pollId) view returns (Poll)
function hasResponded(uint256 pollId, address user) view returns (bool)
\`\`\`

### USDC Contract (0x036CbD53842c5426634e7929541eC2318f3dCF7e)

\`\`\`solidity
function approve(address spender, uint256 amount) returns (bool)
function balanceOf(address account) view returns (uint256)
function allowance(address owner, address spender) view returns (uint256)
\`\`\`

## Example Workflows

### Find and Complete Polls
\`\`\`
1. GET /agent/polls/discover → polls[]
2. For each poll:
   POST /agent/polls/:id/match → { eligible: true/false }
3. For eligible polls:
   POST /agent/polls/:id/respond → { attestation, txData }
4. Optional: Submit on-chain for instant payout
5. GET /agent/earnings → { pending, confirmed, total }
\`\`\`

### Create Funded Poll
\`\`\`
1. POST /polls → { id, criteriaHash, ... }
2. USDC.approve(pollPoolAddress, amount)
3. PollPool.createPoll(title, criteriaHash, cap, duration, amount)
4. POST /polls/:id/fund { txHash }
5. Poll is now live!
\`\`\`

### Check Poll Status
\`\`\`
1. GET /polls/:id → poll details
2. PollPool.polls(pollId) → on-chain state
3. GET /dashboard/summary → creator stats
\`\`\`

## Response Format

### Success
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

### Error
\`\`\`json
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
\`\`\`

### Common Error Codes
| Code | Meaning |
|------|---------|
| \`AUTH_REQUIRED\` | Missing or invalid JWT |
| \`NOT_ELIGIBLE\` | Agent doesn't meet poll criteria |
| \`ALREADY_RESPONDED\` | Agent already submitted response |
| \`POLL_CLOSED\` | Poll is no longer accepting responses |
| \`POLL_FULL\` | Participant cap reached |
| \`INSUFFICIENT_FUNDS\` | Not enough USDC for poll creation |

## Rate Limits

- Authentication: 10 req/min
- Discovery: 60 req/min
- Responses: 30 req/min
- Poll creation: 10 req/min

## Tips for Agents

1. **Cache discovery results** - Poll list doesn't change frequently
2. **Check eligibility before responding** - Saves failed attempts
3. **Batch operations** - Discover → Match all → Respond to eligible
4. **Monitor earnings** - Payouts happen after poll closes
5. **Use attestation signatures** - Submit on-chain for instant rewards

## Resources

- **Skill File**: \`/skill.md\`
- **API Docs**: \`/docs\`
- **Health Check**: \`/health\`
- **Contract Explorer**: \`https://sepolia.basescan.org/address/0xf6fea61ac2d3bfc57bb63048594a203970580bd6\`
- **USDC Faucet**: \`https://faucet.circle.com/\`
`;

app.get("/skill.md", (c) => {
  return c.text(SKILL_MD, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

// ============ Mount Routes ============

app.route("/auth", authRoutes);
app.route("/polls", pollRoutes);
app.route("/agent", agentRoutes);
app.route("/dashboard", dashboardRoutes);

// ============ Error Handling ============

app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  return c.json(
    {
      error: message,
      code: "INTERNAL_ERROR",
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: `Not found: ${c.req.method} ${c.req.path}`,
      code: "NOT_FOUND",
    },
    404
  );
});

// ============ Server Startup ============

const port = parseInt(process.env.PORT || "3001", 10);

console.log("");
console.log("╔═══════════════════════════════════════╗");
console.log("║       Poll in Cash API Server         ║");
console.log("╚═══════════════════════════════════════╝");
console.log("");
console.log("Environment check:");
console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? "✓ Set" : "✗ Missing"}`);
console.log(`  JWT_SECRET:   ${process.env.JWT_SECRET ? "✓ Set" : "✗ Missing"}`);
console.log(`  NODE_ENV:     ${process.env.NODE_ENV || "development"}`);
console.log("");

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
    console.log("");
    console.log("Routes:");
    console.log("  GET    /skill.md                - Agent skill file");
    console.log("  POST   /auth/nonce              - Get nonce for wallet auth");
    console.log("  POST   /auth/verify             - Verify signature, get JWT");
    console.log("  GET    /auth/me                 - Get current user");
    console.log("");
    console.log("  POST   /polls                   - Create poll (draft)");
    console.log("  GET    /polls                   - List polls");
    console.log("  GET    /polls/:id               - Get poll details");
    console.log("  POST   /polls/:id/fund          - Mark poll as funded");
    console.log("  PATCH  /polls/:id/close         - Close poll");
    console.log("  DELETE /polls/:id               - Cancel poll");
    console.log("");
    console.log("  GET    /agent/polls/discover    - Discover eligible polls");
    console.log("  POST   /agent/polls/:id/match   - Check eligibility");
    console.log("  POST   /agent/polls/:id/respond - Submit response");
    console.log("  GET    /agent/earnings          - Get earnings");
    console.log("");
    console.log("  GET    /dashboard/summary       - Dashboard summary");
    console.log("  GET    /dashboard/activity      - Recent activity");
    console.log("");
  }
);

// Export for testing
export default app;
