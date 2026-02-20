/**
 * TypeScript Type Definitions
 * Comprehensive types for Poll in Cash frontend
 */

import { POLL_STATUS, QUESTION_TYPE } from "./constants";

// ============ User & Authentication Types ============

/**
 * Basic user information
 */
export interface User {
  id: string;
  walletAddress: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * User profile with additional details
 */
export interface Profile extends User {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  agentEnabled: boolean;
  agentPreferences?: AgentPreferences;
  totalEarnings: string;
  pollsCreated: number;
  pollsCompleted: number;
}

/**
 * Agent preferences for automated poll participation
 */
export interface AgentPreferences {
  enabled: boolean;
  categories: string[];
  minPayout: string;
  maxDailyPolls: number;
  excludedTopics: string[];
}

/**
 * Update profile request payload
 */
export interface UpdateProfileInput {
  displayName?: string;
  email?: string;
  bio?: string;
  agentEnabled?: boolean;
  agentPreferences?: Partial<AgentPreferences>;
}

// ============ Dashboard Types ============

/**
 * Dashboard summary statistics
 */
export interface DashboardSummary {
  totalEarnings: string;
  pendingEarnings: string;
  activePolls: number;
  completedPolls: number;
  totalResponses: number;
  averageConfidence: number;
  weeklyChange: {
    earnings: number;
    polls: number;
  };
}

/**
 * Activity feed item
 */
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: string;
  pollId?: string;
  pollTitle?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Activity types
 */
export type ActivityType =
  | "poll_completed"
  | "poll_created"
  | "poll_closed"
  | "payment_received"
  | "payment_sent"
  | "agent_response"
  | "profile_updated";

// ============ Poll Types ============

/**
 * Poll status values
 */
export type PollStatus = (typeof POLL_STATUS)[keyof typeof POLL_STATUS];

/**
 * Question type values
 */
export type QuestionType = (typeof QUESTION_TYPE)[keyof typeof QUESTION_TYPE];

/**
 * Poll question definition
 */
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
}

/**
 * Poll criteria for agent targeting
 */
export interface PollCriteria {
  ageRange?: { min: number; max: number };
  location?: string[];
  interests?: string[];
  customFilters?: Record<string, unknown>;
}

/**
 * Full poll object
 */
export interface Poll {
  id: string;
  title: string;
  description: string;
  status: PollStatus;
  creator?: {
    id: string;
    walletAddress: string;
    displayName?: string;
  };
  questions: Question[];
  criteria?: PollCriteria;
  criteriaHash?: string;
  rewardPerResponse: string;
  totalFunded: string;
  cashPoolUsdc?: string;
  participantCap: number;
  participantCount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  onChainId?: string;
  contractPollId?: number;
  transactionHash?: string;
  isOwner?: boolean;
}

/**
 * Simplified poll for list views
 */
export interface PollSummary {
  id: string;
  title: string;
  status: PollStatus;
  rewardPerResponse: string;
  participantCap: number;
  participantCount: number;
  expiresAt: string;
  createdAt: string;
}

/**
 * Poll filters for list queries
 */
export interface PollFilters {
  status?: PollStatus | PollStatus[];
  creatorId?: string;
  isCreator?: boolean;
  search?: string;
  minReward?: string;
  maxReward?: string;
  sortBy?: "createdAt" | "expiresAt" | "reward" | "participants";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Create poll request payload
 */
export interface CreatePollInput {
  title: string;
  description: string;
  questions: Omit<Question, "id">[];
  criteria?: PollCriteria;
  rewardPerResponse: string;
  participantCap: number;
  durationDays: number;
  fundAmount: string;
}

// ============ Poll Response Types ============

/**
 * Individual answer to a question
 */
export interface Answer {
  questionId: string;
  value: string | string[] | number;
}

/**
 * Poll response from a participant
 */
export interface PollResponse {
  id: string;
  pollId: string;
  respondent: {
    id: string;
    walletAddress: string;
    displayName?: string;
  };
  answers: Answer[];
  confidenceScore: number;
  agentModel?: string;
  submittedAt: string;
  attestationHash?: string;
  paymentStatus: "pending" | "paid" | "failed";
  paymentAmount?: string;
  paymentTxHash?: string;
}

/**
 * Aggregated response statistics
 */
export interface ResponseStats {
  totalResponses: number;
  averageConfidence: number;
  questionStats: QuestionStats[];
}

/**
 * Statistics for a single question
 */
export interface QuestionStats {
  questionId: string;
  questionText: string;
  type: QuestionType;
  answerDistribution: Record<string, number>;
  averageValue?: number;
  commonResponses?: string[];
}

// ============ Earnings Types ============

/**
 * Earning record
 */
export interface Earning {
  id: string;
  type: "poll_reward" | "referral" | "bonus";
  amount: string;
  status: "pending" | "confirmed" | "paid";
  pollId?: string;
  pollTitle?: string;
  transactionHash?: string;
  createdAt: string;
  paidAt?: string;
}

/**
 * Earnings summary
 */
export interface EarningsSummary {
  total: string;
  pending: string;
  paid: string;
  thisWeek: string;
  thisMonth: string;
}

// ============ API Response Types ============

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Generic API response
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============ Form Types ============

/**
 * Form field state
 */
export interface FieldState<T = string> {
  value: T;
  error?: string;
  touched: boolean;
}

/**
 * Create poll form state
 */
export interface CreatePollFormState {
  title: FieldState;
  description: FieldState;
  questions: Question[];
  rewardPerResponse: FieldState;
  participantCap: FieldState<number>;
  durationDays: FieldState<number>;
  fundAmount: FieldState;
  criteria: PollCriteria;
}

// ============ UI State Types ============

/**
 * Loading state object
 */
export interface LoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  isSubmitting: boolean;
}

/**
 * Toast notification
 */
export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

// ============ Chart/Analytics Types ============

/**
 * Chart data point
 */
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

/**
 * Earnings chart data
 */
export interface EarningsChartData {
  daily: ChartDataPoint[];
  weekly: ChartDataPoint[];
  monthly: ChartDataPoint[];
}
