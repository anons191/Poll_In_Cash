/**
 * Hooks Index
 * Re-exports all custom hooks for Poll in Cash frontend
 */

// Authentication
export { useAuth } from "./useAuth";
export type { AuthState, UseAuthReturn } from "./useAuth";

// Dashboard
export { useDashboard } from "./useDashboard";
export type { DashboardState, UseDashboardReturn } from "./useDashboard";

// Polls
export {
  usePolls,
  usePoll,
  useCreatePoll,
  usePollResponses,
} from "./usePolls";
export type {
  PollsState,
  UsePollsReturn,
  PollState,
  UsePollReturn,
  CreatePollState,
  UseCreatePollReturn,
  PollResponsesState,
  UsePollResponsesReturn,
} from "./usePolls";

// Profile & Earnings
export {
  useProfile,
  useEarnings,
  useAgentPreferences,
} from "./useProfile";
export type {
  ProfileState,
  UseProfileReturn,
  EarningsState,
  UseEarningsReturn,
  AgentPreferencesState,
  UseAgentPreferencesReturn,
} from "./useProfile";
