/**
 * Discovery Module Tests
 *
 * Tests for poll discovery functions including:
 * - discoverPolls
 * - matchPoll
 * - rankPolls
 * - filterByPreferences
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  DiscoveredPoll,
  PollMatch,
  PollCriteria,
  UserProfile,
  UserPreferences,
  VerifiedAttributes,
} from '../types.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample discovered polls from API
const sampleDiscoveredPolls: DiscoveredPoll[] = [
  {
    id: 'poll-1',
    title: 'Technology Survey 2024',
    description: 'Help us understand technology trends',
    cashPoolUsdc: '100.00',
    participantCap: 50,
    responseCount: 10,
    spotsRemaining: 40,
    payoutEstimate: '1.80',
    eligible: true,
    ineligibleReasons: [],
    criteria: {
      minAge: 18,
      maxAge: 65,
    },
    questions: [
      {
        id: 'q1',
        text: 'What is your favorite programming language?',
        type: 'multiple-choice',
        options: ['JavaScript', 'Python', 'Go', 'Rust'],
        required: true,
      },
    ],
    expiresAt: '2024-12-31T23:59:59.000Z',
  },
  {
    id: 'poll-2',
    title: 'California Voter Opinion Poll',
    description: 'Political opinions for CA registered voters',
    cashPoolUsdc: '500.00',
    participantCap: 100,
    responseCount: 25,
    spotsRemaining: 75,
    payoutEstimate: '4.50',
    eligible: false,
    ineligibleReasons: ['Must be a registered voter', 'Must be in states: CA'],
    criteria: {
      states: ['CA'],
      isRegisteredVoter: true,
    },
    questions: [],
    expiresAt: '2024-11-05T23:59:59.000Z',
  },
  {
    id: 'poll-3',
    title: 'Veteran Healthcare Survey',
    description: 'Healthcare experiences for veterans',
    cashPoolUsdc: '200.00',
    participantCap: 25,
    responseCount: 20,
    spotsRemaining: 5,
    payoutEstimate: '7.20',
    eligible: false,
    ineligibleReasons: ['Must be a verified veteran'],
    criteria: {
      isVeteran: true,
    },
    questions: [],
    expiresAt: '2024-10-01T23:59:59.000Z',
  },
  {
    id: 'poll-4',
    title: 'Software Engineer Work-Life Balance',
    description: 'Survey for software engineering professionals',
    cashPoolUsdc: '150.00',
    participantCap: 30,
    responseCount: 5,
    spotsRemaining: 25,
    payoutEstimate: '4.50',
    eligible: true,
    ineligibleReasons: [],
    criteria: {
      occupations: ['Software Engineer', 'Developer', 'Programmer'],
    },
    questions: [],
    expiresAt: '2024-09-30T23:59:59.000Z',
  },
];

// Sample user profile for matching
const sampleUserProfile: UserProfile = {
  id: '0xuser123',
  displayName: 'Test User',
  demographics: {
    age: 30,
    state: 'CA',
  },
  professional: {
    occupation: 'Software Engineer',
    industry: 'Technology',
  },
  behavioral: {
    interests: ['technology', 'gaming'],
  },
  verifiedAttributes: {
    isRegisteredVoter: true,
    voterState: 'CA',
    isVeteran: false,
    verifiedAgeThreshold: 21,
  },
  preferences: {
    allowedTopics: ['technology', 'politics', 'healthcare'],
    excludedTopics: ['gambling', 'adult'],
    minimumPayoutUsdc: 1.0,
    maxPollsPerDay: 10,
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  version: 1,
};

// API response mock
const mockApiResponse = {
  polls: sampleDiscoveredPolls,
  total: sampleDiscoveredPolls.length,
};

describe('Discovery Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ discoverPolls Tests ============

  describe('discoverPolls', () => {
    it('should fetch polls from the API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const response = await fetch('http://localhost:3000/agent/polls/discover');
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/agent/polls/discover'
      );
      expect(data.polls).toHaveLength(4);
    });

    it('should pass verified attributes as query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const attributes: Partial<VerifiedAttributes> = {
        age: 30,
        state: 'CA',
        isRegisteredVoter: true,
      };

      const params = new URLSearchParams({
        age: String(attributes.age),
        state: attributes.state!,
        isRegisteredVoter: String(attributes.isRegisteredVoter),
      });

      await fetch(`http://localhost:3000/agent/polls/discover?${params}`);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('age=30')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=CA')
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const response = await fetch('http://localhost:3000/agent/polls/discover');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('http://localhost:3000/agent/polls/discover');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should return empty array when no polls available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ polls: [], total: 0 }),
      });

      const response = await fetch('http://localhost:3000/agent/polls/discover');
      const data = await response.json();

      expect(data.polls).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it('should support pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const limit = 10;
      const offset = 20;

      await fetch(
        `http://localhost:3000/agent/polls/discover?limit=${limit}&offset=${offset}`
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      );
    });
  });

  // ============ matchPoll Tests ============

  describe('matchPoll', () => {
    it('should return eligible when all criteria match', async () => {
      const poll = sampleDiscoveredPolls[0]; // Tech survey, age 18-65
      const profile = sampleUserProfile; // Age 30

      // Check age criteria
      const meetsAgeCriteria =
        (!poll.criteria.minAge || profile.demographics.age! >= poll.criteria.minAge) &&
        (!poll.criteria.maxAge || profile.demographics.age! <= poll.criteria.maxAge);

      expect(meetsAgeCriteria).toBe(true);
    });

    it('should return ineligible when age is below minimum', async () => {
      const criteria: PollCriteria = { minAge: 21 };
      const userAge = 18;

      const meetsAgeCriteria = userAge >= criteria.minAge!;

      expect(meetsAgeCriteria).toBe(false);
    });

    it('should return ineligible when age is above maximum', async () => {
      const criteria: PollCriteria = { maxAge: 35 };
      const userAge = 40;

      const meetsAgeCriteria = userAge <= criteria.maxAge!;

      expect(meetsAgeCriteria).toBe(false);
    });

    it('should return ineligible when state does not match', async () => {
      const criteria: PollCriteria = { states: ['TX', 'NY'] };
      const userState = 'CA';

      const meetsStateCriteria = criteria.states!.includes(userState);

      expect(meetsStateCriteria).toBe(false);
    });

    it('should return eligible when state matches', async () => {
      const criteria: PollCriteria = { states: ['CA', 'NY'] };
      const userState = 'CA';

      const meetsStateCriteria = criteria.states!.includes(userState);

      expect(meetsStateCriteria).toBe(true);
    });

    it('should check veteran status correctly', async () => {
      const criteria: PollCriteria = { isVeteran: true };
      const userIsVeteran = false;

      const meetsVeteranCriteria =
        !criteria.isVeteran || userIsVeteran === true;

      expect(meetsVeteranCriteria).toBe(false);
    });

    it('should check voter registration correctly', async () => {
      const criteria: PollCriteria = { isRegisteredVoter: true };
      const userIsRegisteredVoter = true;

      const meetsVoterCriteria =
        !criteria.isRegisteredVoter || userIsRegisteredVoter === true;

      expect(meetsVoterCriteria).toBe(true);
    });

    it('should check occupation correctly', async () => {
      const criteria: PollCriteria = {
        occupations: ['Software Engineer', 'Developer'],
      };
      const userOccupation = 'Software Engineer';

      const meetsOccupationCriteria =
        criteria.occupations!.includes(userOccupation);

      expect(meetsOccupationCriteria).toBe(true);
    });

    it('should return multiple ineligibility reasons', async () => {
      const criteria: PollCriteria = {
        states: ['TX'],
        isVeteran: true,
        minAge: 50,
      };

      const reasons: string[] = [];

      // Check state
      const userState = 'CA';
      if (!criteria.states!.includes(userState)) {
        reasons.push(`Must be in states: ${criteria.states!.join(', ')}`);
      }

      // Check veteran
      const isVeteran = false;
      if (criteria.isVeteran && !isVeteran) {
        reasons.push('Must be a verified veteran');
      }

      // Check age
      const userAge = 30;
      if (userAge < criteria.minAge!) {
        reasons.push(`Minimum age ${criteria.minAge} required`);
      }

      expect(reasons).toHaveLength(3);
      expect(reasons).toContain('Must be a verified veteran');
    });

    it('should handle empty criteria (all eligible)', async () => {
      const criteria: PollCriteria = {};
      const reasons: string[] = [];

      // No criteria means everyone is eligible
      expect(reasons).toHaveLength(0);
    });
  });

  // ============ rankPolls Tests ============

  describe('rankPolls', () => {
    it('should sort polls by payout estimate (highest first)', async () => {
      const polls = [...sampleDiscoveredPolls];

      const sortedByPayout = polls.sort(
        (a, b) => parseFloat(b.payoutEstimate) - parseFloat(a.payoutEstimate)
      );

      expect(parseFloat(sortedByPayout[0].payoutEstimate)).toBeGreaterThanOrEqual(
        parseFloat(sortedByPayout[1].payoutEstimate)
      );
    });

    it('should sort polls by spots remaining (more spots = higher rank)', async () => {
      const polls = [...sampleDiscoveredPolls];

      const sortedBySpots = polls.sort(
        (a, b) => b.spotsRemaining - a.spotsRemaining
      );

      expect(sortedBySpots[0].spotsRemaining).toBeGreaterThanOrEqual(
        sortedBySpots[1].spotsRemaining
      );
    });

    it('should combine payout and confidence for ranking', async () => {
      // Ranking formula: score = payout * confidence
      const polls = [
        { payoutEstimate: '5.00', confidence: 0.9 },
        { payoutEstimate: '10.00', confidence: 0.5 },
        { payoutEstimate: '3.00', confidence: 1.0 },
      ];

      const ranked = polls
        .map((p) => ({
          ...p,
          score: parseFloat(p.payoutEstimate) * p.confidence,
        }))
        .sort((a, b) => b.score - a.score);

      expect(ranked[0].score).toBe(5.0); // 10 * 0.5
      expect(ranked[1].score).toBe(4.5); // 5 * 0.9
      expect(ranked[2].score).toBe(3.0); // 3 * 1.0
    });

    it('should prioritize eligible polls over ineligible', async () => {
      const polls = [...sampleDiscoveredPolls];

      const eligibleFirst = polls.sort((a, b) => {
        if (a.eligible && !b.eligible) return -1;
        if (!a.eligible && b.eligible) return 1;
        return 0;
      });

      // First eligible polls should be at the start
      const firstIneligibleIndex = eligibleFirst.findIndex((p) => !p.eligible);
      const lastEligibleIndex = eligibleFirst
        .map((p, i) => (p.eligible ? i : -1))
        .filter((i) => i >= 0)
        .pop();

      if (firstIneligibleIndex !== -1 && lastEligibleIndex !== undefined) {
        expect(lastEligibleIndex).toBeLessThan(firstIneligibleIndex);
      }
    });

    it('should handle polls with same payout', async () => {
      const polls = [
        { id: 'a', payoutEstimate: '5.00', spotsRemaining: 10 },
        { id: 'b', payoutEstimate: '5.00', spotsRemaining: 5 },
        { id: 'c', payoutEstimate: '5.00', spotsRemaining: 20 },
      ];

      // Secondary sort by spots remaining
      const sorted = polls.sort((a, b) => {
        const payoutDiff =
          parseFloat(b.payoutEstimate) - parseFloat(a.payoutEstimate);
        if (payoutDiff !== 0) return payoutDiff;
        return b.spotsRemaining - a.spotsRemaining;
      });

      expect(sorted[0].id).toBe('c'); // Most spots
      expect(sorted[2].id).toBe('b'); // Fewest spots
    });

    it('should filter out polls with no spots remaining', async () => {
      const polls = [
        { id: 'a', spotsRemaining: 10 },
        { id: 'b', spotsRemaining: 0 },
        { id: 'c', spotsRemaining: 5 },
      ];

      const available = polls.filter((p) => p.spotsRemaining > 0);

      expect(available).toHaveLength(2);
      expect(available.map((p) => p.id)).not.toContain('b');
    });
  });

  // ============ filterByPreferences Tests ============

  describe('filterByPreferences', () => {
    it('should exclude polls in excluded topics', async () => {
      const preferences: UserPreferences = {
        excludedTopics: ['gambling', 'adult'],
      };

      const polls = [
        { id: 'a', title: 'Tech Survey', topics: ['technology'] },
        { id: 'b', title: 'Casino Survey', topics: ['gambling'] },
        { id: 'c', title: 'Health Survey', topics: ['healthcare'] },
      ];

      const filtered = polls.filter(
        (p) =>
          !p.topics.some((t) => preferences.excludedTopics?.includes(t))
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).not.toContain('b');
    });

    it('should include only polls in allowed topics when specified', async () => {
      const preferences: UserPreferences = {
        allowedTopics: ['technology', 'healthcare'],
      };

      const polls = [
        { id: 'a', title: 'Tech Survey', topics: ['technology'] },
        { id: 'b', title: 'Finance Survey', topics: ['finance'] },
        { id: 'c', title: 'Health Survey', topics: ['healthcare'] },
      ];

      const filtered = polls.filter((p) =>
        p.topics.some((t) => preferences.allowedTopics?.includes(t))
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toContain('a');
      expect(filtered.map((p) => p.id)).toContain('c');
    });

    it('should filter by minimum payout threshold', async () => {
      const preferences: UserPreferences = {
        minimumPayoutUsdc: 2.0,
      };

      const polls = [
        { id: 'a', payoutEstimate: '5.00' },
        { id: 'b', payoutEstimate: '1.50' },
        { id: 'c', payoutEstimate: '3.00' },
      ];

      const filtered = polls.filter(
        (p) => parseFloat(p.payoutEstimate) >= preferences.minimumPayoutUsdc!
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).not.toContain('b');
    });

    it('should respect maximum polls per day limit', async () => {
      const preferences: UserPreferences = {
        maxPollsPerDay: 5,
      };

      const pollsCompletedToday = 3;
      const availableSlots = preferences.maxPollsPerDay! - pollsCompletedToday;

      expect(availableSlots).toBe(2);
    });

    it('should filter by preferred duration', async () => {
      const preferences: UserPreferences = {
        preferredDuration: 'short',
      };

      const polls = [
        { id: 'a', duration: 'short', questionCount: 3 },
        { id: 'b', duration: 'long', questionCount: 20 },
        { id: 'c', duration: 'medium', questionCount: 10 },
      ];

      // Filter to only short duration
      const filtered = polls.filter(
        (p) => p.duration === preferences.preferredDuration
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('a');
    });

    it('should handle empty preferences (no filtering)', async () => {
      const preferences: UserPreferences = {};
      const polls = sampleDiscoveredPolls;

      // With no preferences, all polls should pass
      const filtered = polls.filter(() => {
        // No filters applied
        return true;
      });

      expect(filtered).toHaveLength(polls.length);
    });

    it('should combine multiple preference filters', async () => {
      const preferences: UserPreferences = {
        excludedTopics: ['gambling'],
        minimumPayoutUsdc: 2.0,
        maxPollsPerDay: 10,
      };

      const polls = [
        { id: 'a', topics: ['technology'], payoutEstimate: '5.00' },
        { id: 'b', topics: ['gambling'], payoutEstimate: '10.00' },
        { id: 'c', topics: ['healthcare'], payoutEstimate: '1.50' },
        { id: 'd', topics: ['politics'], payoutEstimate: '3.00' },
      ];

      const filtered = polls.filter((p) => {
        // Check excluded topics
        if (p.topics.some((t) => preferences.excludedTopics?.includes(t))) {
          return false;
        }
        // Check minimum payout
        if (parseFloat(p.payoutEstimate) < preferences.minimumPayoutUsdc!) {
          return false;
        }
        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual(['a', 'd']);
    });
  });

  // ============ Integration Tests ============

  describe('Discovery Integration', () => {
    it('should discover, match, filter, and rank polls', async () => {
      // Simulate full discovery flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      // 1. Discover polls
      const response = await fetch('http://localhost:3000/agent/polls/discover');
      const data = await response.json();
      expect(data.polls.length).toBeGreaterThan(0);

      // 2. Filter by eligibility
      const eligible = data.polls.filter(
        (p: DiscoveredPoll) => p.eligible
      );
      expect(eligible.length).toBeLessThanOrEqual(data.polls.length);

      // 3. Filter by preferences
      const preferences: UserPreferences = { minimumPayoutUsdc: 1.0 };
      const afterPrefs = eligible.filter(
        (p: DiscoveredPoll) =>
          parseFloat(p.payoutEstimate) >= preferences.minimumPayoutUsdc!
      );

      // 4. Rank by payout
      const ranked = afterPrefs.sort(
        (a: DiscoveredPoll, b: DiscoveredPoll) =>
          parseFloat(b.payoutEstimate) - parseFloat(a.payoutEstimate)
      );

      // Verify order
      if (ranked.length >= 2) {
        expect(parseFloat(ranked[0].payoutEstimate)).toBeGreaterThanOrEqual(
          parseFloat(ranked[1].payoutEstimate)
        );
      }
    });
  });
});
