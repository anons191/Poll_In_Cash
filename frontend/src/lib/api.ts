/**
 * API Client
 * Typed API functions for Poll in Cash backend
 */

import { API_URL, STORAGE_KEYS } from "./constants";
import type {
  User,
  Profile,
  DashboardSummary,
  Activity,
  Poll,
  PollFilters,
  PollResponse,
  CreatePollInput,
  UpdateProfileInput,
  Earning,
  ApiError,
} from "./types";

// ============ Token Management ============

/**
 * Get the authentication token from localStorage
 * @returns JWT token or null if not found
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Save the authentication token to localStorage
 * @param token - JWT token to save
 */
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

/**
 * Remove the authentication token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Check if user has a valid token stored
 * @returns True if token exists
 */
export function hasAuthToken(): boolean {
  return getAuthToken() !== null;
}

// ============ API Error Handling ============

/**
 * Custom API error class with typed error details
 */
export class ApiClientError extends Error {
  public statusCode: number;
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Check if error is due to unauthorized access
   */
  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if error is due to forbidden access
   */
  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if error is a not found error
   */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }
}

// ============ API Client ============

/**
 * HTTP methods supported by the API client
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Options for API requests
 */
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

/**
 * Make an authenticated API request
 *
 * @param endpoint - API endpoint (relative to API_URL)
 * @param options - Request options
 * @returns Parsed JSON response
 * @throws ApiClientError on non-2xx responses
 */
async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, requireAuth = true } = options;

  // Build request headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add authorization header if required and token exists
  if (requireAuth) {
    const token = getAuthToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  // Build request URL
  const url = `${API_URL}${endpoint}`;

  // Make the request
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle error responses
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: "Unknown error",
        message: response.statusText || "An unknown error occurred",
        statusCode: response.status,
      };
    }

    throw new ApiClientError(
      errorData.message || errorData.error || "Request failed",
      response.status,
      errorData.details
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }

  // Parse and return JSON response
  return response.json();
}

// ============ Authentication API ============

/**
 * Response from the nonce endpoint
 */
export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

/**
 * Response from the verify endpoint
 */
export interface VerifyResponse {
  token: string;
  user: User;
}

/**
 * Request a nonce for wallet signature authentication
 *
 * @param walletAddress - The wallet address to authenticate
 * @returns Nonce data for signing
 */
export async function fetchNonce(walletAddress: string): Promise<NonceResponse> {
  return apiClient<NonceResponse>("/auth/nonce", {
    method: "POST",
    body: { walletAddress },
    requireAuth: false,
  });
}

/**
 * Verify a signed message and get authentication token
 *
 * @param walletAddress - The wallet address
 * @param signature - The signed message
 * @param nonce - The nonce that was signed
 * @returns JWT token and user data
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce?: string
): Promise<VerifyResponse> {
  return apiClient<VerifyResponse>("/auth/verify", {
    method: "POST",
    body: { walletAddress, signature, nonce },
    requireAuth: false,
  });
}

// ============ Dashboard API ============

/**
 * Backend dashboard summary response structure
 */
interface BackendDashboardSummary {
  earnings: {
    totalEarned: string;
    confirmedPayouts: number;
    pendingPayouts: number;
  };
  pollsCreated: {
    total: number;
    draft: number;
    active: number;
    closed: number;
    distributed: number;
    cancelled: number;
  };
  pollsTaken: number;
  profile: {
    reliabilityScore: string;
    pollsCompleted: number;
    verifiedAttributes: Record<string, unknown>;
  } | null;
}

/**
 * Fetch dashboard summary statistics
 *
 * @returns Dashboard summary data
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient<BackendDashboardSummary>("/dashboard/summary");

  // Transform backend response to frontend expected format
  return {
    totalEarnings: response.earnings?.totalEarned || "0",
    pendingEarnings: String(response.earnings?.pendingPayouts || 0),
    activePolls: response.pollsCreated?.active || 0,
    completedPolls: (response.pollsCreated?.closed || 0) + (response.pollsCreated?.distributed || 0),
    totalResponses: response.pollsTaken || 0,
    averageConfidence: response.profile ? parseFloat(response.profile.reliabilityScore) || 0 : 0,
    weeklyChange: {
      earnings: 0, // Backend doesn't provide this yet
      polls: 0,
    },
  };
}

/**
 * Fetch recent activity feed
 *
 * @returns Array of activity items
 */
export async function fetchDashboardActivity(): Promise<Activity[]> {
  const response = await apiClient<{ activities: Activity[] }>("/dashboard/activity");
  return response.activities || [];
}

// ============ Polls API ============

/**
 * Build query string from poll filters
 */
function buildPollQueryString(filters?: PollFilters): string {
  if (!filters) return "";

  const params = new URLSearchParams();

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach((s) => params.append("status", s));
    } else {
      params.append("status", filters.status);
    }
  }

  if (filters.creatorId) params.append("creatorId", filters.creatorId);
  // Backend expects 'mine' parameter, not 'isCreator'
  if (filters.isCreator !== undefined) params.append("mine", String(filters.isCreator));
  if (filters.search) params.append("search", filters.search);
  if (filters.minReward) params.append("minReward", filters.minReward);
  if (filters.maxReward) params.append("maxReward", filters.maxReward);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
  if (filters.page !== undefined) params.append("page", String(filters.page));
  if (filters.limit !== undefined) params.append("limit", String(filters.limit));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Fetch list of polls with optional filters
 *
 * @param filters - Optional filters for the query
 * @returns Array of polls
 */
export async function fetchPolls(filters?: PollFilters): Promise<Poll[]> {
  const queryString = buildPollQueryString(filters);
  const response = await apiClient<{ polls: Poll[] }>(`/polls${queryString}`);
  return response.polls || [];
}

/**
 * Create a new poll
 *
 * @param data - Poll creation data
 * @returns Created poll
 */
export async function createPoll(data: CreatePollInput): Promise<Poll> {
  return apiClient<Poll>("/polls", {
    method: "POST",
    body: data,
  });
}

/**
 * Fetch a single poll by ID
 *
 * @param id - Poll ID
 * @returns Poll data
 */
export async function fetchPoll(id: string): Promise<Poll> {
  return apiClient<Poll>(`/polls/${id}`);
}

/**
 * Fetch responses for a poll (creator only)
 *
 * @param id - Poll ID
 * @returns Array of poll responses
 */
export async function fetchPollResponses(id: string): Promise<PollResponse[]> {
  return apiClient<PollResponse[]>(`/polls/${id}/responses`);
}

/**
 * Close a poll (stop accepting responses)
 *
 * @param id - Poll ID
 */
export async function closePoll(id: string): Promise<void> {
  return apiClient<void>(`/polls/${id}/close`, {
    method: "PATCH",
  });
}

/**
 * Cancel a poll (refund remaining funds)
 *
 * @param id - Poll ID
 */
export async function cancelPoll(id: string): Promise<void> {
  return apiClient<void>(`/polls/${id}`, {
    method: "DELETE",
  });
}

/**
 * Response from funding a poll
 */
export interface FundPollResponse {
  id: string;
  status: string;
  contractPollId: number;
}

/**
 * Fund a poll after on-chain transaction
 *
 * @param id - Poll ID
 * @param contractPollId - The on-chain poll ID from the PollPool contract
 * @returns Updated poll data
 */
export async function fundPoll(id: string, contractPollId: number): Promise<FundPollResponse> {
  return apiClient<FundPollResponse>(`/polls/${id}/fund`, {
    method: "POST",
    body: { contractPollId },
  });
}

// ============ Profile API ============

/**
 * Fetch the current user's profile
 *
 * @returns User profile data
 */
export async function fetchProfile(): Promise<Profile> {
  return apiClient<Profile>("/profile");
}

/**
 * Update the current user's profile
 *
 * @param data - Profile update data
 * @returns Updated profile
 */
export async function updateProfile(data: UpdateProfileInput): Promise<Profile> {
  return apiClient<Profile>("/profile", {
    method: "PATCH",
    body: data,
  });
}

// ============ Earnings API ============

/**
 * Fetch earnings history
 *
 * @returns Array of earning records
 */
export async function fetchEarnings(): Promise<Earning[]> {
  return apiClient<Earning[]>("/earnings");
}

// ============ Exports ============

export { apiClient };
