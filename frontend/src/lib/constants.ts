/**
 * Application Constants
 * Centralized configuration values for Poll in Cash frontend
 */

// ============ API Configuration ============

/**
 * Backend API URL from environment variable
 * Defaults to localhost:3001 for development
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============ Blockchain Configuration ============

/**
 * Base Sepolia Chain ID
 */
export const CHAIN_ID = 84532;

/**
 * PollPool contract address from environment variable
 */
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_POLLPOOL_CONTRACT_ADDRESS || "";

/**
 * Chain environment - "mainnet" or "testnet"
 */
export const CHAIN_ENV = process.env.NEXT_PUBLIC_CHAIN_ENV || "testnet";

/**
 * BaseScan URL based on chain environment
 */
export const BASESCAN_URL = CHAIN_ENV === "mainnet"
  ? "https://basescan.org"
  : "https://sepolia.basescan.org";

/**
 * USDC contract address (varies by network)
 * Testnet: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
export const USDC_ADDRESS = CHAIN_ENV === "mainnet"
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as const;

/**
 * USDC decimals (standard for USDC)
 */
export const USDC_DECIMALS = 6;

// ============ Poll Status Configuration ============

/**
 * Poll status enum values
 */
export const POLL_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  CLOSED: "closed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type PollStatusKey = keyof typeof POLL_STATUS;
export type PollStatusValue = (typeof POLL_STATUS)[PollStatusKey];

/**
 * Poll status labels for display
 */
export const POLL_STATUS_LABELS: Record<PollStatusValue, string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Poll status colors for UI styling
 * Uses Tailwind-compatible color classes
 */
export const POLL_STATUS_COLORS: Record<PollStatusValue, { bg: string; text: string; dot: string }> = {
  draft: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-500",
  },
  active: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  closed: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  completed: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

// ============ Question Type Configuration ============

/**
 * Question type enum values
 */
export const QUESTION_TYPE = {
  SINGLE_CHOICE: "single_choice",
  MULTIPLE_CHOICE: "multiple_choice",
  TEXT: "text",
  RATING: "rating",
  SCALE: "scale",
  YES_NO: "yes_no",
  RANKING: "ranking",
} as const;

export type QuestionTypeKey = keyof typeof QUESTION_TYPE;
export type QuestionTypeValue = (typeof QUESTION_TYPE)[QuestionTypeKey];

/**
 * Question type options for forms/dropdowns
 */
export const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionTypeValue; label: string; description: string }> = [
  {
    value: "single_choice",
    label: "Single Choice",
    description: "Users can select one option from a list",
  },
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "Users can select multiple options from a list",
  },
  {
    value: "text",
    label: "Free Text",
    description: "Users can write an open-ended response",
  },
  {
    value: "rating",
    label: "Rating",
    description: "Users give a star rating (1-5)",
  },
  {
    value: "scale",
    label: "Scale",
    description: "Users select a value on a numeric scale",
  },
  {
    value: "yes_no",
    label: "Yes/No",
    description: "Simple yes or no question",
  },
  {
    value: "ranking",
    label: "Ranking",
    description: "Users rank options in order of preference",
  },
];

// ============ UI Configuration ============

/**
 * Default pagination settings
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Auto-refresh intervals (in milliseconds)
 */
export const REFRESH_INTERVALS = {
  DASHBOARD: 30000, // 30 seconds
  POLLS: 60000, // 1 minute
  ACTIVITY: 15000, // 15 seconds
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "poll_in_cash_token",
  USER_PREFERENCES: "poll_in_cash_preferences",
} as const;

// ============ Confidence Score Configuration ============

/**
 * Confidence score thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
} as const;

/**
 * Confidence level colors
 */
export const CONFIDENCE_COLORS = {
  high: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-300",
  },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-300",
  },
  low: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-300",
  },
} as const;
