// Central type definitions for Poll in Cash
// Additional types will be added as features are implemented

export type PollStatus = "draft" | "live" | "paused" | "closed";

export type VerificationStatus = "pending" | "valid" | "invalid" | "manual_review";

export type CompletionVerdict = "pending" | "valid" | "invalid" | "manual_review";

export type TransactionStatus = "pending" | "confirmed" | "failed";

