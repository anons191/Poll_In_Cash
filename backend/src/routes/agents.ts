import { Hono } from "hono";
import {
  getDiscoverablePolls,
  getPollById,
  recordResponse,
  hasAgentResponded,
  getResponseCount,
  getUserEarnings,
  getRecentPayouts,
  getAgentProfileByWallet,
  getOrCreateAgentProfile,
  updateAgentProfile,
  getAgentResponse,
  updateResponseTxHash,
  getClaimablePayouts,
  getPayoutForAgent,
  updatePayoutAsClaimed,
} from "../db/queries.js";
import { requireAuth, getUser, optionalAuth } from "../middleware/auth.js";
import { checkCanSubmitResponse, isAuthorized } from "../auth/ownership.js";
import {
  validateBody,
  validateQuery,
  submitResponseSchema,
  matchRequestSchema,
  discoverQuerySchema,
  syncAttestationsSchema,
  type DiscoverQuery,
  type MatchRequest,
  type SubmitResponseRequest,
  type SyncAttestationsRequest,
} from "../middleware/validate.js";
import type { PollCriteria, VerifiedAttributes } from "../db/schema.js";
import type { AppEnv } from "../types/hono.js";
import { createAttestationSignature } from "../services/attestation.js";
import { toWalletAddress } from "../types/wallet.js";

const agents = new Hono<AppEnv>();

// Note: x402 payment middleware disabled for MVP
// The x402 facilitator doesn't support Base mainnet yet
// Core payments work through PollPool contract directly

// ============ Profile Attestation Endpoints ============

/**
 * POST /agent/profile/attestations
 * Sync verified attributes from local document verification
 * Only accepts boolean flags and derived attributes - never raw document data
 */
agents.post(
  "/profile/attestations",
  requireAuth,
  validateBody(syncAttestationsSchema),
  async (c) => {
    const user = getUser(c);
    const body = c.get("validatedBody") as unknown as SyncAttestationsRequest;

    // Ensure profile exists
    await getOrCreateAgentProfile(user.userId);

    // Count non-undefined attributes
    const attributeCount = Object.entries(body.verifiedAttributes).filter(
      ([, value]) => value !== undefined
    ).length;

    // Update the profile with new verified attributes
    const updated = await updateAgentProfile(user.userId, {
      verifiedAttributes: body.verifiedAttributes as VerifiedAttributes,
    });

    if (!updated) {
      return c.json(
        {
          success: false,
          error: "Failed to update profile",
          code: "UPDATE_FAILED",
        },
        500
      );
    }

    return c.json({
      success: true,
      message: "Attestations synced",
      attributeCount,
      verificationScore: body.verificationScore,
      documentHashesReceived: body.documentHashes?.length ?? 0,
    });
  }
);

/**
 * GET /agent/profile/attestations
 * Get current verified attributes for the authenticated user
 */
agents.get("/profile/attestations", requireAuth, async (c) => {
  const user = getUser(c);

  const profile = await getAgentProfileByWallet(user.walletAddress);

  if (!profile) {
    return c.json({
      verifiedAttributes: {},
      attributeCount: 0,
    });
  }

  const attributeCount = Object.entries(profile.verifiedAttributes || {}).filter(
    ([, value]) => value !== undefined && value !== null
  ).length;

  return c.json({
    verifiedAttributes: profile.verifiedAttributes,
    attributeCount,
    updatedAt: profile.updatedAt.toISOString(),
  });
});

/**
 * Check if verified attributes match poll criteria
 */
function matchesCriteria(
  criteria: PollCriteria,
  attributes: Partial<VerifiedAttributes> & {
    // Self-reported fallbacks
    state?: string;
    age?: number;
    occupation?: string;
  }
): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Get effective values (verified takes precedence over self-reported)
  const effectiveAge = attributes.verifiedAge ?? attributes.age;
  const effectiveState = attributes.verifiedState ?? attributes.state;

  // Check age range
  if (criteria.minAge && (!effectiveAge || effectiveAge < criteria.minAge)) {
    reasons.push(`Minimum age ${criteria.minAge} required`);
  }
  if (criteria.maxAge && (!effectiveAge || effectiveAge > criteria.maxAge)) {
    reasons.push(`Maximum age ${criteria.maxAge} required`);
  }

  // Check state (verified or self-reported)
  if (criteria.states && criteria.states.length > 0) {
    if (!effectiveState || !criteria.states.includes(effectiveState)) {
      reasons.push(`Must be in states: ${criteria.states.join(", ")}`);
    }
  }

  // Check veteran status
  if (criteria.isVeteran === true && attributes.isVeteran !== true) {
    reasons.push("Must be a verified veteran");
  }

  // Check voter registration
  if (criteria.isRegisteredVoter === true && attributes.isRegisteredVoter !== true) {
    reasons.push("Must be a registered voter");
  }

  // Check property owner
  if (criteria.isPropertyOwner === true && attributes.isPropertyOwner !== true) {
    reasons.push("Must be a verified property owner");
  }

  // Check occupation
  if (criteria.occupations && criteria.occupations.length > 0) {
    if (!attributes.occupation || !criteria.occupations.includes(attributes.occupation)) {
      reasons.push(`Must have occupation: ${criteria.occupations.join(" or ")}`);
    }
  }

  return {
    matches: reasons.length === 0,
    reasons,
  };
}

/**
 * GET /agent/polls/discover
 * List eligible polls matching agent profile criteria
 * Optionally filters by verified attributes in query params
 */
agents.get(
  "/polls/discover",
  optionalAuth,
  validateQuery(discoverQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery") as unknown as DiscoverQuery;

    // Build verified attributes from query params
    const attributes: Partial<VerifiedAttributes> = {};
    if (query.isVeteran !== undefined) attributes.isVeteran = query.isVeteran;
    if (query.isRegisteredVoter !== undefined) attributes.isRegisteredVoter = query.isRegisteredVoter;
    if (query.state) attributes.state = query.state;
    if (query.age) attributes.age = query.age;
    if (query.occupation) attributes.occupation = query.occupation;

    // Get all discoverable polls
    const allPolls = await getDiscoverablePolls({
      limit: query.limit,
      offset: query.offset,
    });

    // Filter and enhance with eligibility info
    const eligiblePolls = await Promise.all(
      allPolls.map(async (poll) => {
        const criteria = poll.criteria as PollCriteria;
        const { matches, reasons } = matchesCriteria(criteria, attributes);
        const responseCount = await getResponseCount(poll.id);
        const spotsRemaining = poll.participantCap - responseCount;
        const payoutEstimate =
          spotsRemaining > 0
            ? (parseFloat(poll.cashPoolUsdc) * 0.9) / poll.participantCap
            : 0;

        return {
          id: poll.id,
          title: poll.title,
          description: poll.description,
          cashPoolUsdc: poll.cashPoolUsdc,
          participantCap: poll.participantCap,
          responseCount,
          spotsRemaining,
          payoutEstimate: payoutEstimate.toFixed(6),
          eligible: matches,
          ineligibleReasons: matches ? [] : reasons,
          criteria: poll.criteria,
          expiresAt: poll.expiresAt?.toISOString() ?? null,
        };
      })
    );

    // Optionally filter to only eligible polls
    const filteredPolls = Object.keys(attributes).length > 0
      ? eligiblePolls.filter((p) => p.eligible)
      : eligiblePolls;

    return c.json({
      polls: filteredPolls,
      total: filteredPolls.length,
    });
  }
);

/**
 * POST /agent/polls/:id/match
 * Check if agent profile matches poll criteria
 * Returns eligibility status and payout estimate
 */
agents.post(
  "/polls/:id/match",
  requireAuth,
  validateBody(matchRequestSchema),
  async (c) => {
    const user = getUser(c);
    const pollId = c.req.param("id");
    const { verifiedAttributes } = c.get("validatedBody") as unknown as MatchRequest;

    const poll = await getPollById(pollId);

    if (!poll) {
      return c.json({ error: "Poll not found", code: "POLL_NOT_FOUND" }, 404);
    }

    if (poll.status !== "active") {
      return c.json(
        {
          error: `Poll is ${poll.status}, not accepting responses`,
          code: "POLL_NOT_ACTIVE",
        },
        400
      );
    }

    // Check if already responded
    const alreadyResponded = await hasAgentResponded(pollId, user.walletAddress);

    if (alreadyResponded) {
      return c.json({
        eligible: false,
        alreadyResponded: true,
        reason: "You have already responded to this poll",
      });
    }

    // Check criteria match
    const criteria = poll.criteria as PollCriteria;
    const { matches, reasons } = matchesCriteria(criteria, verifiedAttributes);

    // Calculate payout estimate
    const responseCount = await getResponseCount(pollId);
    const spotsRemaining = poll.participantCap - responseCount;
    const payoutEstimate =
      spotsRemaining > 0
        ? (parseFloat(poll.cashPoolUsdc) * 0.9) / poll.participantCap
        : 0;

    return c.json({
      eligible: matches && spotsRemaining > 0,
      alreadyResponded: false,
      spotsRemaining,
      payoutEstimate: payoutEstimate.toFixed(6),
      ineligibleReasons: matches ? [] : reasons,
      ...(spotsRemaining === 0 && { reason: "Poll has reached participant cap" }),
    });
  }
);

/**
 * POST /agent/polls/:id/respond
 * Submit poll response with attestation
 */
agents.post(
  "/polls/:id/respond",
  requireAuth,
  validateBody(submitResponseSchema),
  async (c) => {
    const user = getUser(c);
    const pollId = c.req.param("id");
    const body = c.get("validatedBody") as unknown as SubmitResponseRequest;

    // Check if can submit
    const canSubmitResult = await checkCanSubmitResponse(user, pollId);

    if (!isAuthorized(canSubmitResult)) {
      return c.json(
        { error: canSubmitResult.error, code: canSubmitResult.code },
        canSubmitResult.status as 400 | 403 | 404
      );
    }

    const poll = canSubmitResult.resource;

    // Check if already responded
    const alreadyResponded = await hasAgentResponded(pollId, user.walletAddress);

    if (alreadyResponded) {
      return c.json(
        {
          error: "You have already responded to this poll",
          code: "ALREADY_RESPONDED",
        },
        400
      );
    }

    // Check if cap reached
    const responseCount = await getResponseCount(pollId);

    if (responseCount >= poll.participantCap) {
      return c.json(
        {
          error: "Poll has reached participant cap",
          code: "CAP_REACHED",
        },
        400
      );
    }

    // Validate that all required questions are answered
    const answeredIds = new Set(body.responses.map((r) => r.questionId));
    const requiredQuestions = poll.questions.filter((q: { required: boolean }) => q.required);

    for (const q of requiredQuestions) {
      if (!answeredIds.has(q.id)) {
        return c.json(
          {
            error: `Missing answer for required question: ${q.id}`,
            code: "MISSING_ANSWER",
          },
          400
        );
      }
    }

    // Validate participant wallet address
    const participantWallet = toWalletAddress(user.walletAddress);
    if (!participantWallet) {
      return c.json(
        {
          error: "Invalid wallet address",
          code: "INVALID_WALLET",
        },
        400
      );
    }

    // For V2 claim model: Generate attestation signature for agent to use
    // Agent will submit on-chain themselves (pays their own gas)
    let attestationSignature: `0x${string}` | null = null;
    if (poll.contractPollId !== null) {
      try {
        attestationSignature = await createAttestationSignature(
          BigInt(poll.contractPollId),
          participantWallet
        );
      } catch (error) {
        console.error("Failed to create attestation signature:", error);
        // Continue without attestation - response will be recorded in DB
      }
    }

    // Record response in database
    // Agent can submit on-chain later using the attestation signature
    const response = await recordResponse({
      pollId,
      agentWallet: user.walletAddress,
      responses: body.responses,
      confidenceScores: body.confidenceScores ?? null,
      attestationHash: body.attestationHash,
    });

    // Calculate payout estimate
    const newResponseCount = responseCount + 1;
    const payoutEstimate = (parseFloat(poll.cashPoolUsdc) * 0.9) / poll.participantCap;

    return c.json(
      {
        id: response.id,
        pollId: response.pollId,
        submittedAt: response.submittedAt.toISOString(),
        payoutEstimate: payoutEstimate.toFixed(6),
        participantNumber: newResponseCount,
        contractPollId: poll.contractPollId,
        attestationSignature, // Agent uses this to submit on-chain
        // IMPORTANT: Include the wallet address that the attestation was signed for
        // The agent MUST call submitResponse from this exact address
        attestationFor: participantWallet,
        message: attestationSignature
          ? `Response recorded. Call submitResponse(${poll.contractPollId}, attestationSignature) on contract 0xCe9694CfE9893aEe297Bcd76A8122614ee621c35 from wallet ${participantWallet} to claim payout.`
          : "Response recorded successfully",
      },
      201
    );
  }
);

/**
 * GET /agent/earnings
 * Get agent's total earnings and recent payouts
 */
agents.get("/earnings", requireAuth, async (c) => {
  const user = getUser(c);

  const [earnings, recentPayouts, profile] = await Promise.all([
    getUserEarnings(user.walletAddress),
    getRecentPayouts(user.walletAddress, { limit: 20 }),
    getAgentProfileByWallet(user.walletAddress),
  ]);

  const formattedPayouts = recentPayouts.map((p) => ({
    id: p.id,
    pollId: p.pollId,
    pollTitle: p.poll?.title ?? "Unknown Poll",
    amountUsdc: p.amountUsdc,
    status: p.status,
    txHash: p.txHash,
    distributedAt: p.distributedAt?.toISOString() ?? null,
  }));

  return c.json({
    totalEarned: earnings.totalEarned,
    confirmedPayouts: earnings.confirmedCount,
    pendingPayouts: earnings.pendingCount,
    pollsCompleted: profile?.pollsCompleted ?? 0,
    reliabilityScore: profile?.reliabilityScore ?? "1.00",
    recentPayouts: formattedPayouts,
  });
});

// ============ Claim-Based Model Endpoints (V2) ============

/**
 * GET /agent/polls/:id/attestation
 * Get attestation signature for agent to submit on-chain
 * Agent uses this signature to call submitResponse() on PollPoolV2
 */
agents.get("/polls/:id/attestation", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  const poll = await getPollById(pollId);

  if (!poll) {
    return c.json({ error: "Poll not found", code: "POLL_NOT_FOUND" }, 404);
  }

  if (poll.status !== "active") {
    return c.json(
      {
        error: `Poll is ${poll.status}, not accepting responses`,
        code: "POLL_NOT_ACTIVE",
      },
      400
    );
  }

  // Check if poll has been funded on-chain
  if (poll.contractPollId === null) {
    return c.json(
      {
        error: "Poll has not been funded on-chain yet",
        code: "NOT_FUNDED",
      },
      400
    );
  }

  // Check if already responded (in database)
  const alreadyResponded = await hasAgentResponded(pollId, user.walletAddress);

  if (alreadyResponded) {
    return c.json(
      {
        error: "You have already responded to this poll",
        code: "ALREADY_RESPONDED",
      },
      400
    );
  }

  // Check if cap reached
  const responseCount = await getResponseCount(pollId);

  if (responseCount >= poll.participantCap) {
    return c.json(
      {
        error: "Poll has reached participant cap",
        code: "CAP_REACHED",
      },
      400
    );
  }

  // Validate participant wallet address
  const participantWallet = toWalletAddress(user.walletAddress);
  if (!participantWallet) {
    return c.json(
      {
        error: "Invalid wallet address",
        code: "INVALID_WALLET",
      },
      400
    );
  }

  // Create attestation signature for on-chain verification
  let attestationSignature: `0x${string}`;
  try {
    attestationSignature = await createAttestationSignature(
      BigInt(poll.contractPollId),
      participantWallet
    );
  } catch (error) {
    console.error("Failed to create attestation signature:", error);
    return c.json(
      {
        error: "Failed to create attestation signature",
        code: "ATTESTATION_ERROR",
      },
      500
    );
  }

  // Calculate payout estimate
  const payoutEstimate = (parseFloat(poll.cashPoolUsdc) * 0.9) / poll.participantCap;

  // Signature valid for 1 hour
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  return c.json({
    attestationSignature,
    pollId,
    contractPollId: poll.contractPollId,
    participantWallet,
    payoutEstimate: payoutEstimate.toFixed(6),
    expiresAt: expiresAt.toISOString(),
    message: "Use this signature to call submitResponse() on the contract. Agent pays gas.",
  });
});

/**
 * GET /agent/polls/:id/attestation-debug
 * Get attestation signature with full debug info for agents who already responded
 * Use this to troubleshoot on-chain submission failures
 */
agents.get("/polls/:id/attestation-debug", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  const poll = await getPollById(pollId);

  if (!poll) {
    return c.json({ error: "Poll not found", code: "POLL_NOT_FOUND" }, 404);
  }

  if (poll.contractPollId === null) {
    return c.json(
      {
        error: "Poll has not been funded on-chain yet",
        code: "NOT_FUNDED",
      },
      400
    );
  }

  // Get wallet in proper format
  const participantWallet = toWalletAddress(user.walletAddress);
  if (!participantWallet) {
    return c.json(
      {
        error: "Invalid wallet address",
        code: "INVALID_WALLET",
      },
      400
    );
  }

  // Import chain config to show contract address
  const { POLLPOOL_ADDRESS } = await import("../config/chain.js");

  // Create attestation signature
  let attestationSignature: `0x${string}`;
  try {
    attestationSignature = await createAttestationSignature(
      BigInt(poll.contractPollId),
      participantWallet
    );
  } catch (error) {
    console.error("Failed to create attestation signature:", error);
    return c.json(
      {
        error: "Failed to create attestation signature",
        code: "ATTESTATION_ERROR",
        details: String(error),
      },
      500
    );
  }

  // Get existing response if any
  const existingResponse = await getAgentResponse(pollId, user.walletAddress);

  return c.json({
    debug: {
      message: "Use these values to call submitResponse() on-chain",
      contractAddress: POLLPOOL_ADDRESS,
      contractPollId: poll.contractPollId,
      participantWallet: participantWallet,
      participantWalletLowercase: participantWallet.toLowerCase(),
      attestationSignature,
      signatureLength: attestationSignature.length,
    },
    onChainCall: {
      contract: POLLPOOL_ADDRESS,
      function: "submitResponse(uint256 _pollId, bytes _attestationSignature)",
      args: {
        _pollId: poll.contractPollId,
        _attestationSignature: attestationSignature,
      },
      callerMustBe: participantWallet,
    },
    existingResponse: existingResponse ? {
      id: existingResponse.id,
      submittedAt: existingResponse.submittedAt.toISOString(),
      onChainTxHash: existingResponse.onChainTxHash,
    } : null,
    warning: "The caller (msg.sender) MUST be the same wallet that authenticated to this API. The signature is bound to this specific wallet address.",
  });
});

/**
 * POST /agent/polls/:id/confirm-response
 * Confirm on-chain response submission
 * Agent provides txHash after calling submitResponse() on-chain
 */
agents.post("/polls/:id/confirm-response", requireAuth, validateBody(submitResponseSchema), async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");
  const body = c.get("validatedBody") as unknown as SubmitResponseRequest;

  // Get txHash from request body (if provided)
  const txHash = (body as any).txHash as string | undefined;

  const poll = await getPollById(pollId);

  if (!poll) {
    return c.json({ error: "Poll not found", code: "POLL_NOT_FOUND" }, 404);
  }

  // Check if already responded in database
  const existingResponse = await getAgentResponse(pollId, user.walletAddress);

  if (existingResponse) {
    // If already has txHash, reject
    if (existingResponse.onChainTxHash) {
      return c.json(
        {
          error: "Response already confirmed on-chain",
          code: "ALREADY_CONFIRMED",
        },
        400
      );
    }

    // Update with txHash if provided
    if (txHash) {
      const updated = await updateResponseTxHash(existingResponse.id, txHash);
      return c.json({
        id: updated.id,
        pollId: updated.pollId,
        txHash: updated.onChainTxHash,
        message: "Response confirmed with on-chain transaction",
      });
    }

    return c.json({
      id: existingResponse.id,
      pollId: existingResponse.pollId,
      message: "Response already recorded (no txHash update)",
    });
  }

  // Validate that all required questions are answered
  const answeredIds = new Set(body.responses.map((r) => r.questionId));
  const requiredQuestions = poll.questions.filter((q: { required: boolean }) => q.required);

  for (const q of requiredQuestions) {
    if (!answeredIds.has(q.id)) {
      return c.json(
        {
          error: `Missing answer for required question: ${q.id}`,
          code: "MISSING_ANSWER",
        },
        400
      );
    }
  }

  // Record response in database
  const response = await recordResponse({
    pollId,
    agentWallet: user.walletAddress,
    responses: body.responses,
    confidenceScores: body.confidenceScores ?? null,
    attestationHash: body.attestationHash,
    onChainTxHash: txHash ?? null,
  });

  // Calculate payout estimate
  const responseCount = await getResponseCount(pollId);
  const payoutEstimate = (parseFloat(poll.cashPoolUsdc) * 0.9) / poll.participantCap;

  return c.json(
    {
      id: response.id,
      pollId: response.pollId,
      submittedAt: response.submittedAt.toISOString(),
      txHash: response.onChainTxHash,
      payoutEstimate: payoutEstimate.toFixed(6),
      participantNumber: responseCount,
      message: txHash
        ? "Response submitted and confirmed on-chain"
        : "Response recorded. Submit on-chain to confirm.",
    },
    201
  );
});

/**
 * GET /agent/claimable
 * Get all pending claims for the authenticated agent
 * Returns polls where agent can claim their payout
 */
agents.get("/claimable", requireAuth, async (c) => {
  const user = getUser(c);

  const claimablePayouts = await getClaimablePayouts(user.walletAddress);

  const totalClaimable = claimablePayouts.reduce(
    (sum, p) => sum + parseFloat(p.amountUsdc),
    0
  );

  return c.json({
    claimable: claimablePayouts,
    totalClaimableUsdc: totalClaimable.toFixed(6),
    count: claimablePayouts.length,
    message: claimablePayouts.length > 0
      ? "Call claimPayout() on the contract for each poll. Agent pays gas."
      : "No pending claims",
  });
});

/**
 * POST /agent/polls/:id/confirm-claim
 * Confirm that agent has claimed their payout on-chain
 * Agent provides txHash after calling claimPayout() on-chain
 */
agents.post("/polls/:id/confirm-claim", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  // Get txHash from request body
  const body = await c.req.json().catch(() => ({}));
  const txHash = body.txHash as string | undefined;

  if (!txHash) {
    return c.json(
      {
        error: "txHash is required",
        code: "MISSING_TX_HASH",
      },
      400
    );
  }

  // Check if payout exists for this agent and poll
  const payout = await getPayoutForAgent(pollId, user.walletAddress);

  if (!payout) {
    return c.json(
      {
        error: "No payout found for this poll",
        code: "PAYOUT_NOT_FOUND",
      },
      404
    );
  }

  if (payout.status === "confirmed") {
    return c.json(
      {
        error: "Payout already claimed",
        code: "ALREADY_CLAIMED",
      },
      400
    );
  }

  // Update payout as claimed
  const updated = await updatePayoutAsClaimed(payout.id, txHash);

  return c.json({
    id: updated.id,
    pollId: updated.pollId,
    amountUsdc: updated.amountUsdc,
    txHash: updated.txHash,
    claimedAt: updated.claimedAt?.toISOString(),
    message: "Payout claim confirmed",
  });
});

export default agents;
