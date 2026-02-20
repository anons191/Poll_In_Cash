import { getPollById } from "../db/queries.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type { Poll } from "../db/schema.js";

/**
 * Result of an ownership check
 */
export type OwnershipResult<T> =
  | { authorized: true; resource: T }
  | { authorized: false; error: string; code: string; status: number };

/**
 * Check if user owns a poll (is the creator)
 *
 * Usage:
 * ```typescript
 * const result = await checkPollOwnership(user, pollId);
 * if (!result.authorized) {
 *   return res.status(result.status).json({ error: result.error, code: result.code });
 * }
 * const { resource: poll } = result;
 * ```
 */
export async function checkPollOwnership(
  user: AuthenticatedUser,
  pollId: string
): Promise<OwnershipResult<Poll>> {
  const poll = await getPollById(pollId);

  if (!poll) {
    return {
      authorized: false,
      error: "Poll not found",
      code: "POLL_NOT_FOUND",
      status: 404,
    };
  }

  if (poll.creatorId !== user.userId) {
    return {
      authorized: false,
      error: "You do not have permission to access this poll",
      code: "FORBIDDEN",
      status: 403,
    };
  }

  return { authorized: true, resource: poll };
}

/**
 * Check if user can read a poll
 * Creators can always read, others can only read public active polls
 */
export async function checkPollReadAccess(
  user: AuthenticatedUser | null,
  pollId: string
): Promise<OwnershipResult<Poll>> {
  const poll = await getPollById(pollId);

  if (!poll) {
    return {
      authorized: false,
      error: "Poll not found",
      code: "POLL_NOT_FOUND",
      status: 404,
    };
  }

  // Creator can always read
  if (user && poll.creatorId === user.userId) {
    return { authorized: true, resource: poll };
  }

  // Public active polls are readable by anyone
  if (poll.visibility === "public" && poll.status === "active") {
    return { authorized: true, resource: poll };
  }

  // Draft polls are only visible to creator
  if (poll.status === "draft") {
    return {
      authorized: false,
      error: "This poll is not yet published",
      code: "POLL_NOT_PUBLISHED",
      status: 404,
    };
  }

  // Private polls require creator access
  if (poll.visibility === "private") {
    return {
      authorized: false,
      error: "This poll is private",
      code: "POLL_PRIVATE",
      status: 403,
    };
  }

  return { authorized: true, resource: poll };
}

/**
 * Check if user can read poll responses
 * Only the poll creator can read responses
 */
export async function checkResponseReadAccess(
  user: AuthenticatedUser,
  pollId: string
): Promise<OwnershipResult<Poll>> {
  return checkPollOwnership(user, pollId);
}

/**
 * Check if user owns their own profile
 */
export async function checkProfileOwnership(
  user: AuthenticatedUser,
  userId: string
): Promise<OwnershipResult<{ userId: string }>> {
  if (user.userId !== userId) {
    return {
      authorized: false,
      error: "You can only access your own profile",
      code: "FORBIDDEN",
      status: 403,
    };
  }

  return { authorized: true, resource: { userId } };
}

/**
 * Check if user can submit a response to a poll
 * Requirements:
 * - Poll must exist
 * - Poll must be active
 * - Poll must be public OR user is invited (future feature)
 */
export async function checkCanSubmitResponse(
  _user: AuthenticatedUser,
  pollId: string
): Promise<OwnershipResult<Poll>> {
  const poll = await getPollById(pollId);

  if (!poll) {
    return {
      authorized: false,
      error: "Poll not found",
      code: "POLL_NOT_FOUND",
      status: 404,
    };
  }

  if (poll.status !== "active") {
    return {
      authorized: false,
      error: `Poll is ${poll.status}, not accepting responses`,
      code: "POLL_NOT_ACTIVE",
      status: 400,
    };
  }

  if (poll.visibility === "private") {
    // Future: check if user is invited
    return {
      authorized: false,
      error: "This poll is private and requires an invitation",
      code: "POLL_PRIVATE",
      status: 403,
    };
  }

  return { authorized: true, resource: poll };
}

/**
 * Type guard for checking if ownership result is authorized
 */
export function isAuthorized<T>(
  result: OwnershipResult<T>
): result is { authorized: true; resource: T } {
  return result.authorized;
}

/**
 * Helper to format ownership error for HTTP response
 */
export function formatOwnershipError(
  result: Extract<OwnershipResult<unknown>, { authorized: false }>
): { status: number; body: { error: string; code: string } } {
  return {
    status: result.status,
    body: {
      error: result.error,
      code: result.code,
    },
  };
}
