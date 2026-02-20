/**
 * Poll Discoverer
 *
 * Discovers and filters available polls from the backend API.
 * Handles poll matching, ranking, and preference-based filtering.
 *
 * @module agent/discovery
 */

import type {
  DiscoveredPoll,
  PollMatch,
  VerifiedAttributes,
  UserPreferences,
  UserProfile,
} from './types.js';
import type { AgentConfig } from './types.js';

/**
 * API response for poll discovery
 */
interface DiscoverPollsResponse {
  polls: DiscoveredPoll[];
  total: number;
}

/**
 * API response for poll matching
 */
interface MatchPollResponse {
  eligible: boolean;
  alreadyResponded: boolean;
  spotsRemaining?: number;
  payoutEstimate?: string;
  ineligibleReasons?: string[];
  matchConfidence?: number;
  reason?: string;
}

/**
 * Options for poll discovery
 */
export interface DiscoverOptions {
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Only return eligible polls */
  eligibleOnly?: boolean;
}

/**
 * Build query string from verified attributes
 */
function buildQueryParams(
  attributes?: Partial<VerifiedAttributes & { age?: number; state?: string; occupation?: string }>,
  options?: DiscoverOptions
): string {
  const params = new URLSearchParams();

  if (options?.limit) {
    params.set('limit', options.limit.toString());
  }
  if (options?.offset) {
    params.set('offset', options.offset.toString());
  }

  if (attributes) {
    if (attributes.isVeteran !== undefined) {
      params.set('isVeteran', attributes.isVeteran.toString());
    }
    if (attributes.isRegisteredVoter !== undefined) {
      params.set('isRegisteredVoter', attributes.isRegisteredVoter.toString());
    }
    if (attributes.state) {
      params.set('state', attributes.state);
    }
    if (attributes.age !== undefined) {
      params.set('age', attributes.age.toString());
    }
    if (attributes.occupation) {
      params.set('occupation', attributes.occupation);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Discover available polls from the API
 * Optionally filters by verified attributes
 */
export async function discoverPolls(
  config: AgentConfig,
  authToken?: string,
  attributes?: Partial<VerifiedAttributes & { age?: number; state?: string; occupation?: string }>,
  options?: DiscoverOptions
): Promise<DiscoveredPoll[]> {
  const queryParams = buildQueryParams(attributes, options);
  const url = `${config.apiBaseUrl}/agent/polls/discover${queryParams}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to discover polls: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as DiscoverPollsResponse;
  return data.polls;
}

/**
 * Match a specific poll to check eligibility
 */
export async function matchPoll(
  config: AgentConfig,
  authToken: string,
  pollId: string,
  verifiedAttributes: Partial<VerifiedAttributes>
): Promise<PollMatch> {
  const url = `${config.apiBaseUrl}/agent/polls/${pollId}/match`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ verifiedAttributes }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to match poll: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as MatchPollResponse;

  return {
    pollId,
    title: '', // Will be filled by caller if needed
    eligible: data.eligible,
    alreadyResponded: data.alreadyResponded,
    spotsRemaining: data.spotsRemaining ?? 0,
    payoutEstimate: data.payoutEstimate ?? '0',
    ineligibleReasons: data.ineligibleReasons ?? [],
    matchConfidence: data.matchConfidence ?? (data.eligible ? 1 : 0),
    topics: [], // Will be extracted from poll data if available
  };
}

/**
 * Calculate match confidence based on profile coverage
 * Higher confidence if profile has more relevant attributes for the poll criteria
 */
export function calculateMatchConfidence(
  poll: DiscoveredPoll,
  profile: UserProfile
): number {
  let matchedCriteria = 0;
  let totalCriteria = 0;

  const criteria = poll.criteria;

  // Check age criteria
  if (criteria.minAge !== undefined || criteria.maxAge !== undefined) {
    totalCriteria++;
    if (profile.demographics.age !== undefined) {
      const meetsMin = criteria.minAge === undefined || profile.demographics.age >= criteria.minAge;
      const meetsMax = criteria.maxAge === undefined || profile.demographics.age <= criteria.maxAge;
      if (meetsMin && meetsMax) {
        matchedCriteria++;
      }
    }
  }

  // Check state criteria
  if (criteria.states && criteria.states.length > 0) {
    totalCriteria++;
    if (profile.demographics.state && criteria.states.includes(profile.demographics.state)) {
      matchedCriteria++;
    }
  }

  // Check veteran status
  if (criteria.isVeteran === true) {
    totalCriteria++;
    if (profile.verifiedAttributes.isVeteran === true) {
      matchedCriteria++;
    }
  }

  // Check voter registration
  if (criteria.isRegisteredVoter === true) {
    totalCriteria++;
    if (profile.verifiedAttributes.isRegisteredVoter === true) {
      matchedCriteria++;
    }
  }

  // Check occupation
  if (criteria.occupations && criteria.occupations.length > 0) {
    totalCriteria++;
    if (profile.professional.occupation && criteria.occupations.includes(profile.professional.occupation)) {
      matchedCriteria++;
    }
  }

  // Check industries
  if (criteria.industries && criteria.industries.length > 0) {
    totalCriteria++;
    if (profile.professional.industry && criteria.industries.includes(profile.professional.industry)) {
      matchedCriteria++;
    }
  }

  // If no specific criteria, assume high confidence
  if (totalCriteria === 0) {
    return 1.0;
  }

  return matchedCriteria / totalCriteria;
}

/**
 * Rank polls by payout amount and match confidence
 */
export function rankPolls(
  polls: DiscoveredPoll[],
  profile?: UserProfile
): DiscoveredPoll[] {
  return [...polls].sort((a, b) => {
    // First, prioritize eligible polls
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }

    // Calculate effective payout (payout * confidence)
    const payoutA = parseFloat(a.payoutEstimate);
    const payoutB = parseFloat(b.payoutEstimate);

    let confidenceA = 1;
    let confidenceB = 1;

    if (profile) {
      confidenceA = calculateMatchConfidence(a, profile);
      confidenceB = calculateMatchConfidence(b, profile);
    }

    const effectivePayoutA = payoutA * confidenceA;
    const effectivePayoutB = payoutB * confidenceB;

    // Sort by effective payout (highest first)
    if (effectivePayoutA !== effectivePayoutB) {
      return effectivePayoutB - effectivePayoutA;
    }

    // If equal, prefer polls with more spots remaining
    if (a.spotsRemaining !== b.spotsRemaining) {
      return b.spotsRemaining - a.spotsRemaining;
    }

    // If still equal, prefer polls closer to expiration (urgency)
    if (a.expiresAt && b.expiresAt) {
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    }

    return 0;
  });
}

/**
 * Filter polls based on user preferences
 */
export function filterByPreferences(
  polls: DiscoveredPoll[],
  preferences: UserPreferences
): DiscoveredPoll[] {
  return polls.filter((poll) => {
    // Check minimum payout threshold
    if (preferences.minimumPayoutUsdc !== undefined) {
      const payout = parseFloat(poll.payoutEstimate);
      if (payout < preferences.minimumPayoutUsdc) {
        return false;
      }
    }

    // Check excluded topics
    if (preferences.excludedTopics && preferences.excludedTopics.length > 0) {
      // Check poll title and description for excluded topics
      const titleLower = poll.title.toLowerCase();
      const descLower = (poll.description || '').toLowerCase();

      for (const topic of preferences.excludedTopics) {
        const topicLower = topic.toLowerCase();
        if (titleLower.includes(topicLower) || descLower.includes(topicLower)) {
          return false;
        }
      }
    }

    // Check allowed topics (if specified, poll must match at least one)
    if (preferences.allowedTopics && preferences.allowedTopics.length > 0) {
      const titleLower = poll.title.toLowerCase();
      const descLower = (poll.description || '').toLowerCase();

      const matchesAllowed = preferences.allowedTopics.some((topic) => {
        const topicLower = topic.toLowerCase();
        return titleLower.includes(topicLower) || descLower.includes(topicLower);
      });

      if (!matchesAllowed) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter polls that meet the minimum payout threshold
 */
export function filterByMinimumPayout(
  polls: DiscoveredPoll[],
  minimumPayoutUsdc: number
): DiscoveredPoll[] {
  return polls.filter((poll) => {
    const payout = parseFloat(poll.payoutEstimate);
    return payout >= minimumPayoutUsdc;
  });
}

/**
 * Filter to only eligible polls with spots remaining
 */
export function filterEligible(polls: DiscoveredPoll[]): DiscoveredPoll[] {
  return polls.filter((poll) => poll.eligible && poll.spotsRemaining > 0);
}

/**
 * Poll Discoverer class for stateful discovery operations
 */
export class PollDiscoverer {
  private config: AgentConfig;
  private authToken: string | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Set the auth token for API calls
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Discover available polls
   */
  async discover(
    attributes?: Partial<VerifiedAttributes & { age?: number; state?: string; occupation?: string }>,
    options?: DiscoverOptions
  ): Promise<DiscoveredPoll[]> {
    return discoverPolls(this.config, this.authToken ?? undefined, attributes, options);
  }

  /**
   * Match a specific poll
   */
  async match(
    pollId: string,
    verifiedAttributes: Partial<VerifiedAttributes>
  ): Promise<PollMatch> {
    if (!this.authToken) {
      throw new Error('Auth token required for matching');
    }
    return matchPoll(this.config, this.authToken, pollId, verifiedAttributes);
  }

  /**
   * Discover, filter, and rank polls based on profile and preferences
   */
  async discoverAndRank(
    profile: UserProfile
  ): Promise<DiscoveredPoll[]> {
    // Build attributes for filtering
    const attributes = {
      isVeteran: profile.verifiedAttributes.isVeteran,
      isRegisteredVoter: profile.verifiedAttributes.isRegisteredVoter,
      state: profile.demographics.state,
      age: profile.demographics.age,
      occupation: profile.professional.occupation,
    };

    // Discover polls
    const polls = await this.discover(attributes);

    // Filter by eligibility
    let filtered = filterEligible(polls);

    // Filter by preferences
    if (profile.preferences) {
      filtered = filterByPreferences(filtered, profile.preferences);
    }

    // Filter by config minimum payout
    if (this.config.minimumPayoutUsdc > 0) {
      filtered = filterByMinimumPayout(filtered, this.config.minimumPayoutUsdc);
    }

    // Rank remaining polls
    return rankPolls(filtered, profile);
  }

  /**
   * Get a single poll's full match details
   */
  async getMatchDetails(
    poll: DiscoveredPoll,
    profile: UserProfile
  ): Promise<PollMatch> {
    const match = await this.match(poll.id, profile.verifiedAttributes);

    return {
      ...match,
      title: poll.title,
      matchConfidence: calculateMatchConfidence(poll, profile),
    };
  }
}
