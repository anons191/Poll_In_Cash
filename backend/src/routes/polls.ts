import { Hono } from "hono";
import { keccak256, toUtf8Bytes } from "ethers";
import {
  createPoll,
  getPollById,
  getPollsByCreator,
  getDiscoverablePolls,
  updatePollStatus,
  setPollContractId,
  getResponseCount,
} from "../db/queries.js";
import { requireAuth, getUser } from "../middleware/auth.js";
import {
  checkPollOwnership,
  checkPollReadAccess,
  isAuthorized,
} from "../auth/ownership.js";
import {
  validateBody,
  validateQuery,
  createPollSchema,
  fundPollSchema,
  pollsQuerySchema,
  type CreatePollRequest,
  type FundPollRequest,
  type PollsQuery,
} from "../middleware/validate.js";
import type { AppEnv } from "../types/hono.js";
import {
  closePoll as closeOnChain,
  distribute as distributeOnChain,
} from "../services/thirdweb/client.js";

const polls = new Hono<AppEnv>();

/**
 * GET /polls/public
 * List active public polls (no auth required)
 * For landing page display
 */
polls.get("/public", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const pollsList = await getDiscoverablePolls({ limit });

    // Add response counts
    const pollsWithDetails = await Promise.all(
      pollsList.map(async (poll) => ({
        id: poll.id,
        title: poll.title,
        description: poll.description,
        totalFunded: poll.cashPoolUsdc,
        participantCap: poll.participantCap,
        participantCount: await getResponseCount(poll.id),
        status: poll.status,
        criteria: poll.criteria,
        expiresAt: poll.expiresAt?.toISOString() ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: poll.createdAt.toISOString(),
      }))
    );

    return c.json(pollsWithDetails);
  } catch (error) {
    console.error("Error fetching public polls:", error);
    return c.json([]);
  }
});

/**
 * POST /polls
 * Create a new poll (draft status)
 * Requires authentication
 */
polls.post("/", requireAuth, validateBody(createPollSchema), async (c) => {
  const user = getUser(c);
  const body = c.get("validatedBody") as CreatePollRequest;

  // Generate criteria hash from criteria JSON
  const criteriaJson = JSON.stringify(body.criteria);
  const criteriaHash = keccak256(toUtf8Bytes(criteriaJson));

  const poll = await createPoll({
    creatorId: user.userId,
    title: body.title,
    description: body.description ?? null,
    questions: body.questions,
    criteria: body.criteria,
    criteriaHash,
    cashPoolUsdc: body.cashPoolUsdc,
    participantCap: body.participantCap,
    visibility: body.visibility,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    status: "draft",
  });

  return c.json(
    {
      id: poll.id,
      title: poll.title,
      status: poll.status,
      criteriaHash: poll.criteriaHash,
      createdAt: poll.createdAt.toISOString(),
    },
    201
  );
});

/**
 * GET /polls
 * List polls - public active polls or creator's own polls
 */
polls.get("/", requireAuth, validateQuery(pollsQuerySchema), async (c) => {
  const user = getUser(c);
  const query = c.get("validatedQuery") as PollsQuery;

  let pollsList;

  if (query.mine) {
    // Get user's own polls
    pollsList = await getPollsByCreator(user.userId, {
      status: query.status,
      limit: query.limit,
    });
  } else {
    // Get public active polls
    pollsList = await getDiscoverablePolls({
      limit: query.limit,
      offset: query.offset,
    });
  }

  // Add response counts
  const pollsWithCounts = await Promise.all(
    pollsList.map(async (poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      cashPoolUsdc: poll.cashPoolUsdc,
      participantCap: poll.participantCap,
      status: poll.status,
      visibility: poll.visibility,
      responseCount: await getResponseCount(poll.id),
      expiresAt: poll.expiresAt?.toISOString() ?? null,
      createdAt: poll.createdAt.toISOString(),
      isOwner: poll.creatorId === user.userId,
    }))
  );

  return c.json({ polls: pollsWithCounts });
});

/**
 * GET /polls/:id
 * Get poll details with response count
 */
polls.get("/:id", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  const accessResult = await checkPollReadAccess(user, pollId);

  if (!isAuthorized(accessResult)) {
    return c.json(
      { error: accessResult.error, code: accessResult.code },
      accessResult.status as 403 | 404
    );
  }

  const poll = accessResult.resource;
  const responseCount = await getResponseCount(pollId);

  // Calculate reward per response (90% of pool / participant cap)
  const cashPool = parseFloat(poll.cashPoolUsdc);
  const rewardPerResponse = poll.participantCap > 0
    ? ((cashPool * 0.9) / poll.participantCap).toFixed(2)
    : "0.00";

  return c.json({
    id: poll.id,
    title: poll.title,
    description: poll.description,
    questions: poll.questions,
    criteria: poll.criteria,
    criteriaHash: poll.criteriaHash,
    cashPoolUsdc: poll.cashPoolUsdc,
    rewardPerResponse,
    participantCap: poll.participantCap,
    participantCount: responseCount,
    responseCount,
    status: poll.status,
    visibility: poll.visibility,
    contractPollId: poll.contractPollId,
    expiresAt: poll.expiresAt?.toISOString() ?? null,
    createdAt: poll.createdAt.toISOString(),
    isOwner: poll.creatorId === user.userId,
  });
});

/**
 * POST /polls/:id/fund
 * Mark poll as active with on-chain contract poll ID
 * Called after successful on-chain funding
 */
polls.post("/:id/fund", requireAuth, validateBody(fundPollSchema), async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");
  const { contractPollId } = c.get("validatedBody") as FundPollRequest;

  // Check ownership
  const ownershipResult = await checkPollOwnership(user, pollId);

  if (!isAuthorized(ownershipResult)) {
    return c.json(
      { error: ownershipResult.error, code: ownershipResult.code },
      ownershipResult.status as 403 | 404
    );
  }

  const poll = ownershipResult.resource;

  // Can only fund draft polls
  if (poll.status !== "draft") {
    return c.json(
      {
        error: `Cannot fund poll with status: ${poll.status}`,
        code: "INVALID_STATUS",
      },
      400
    );
  }

  const updated = await setPollContractId(pollId, contractPollId);

  return c.json({
    id: updated.id,
    status: updated.status,
    contractPollId: updated.contractPollId,
  });
});

/**
 * PATCH /polls/:id/close
 * Close a poll (creator anytime, anyone after expiry)
 * Also triggers on-chain closePoll() if the poll has a contract ID
 */
polls.patch("/:id/close", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  const poll = await getPollById(pollId);

  if (!poll) {
    return c.json({ error: "Poll not found", code: "POLL_NOT_FOUND" }, 404);
  }

  if (poll.status !== "active") {
    return c.json(
      {
        error: `Cannot close poll with status: ${poll.status}`,
        code: "INVALID_STATUS",
      },
      400
    );
  }

  // Check if user can close
  const isCreator = poll.creatorId === user.userId;
  const isExpired = poll.expiresAt && new Date() >= poll.expiresAt;

  if (!isCreator && !isExpired) {
    return c.json(
      {
        error: "Only the creator can close a poll before expiry",
        code: "FORBIDDEN",
      },
      403
    );
  }

  let txHash: string | null = null;

  // Close on-chain if poll has a contract ID
  if (poll.contractPollId !== null) {
    try {
      const receipt = await closeOnChain(BigInt(poll.contractPollId));
      txHash = receipt.hash;
    } catch (error) {
      console.error("Failed to close poll on-chain:", error);
      return c.json(
        {
          error: "Failed to close poll on-chain",
          code: "CONTRACT_ERROR",
        },
        500
      );
    }
  }

  const updated = await updatePollStatus(pollId, "closed");
  const responseCount = await getResponseCount(pollId);

  return c.json({
    id: updated.id,
    status: updated.status,
    responseCount,
    closedBy: isCreator ? "creator" : "expiry",
    ...(txHash && { txHash }),
  });
});

/**
 * POST /polls/:id/distribute
 * Distribute funds to all participants after poll is closed
 * Triggers on-chain distribute() to send USDC payouts
 */
polls.post("/:id/distribute", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  // Check ownership
  const ownershipResult = await checkPollOwnership(user, pollId);

  if (!isAuthorized(ownershipResult)) {
    return c.json(
      { error: ownershipResult.error, code: ownershipResult.code },
      ownershipResult.status as 403 | 404
    );
  }

  const poll = ownershipResult.resource;

  // Can only distribute closed polls
  if (poll.status !== "closed") {
    return c.json(
      {
        error: `Cannot distribute poll with status: ${poll.status}. Poll must be closed first.`,
        code: "INVALID_STATUS",
      },
      400
    );
  }

  // Must have a contract ID
  if (poll.contractPollId === null) {
    return c.json(
      {
        error: "Poll has no on-chain contract ID",
        code: "NO_CONTRACT",
      },
      400
    );
  }

  let txHash: string;

  try {
    const receipt = await distributeOnChain(BigInt(poll.contractPollId));
    txHash = receipt.hash;
  } catch (error) {
    console.error("Failed to distribute funds on-chain:", error);
    return c.json(
      {
        error: "Failed to distribute funds on-chain",
        code: "CONTRACT_ERROR",
      },
      500
    );
  }

  // Update poll status to distributed
  const updated = await updatePollStatus(pollId, "distributed");
  const responseCount = await getResponseCount(pollId);

  return c.json({
    id: updated.id,
    status: updated.status,
    responseCount,
    txHash,
    message: "Funds distributed successfully",
  });
});

/**
 * DELETE /polls/:id
 * Cancel a poll (creator only, active polls only)
 */
polls.delete("/:id", requireAuth, async (c) => {
  const user = getUser(c);
  const pollId = c.req.param("id");

  const ownershipResult = await checkPollOwnership(user, pollId);

  if (!isAuthorized(ownershipResult)) {
    return c.json(
      { error: ownershipResult.error, code: ownershipResult.code },
      ownershipResult.status as 403 | 404
    );
  }

  const poll = ownershipResult.resource;

  // Can only cancel draft or active polls
  if (poll.status !== "draft" && poll.status !== "active") {
    return c.json(
      {
        error: `Cannot cancel poll with status: ${poll.status}`,
        code: "INVALID_STATUS",
      },
      400
    );
  }

  const updated = await updatePollStatus(pollId, "cancelled");

  return c.json({
    id: updated.id,
    status: updated.status,
    message: "Poll cancelled successfully",
  });
});

export default polls;
