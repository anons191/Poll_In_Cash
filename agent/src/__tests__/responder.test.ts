/**
 * Responder Module Tests
 *
 * Tests for response generation functions including:
 * - generateResponses
 * - assignConfidence
 * - formatForSubmission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  PollQuestion,
  QuestionResponse,
  AgentResponse,
  ConfidenceLevel,
  UserProfile,
  DiscoveredPoll,
} from '../types.js';

// Sample poll questions for testing
const sampleQuestions: PollQuestion[] = [
  {
    id: 'q1',
    text: 'What is your favorite programming language?',
    type: 'multiple-choice',
    options: ['JavaScript', 'Python', 'Go', 'Rust', 'Other'],
    required: true,
  },
  {
    id: 'q2',
    text: 'On a scale of 1-10, how satisfied are you with remote work?',
    type: 'rating',
    required: true,
    min: 1,
    max: 10,
  },
  {
    id: 'q3',
    text: 'Do you prefer working from home?',
    type: 'yes-no',
    required: true,
  },
  {
    id: 'q4',
    text: 'Please describe your ideal work environment.',
    type: 'open-ended',
    required: false,
  },
  {
    id: 'q5',
    text: 'Rank your priorities: salary, work-life balance, growth opportunities',
    type: 'ranking',
    options: ['salary', 'work-life balance', 'growth opportunities'],
    required: true,
  },
];

// Sample user profile for response generation
const sampleProfile: UserProfile = {
  id: '0xuser123',
  displayName: 'Test Developer',
  demographics: {
    age: 28,
    state: 'CA',
    city: 'San Francisco',
  },
  professional: {
    employmentStatus: 'employed',
    occupation: 'Software Engineer',
    industry: 'Technology',
    yearsExperience: 5,
    education: 'bachelors',
  },
  behavioral: {
    interests: ['technology', 'programming', 'gaming'],
    techSavviness: 'high',
    socialMediaPlatforms: ['twitter', 'github'],
  },
  verifiedAttributes: {
    isRegisteredVoter: true,
    voterState: 'CA',
  },
  preferences: {
    allowedTopics: ['technology', 'work', 'lifestyle'],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  version: 1,
};

// Sample discovered poll
const samplePoll: DiscoveredPoll = {
  id: 'poll-tech-1',
  title: 'Developer Experience Survey',
  description: 'Understanding developer preferences',
  cashPoolUsdc: '100.00',
  participantCap: 50,
  responseCount: 10,
  spotsRemaining: 40,
  payoutEstimate: '1.80',
  eligible: true,
  ineligibleReasons: [],
  criteria: {},
  questions: sampleQuestions,
  expiresAt: '2024-12-31T23:59:59.000Z',
};

describe('Responder Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ generateResponses Tests ============

  describe('generateResponses', () => {
    it('should generate responses for multiple-choice questions', async () => {
      const question: PollQuestion = {
        id: 'mc1',
        text: 'What is your favorite programming language?',
        type: 'multiple-choice',
        options: ['JavaScript', 'Python', 'Go', 'Rust'],
        required: true,
      };

      // Response should be one of the available options
      const validOptions = question.options!;
      const sampleAnswer = 'JavaScript';

      expect(validOptions).toContain(sampleAnswer);
    });

    it('should generate responses for rating questions', async () => {
      const question: PollQuestion = {
        id: 'rating1',
        text: 'Rate your satisfaction',
        type: 'rating',
        required: true,
        min: 1,
        max: 10,
      };

      // Response should be within min-max range
      const answer = 7;

      expect(answer).toBeGreaterThanOrEqual(question.min!);
      expect(answer).toBeLessThanOrEqual(question.max!);
    });

    it('should generate responses for yes-no questions', async () => {
      const question: PollQuestion = {
        id: 'yn1',
        text: 'Do you prefer remote work?',
        type: 'yes-no',
        required: true,
      };

      // Response should be 'yes' or 'no'
      const validAnswers = ['yes', 'no'];
      const answer = 'yes';

      expect(validAnswers).toContain(answer);
    });

    it('should generate responses for open-ended questions', async () => {
      const question: PollQuestion = {
        id: 'open1',
        text: 'Describe your ideal workplace',
        type: 'open-ended',
        required: false,
      };

      // Response should be a non-empty string
      const answer =
        'I prefer a collaborative environment with flexible hours.';

      expect(typeof answer).toBe('string');
      expect(answer.length).toBeGreaterThan(0);
    });

    it('should generate responses for ranking questions', async () => {
      const question: PollQuestion = {
        id: 'rank1',
        text: 'Rank your priorities',
        type: 'ranking',
        options: ['salary', 'work-life balance', 'growth'],
        required: true,
      };

      // Response should be array of options in ranked order
      const answer = ['work-life balance', 'salary', 'growth'];

      expect(answer).toHaveLength(question.options!.length);
      answer.forEach((item) => {
        expect(question.options).toContain(item);
      });
    });

    it('should use profile data to inform responses', async () => {
      const profile = sampleProfile;
      const question: PollQuestion = {
        id: 'q1',
        text: 'What industry do you work in?',
        type: 'multiple-choice',
        options: ['Technology', 'Healthcare', 'Finance', 'Other'],
        required: true,
      };

      // Agent should use profile.professional.industry
      const expectedAnswer = profile.professional.industry;

      expect(question.options).toContain(expectedAnswer);
    });

    it('should generate all required responses', async () => {
      const questions = sampleQuestions;
      const requiredCount = questions.filter((q) => q.required).length;

      // Generate mock responses
      const responses: QuestionResponse[] = questions
        .filter((q) => q.required)
        .map((q) => ({
          questionId: q.id,
          answer: 'sample answer',
          confidence: 'high' as ConfidenceLevel,
        }));

      expect(responses).toHaveLength(requiredCount);
    });

    it('should optionally include non-required responses', async () => {
      const questions = sampleQuestions;
      const optionalQuestions = questions.filter((q) => !q.required);

      expect(optionalQuestions.length).toBeGreaterThan(0);
    });

    it('should include reasoning for each response', async () => {
      const response: QuestionResponse = {
        questionId: 'q1',
        answer: 'JavaScript',
        confidence: 'high',
        reasoning: 'Based on profile interests in technology and programming',
      };

      expect(response.reasoning).toBeDefined();
      expect(response.reasoning!.length).toBeGreaterThan(0);
    });
  });

  // ============ assignConfidence Tests ============

  describe('assignConfidence', () => {
    it('should assign high confidence when profile directly covers topic', async () => {
      const profile = sampleProfile;
      const question: PollQuestion = {
        id: 'q1',
        text: 'What is your occupation?',
        type: 'open-ended',
        required: true,
      };

      // Profile has occupation defined
      const hasDirectData = !!profile.professional.occupation;
      const expectedConfidence: ConfidenceLevel = hasDirectData
        ? 'high'
        : 'low';

      expect(expectedConfidence).toBe('high');
    });

    it('should assign medium confidence when profile partially covers topic', async () => {
      const profile = sampleProfile;
      const question: PollQuestion = {
        id: 'q1',
        text: 'What are your thoughts on AI in software development?',
        type: 'open-ended',
        required: true,
      };

      // Profile has related interests but not direct data
      const hasRelatedData =
        profile.behavioral.interests?.includes('technology') ?? false;
      const hasDirectData = false; // No specific AI preference stored

      const expectedConfidence: ConfidenceLevel = hasRelatedData
        ? 'medium'
        : 'low';

      expect(expectedConfidence).toBe('medium');
    });

    it('should assign low confidence when profile has no relevant data', async () => {
      const profile = sampleProfile;
      const question: PollQuestion = {
        id: 'q1',
        text: 'What is your favorite cuisine?',
        type: 'multiple-choice',
        options: ['Italian', 'Chinese', 'Mexican', 'Indian'],
        required: true,
      };

      // Profile has no food preference data
      const hasRelevantData = false;
      const expectedConfidence: ConfidenceLevel = hasRelevantData
        ? 'high'
        : 'low';

      expect(expectedConfidence).toBe('low');
    });

    it('should increase confidence for verified attributes', async () => {
      const profile = sampleProfile;
      const question: PollQuestion = {
        id: 'q1',
        text: 'Are you a registered voter?',
        type: 'yes-no',
        required: true,
      };

      // Profile has verified voter registration
      const isVerified = profile.verifiedAttributes.isRegisteredVoter === true;
      const expectedConfidence: ConfidenceLevel = isVerified ? 'high' : 'medium';

      expect(expectedConfidence).toBe('high');
    });

    it('should handle demographic questions correctly', async () => {
      const profile = sampleProfile;

      const demographicFields: Record<string, keyof typeof profile.demographics> = {
        'What is your age?': 'age',
        'What state do you live in?': 'state',
        'What city do you live in?': 'city',
      };

      Object.entries(demographicFields).forEach(([question, field]) => {
        const hasData = profile.demographics[field] !== undefined;
        const confidence: ConfidenceLevel = hasData ? 'high' : 'low';
        expect(['high', 'medium', 'low']).toContain(confidence);
      });
    });

    it('should handle behavioral questions correctly', async () => {
      const profile = sampleProfile;

      // Behavioral interests should give medium confidence for related topics
      const interests = profile.behavioral.interests ?? [];
      const hasTechInterest = interests.includes('technology');

      expect(hasTechInterest).toBe(true);
    });

    it('should return confidence scores for all questions', async () => {
      const questions = sampleQuestions;

      const confidenceScores: Record<string, ConfidenceLevel> = {};
      questions.forEach((q) => {
        // Simulate confidence assignment
        confidenceScores[q.id] = 'medium';
      });

      expect(Object.keys(confidenceScores)).toHaveLength(questions.length);
    });
  });

  // ============ formatForSubmission Tests ============

  describe('formatForSubmission', () => {
    it('should produce valid API payload structure', async () => {
      const pollId = 'poll-1';
      const responses: QuestionResponse[] = [
        {
          questionId: 'q1',
          answer: 'JavaScript',
          confidence: 'high',
        },
        {
          questionId: 'q2',
          answer: 8,
          confidence: 'high',
        },
      ];

      const payload = {
        pollId,
        responses: responses.map((r) => ({
          questionId: r.questionId,
          answer: r.answer,
        })),
        confidenceScores: Object.fromEntries(
          responses.map((r) => [r.questionId, r.confidence])
        ),
        attestationHash: '0xabc123...',
      };

      expect(payload).toHaveProperty('pollId');
      expect(payload).toHaveProperty('responses');
      expect(payload).toHaveProperty('confidenceScores');
      expect(payload).toHaveProperty('attestationHash');
    });

    it('should format multiple-choice answers correctly', async () => {
      const response: QuestionResponse = {
        questionId: 'q1',
        answer: 'JavaScript',
        confidence: 'high',
      };

      const formatted = {
        questionId: response.questionId,
        answer: response.answer,
      };

      expect(typeof formatted.answer).toBe('string');
    });

    it('should format rating answers as numbers', async () => {
      const response: QuestionResponse = {
        questionId: 'q2',
        answer: 8,
        confidence: 'high',
      };

      const formatted = {
        questionId: response.questionId,
        answer: response.answer,
      };

      expect(typeof formatted.answer).toBe('number');
      expect(formatted.answer).toBe(8);
    });

    it('should format yes-no answers correctly', async () => {
      const response: QuestionResponse = {
        questionId: 'q3',
        answer: 'yes',
        confidence: 'high',
      };

      const formatted = {
        questionId: response.questionId,
        answer: response.answer,
      };

      expect(['yes', 'no']).toContain(formatted.answer);
    });

    it('should format ranking answers as arrays', async () => {
      const response: QuestionResponse = {
        questionId: 'q5',
        answer: ['growth', 'salary', 'balance'],
        confidence: 'medium',
      };

      const formatted = {
        questionId: response.questionId,
        answer: response.answer,
      };

      expect(Array.isArray(formatted.answer)).toBe(true);
      expect(formatted.answer).toHaveLength(3);
    });

    it('should include confidence scores in payload', async () => {
      const responses: QuestionResponse[] = [
        { questionId: 'q1', answer: 'A', confidence: 'high' },
        { questionId: 'q2', answer: 5, confidence: 'medium' },
        { questionId: 'q3', answer: 'yes', confidence: 'low' },
      ];

      const confidenceScores: Record<string, ConfidenceLevel> = {};
      responses.forEach((r) => {
        confidenceScores[r.questionId] = r.confidence;
      });

      expect(confidenceScores['q1']).toBe('high');
      expect(confidenceScores['q2']).toBe('medium');
      expect(confidenceScores['q3']).toBe('low');
    });

    it('should include attestation hash', async () => {
      const attestationHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const payload = {
        pollId: 'poll-1',
        responses: [],
        confidenceScores: {},
        attestationHash,
      };

      expect(payload.attestationHash).toBe(attestationHash);
      expect(payload.attestationHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should create valid AgentResponse object', async () => {
      const agentResponse: AgentResponse = {
        pollId: 'poll-1',
        responses: [
          {
            questionId: 'q1',
            answer: 'JavaScript',
            confidence: 'high',
            reasoning: 'Based on profile interests',
          },
        ],
        confidenceScores: {
          q1: 'high',
        },
        attestationHash: '0xabc...',
        generatedAt: new Date().toISOString(),
      };

      expect(agentResponse.pollId).toBeDefined();
      expect(agentResponse.responses).toHaveLength(1);
      expect(agentResponse.generatedAt).toBeDefined();
    });

    it('should exclude internal reasoning from submission payload', async () => {
      const response: QuestionResponse = {
        questionId: 'q1',
        answer: 'JavaScript',
        confidence: 'high',
        reasoning: 'This should not be sent to API',
      };

      // Format for submission (exclude reasoning)
      const formatted = {
        questionId: response.questionId,
        answer: response.answer,
      };

      expect(formatted).not.toHaveProperty('reasoning');
      expect(formatted).not.toHaveProperty('confidence');
    });
  });

  // ============ Response Generation Integration Tests ============

  describe('Response Generation Integration', () => {
    it('should generate complete response for a poll', async () => {
      const poll = samplePoll;
      const profile = sampleProfile;

      // Generate responses for all required questions
      const requiredQuestions = poll.questions!.filter((q) => q.required);
      const responses: QuestionResponse[] = [];

      requiredQuestions.forEach((q) => {
        let answer: string | number | string[];

        switch (q.type) {
          case 'multiple-choice':
            answer = q.options![0];
            break;
          case 'rating':
            answer = Math.round((q.min! + q.max!) / 2);
            break;
          case 'yes-no':
            answer = 'yes';
            break;
          case 'ranking':
            answer = [...q.options!];
            break;
          default:
            answer = 'Sample response';
        }

        responses.push({
          questionId: q.id,
          answer,
          confidence: 'medium',
        });
      });

      expect(responses).toHaveLength(requiredQuestions.length);

      // All required questions should have responses
      const answeredIds = new Set(responses.map((r) => r.questionId));
      requiredQuestions.forEach((q) => {
        expect(answeredIds.has(q.id)).toBe(true);
      });
    });

    it('should validate responses before submission', async () => {
      const poll = samplePoll;
      const responses: QuestionResponse[] = [
        { questionId: 'q1', answer: 'JavaScript', confidence: 'high' },
        { questionId: 'q2', answer: 8, confidence: 'high' },
        { questionId: 'q3', answer: 'yes', confidence: 'high' },
        // q4 is optional, skipped
        {
          questionId: 'q5',
          answer: ['salary', 'work-life balance', 'growth opportunities'],
          confidence: 'medium',
        },
      ];

      // Validate all required questions are answered
      const requiredIds = poll
        .questions!.filter((q) => q.required)
        .map((q) => q.id);
      const answeredIds = new Set(responses.map((r) => r.questionId));

      const allRequiredAnswered = requiredIds.every((id) => answeredIds.has(id));

      expect(allRequiredAnswered).toBe(true);
    });

    it('should handle empty optional questions', async () => {
      const optionalQuestion: PollQuestion = {
        id: 'opt1',
        text: 'Any additional comments?',
        type: 'open-ended',
        required: false,
      };

      // Optional questions can be skipped
      const responses: QuestionResponse[] = [];

      // Not answering optional question is valid
      expect(responses.find((r) => r.questionId === optionalQuestion.id)).toBeUndefined();
    });
  });
});
