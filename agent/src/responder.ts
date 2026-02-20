/**
 * Response Generator
 *
 * Generates thoughtful poll responses based on user profile.
 * Handles confidence scoring and response formatting for submission.
 * Can optionally integrate with Claude API for sophisticated responses.
 *
 * @module agent/responder
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  DiscoveredPoll,
  PollQuestion,
  UserProfile,
  QuestionResponse,
  ConfidenceLevel,
  AgentResponse,
  AgentConfig,
} from './types.js';

/**
 * Response submission format for the API
 */
export interface ResponseSubmission {
  responses: Array<{
    questionId: string;
    answer: string | number | string[];
  }>;
  confidenceScores: Record<string, ConfidenceLevel>;
  attestationHash: string;
}

/**
 * Generate a response to a single question based on profile
 * Uses simple heuristics for basic response generation
 */
export function generateBasicResponse(
  question: PollQuestion,
  profile: UserProfile
): QuestionResponse {
  let answer: string | number | string[];
  let confidence: ConfidenceLevel = 'medium';
  let reasoning = '';

  switch (question.type) {
    case 'yes-no':
      // Generate a yes/no based on profile tendencies
      answer = generateYesNoResponse(question, profile);
      confidence = assessYesNoConfidence(question, profile);
      reasoning = `Based on profile demographics and behavioral patterns`;
      break;

    case 'multiple-choice':
      if (question.options && question.options.length > 0) {
        answer = selectMultipleChoiceAnswer(question, profile);
        confidence = 'medium';
        reasoning = `Selected based on profile characteristics`;
      } else {
        answer = '';
        confidence = 'low';
        reasoning = 'No options provided';
      }
      break;

    case 'rating':
      answer = generateRatingResponse(question, profile);
      confidence = 'medium';
      reasoning = `Rating based on profile behavioral tendencies`;
      break;

    case 'ranking':
      if (question.options && question.options.length > 0) {
        answer = question.options; // Return in order (can be shuffled based on preferences)
        confidence = 'low';
        reasoning = 'Default ordering - would need more context';
      } else {
        answer = [];
        confidence = 'low';
        reasoning = 'No options to rank';
      }
      break;

    case 'open-ended':
      answer = generateOpenEndedResponse(question, profile);
      confidence = assessOpenEndedConfidence(question, profile);
      reasoning = `Generated based on profile context`;
      break;

    default:
      answer = '';
      confidence = 'low';
      reasoning = 'Unknown question type';
  }

  return {
    questionId: question.id,
    answer,
    confidence,
    reasoning,
  };
}

/**
 * Generate a yes/no response based on question context and profile
 */
function generateYesNoResponse(question: PollQuestion, profile: UserProfile): string {
  const text = question.text.toLowerCase();

  // Check for specific topics that can be answered from profile
  if (text.includes('veteran') || text.includes('military')) {
    return profile.verifiedAttributes.isVeteran ? 'yes' : 'no';
  }
  if (text.includes('registered voter') || text.includes('voting')) {
    return profile.verifiedAttributes.isRegisteredVoter ? 'yes' : 'no';
  }
  if (text.includes('student')) {
    return profile.verifiedAttributes.isStudent ? 'yes' : 'no';
  }
  if (text.includes('employed') || text.includes('working')) {
    return profile.professional.employmentStatus === 'employed' ||
           profile.professional.employmentStatus === 'self-employed' ? 'yes' : 'no';
  }
  if (text.includes('retired')) {
    return profile.professional.employmentStatus === 'retired' ? 'yes' : 'no';
  }

  // Default to slight positive bias (can be tuned)
  return Math.random() > 0.4 ? 'yes' : 'no';
}

/**
 * Assess confidence for a yes/no answer
 */
function assessYesNoConfidence(question: PollQuestion, profile: UserProfile): ConfidenceLevel {
  const text = question.text.toLowerCase();

  // High confidence if we have verified attributes
  if (text.includes('veteran') && profile.verifiedAttributes.isVeteran !== undefined) {
    return 'high';
  }
  if (text.includes('voter') && profile.verifiedAttributes.isRegisteredVoter !== undefined) {
    return 'high';
  }
  if (text.includes('student') && profile.verifiedAttributes.isStudent !== undefined) {
    return 'high';
  }
  if (text.includes('employed') && profile.professional.employmentStatus) {
    return 'high';
  }

  return 'medium';
}

/**
 * Select an answer for multiple choice questions
 */
function selectMultipleChoiceAnswer(question: PollQuestion, profile: UserProfile): string {
  const options = question.options || [];
  const text = question.text.toLowerCase();

  // Try to match based on profile data
  if (text.includes('state') || text.includes('location')) {
    const state = profile.demographics.state;
    if (state && options.includes(state)) {
      return state;
    }
  }

  if (text.includes('occupation') || text.includes('job') || text.includes('work')) {
    const occupation = profile.professional.occupation;
    if (occupation) {
      const match = options.find((o) => o.toLowerCase().includes(occupation.toLowerCase()));
      if (match) return match;
    }
  }

  if (text.includes('education') || text.includes('degree')) {
    const education = profile.professional.education;
    if (education) {
      const educationMap: Record<string, string[]> = {
        'high-school': ['high school', 'hs', 'secondary'],
        'some-college': ['some college', 'associate'],
        'bachelors': ['bachelor', 'undergraduate', 'college'],
        'masters': ['master', 'graduate'],
        'doctorate': ['doctorate', 'phd', 'doctoral'],
      };
      const keywords = educationMap[education] || [];
      const match = options.find((o) =>
        keywords.some((k) => o.toLowerCase().includes(k))
      );
      if (match) return match;
    }
  }

  if (text.includes('income') || text.includes('salary')) {
    const income = profile.professional.incomeRange;
    if (income) {
      const match = options.find((o) => o.toLowerCase().includes(income.replace('-', ' ')));
      if (match) return match;
    }
  }

  if (text.includes('gender')) {
    const gender = profile.demographics.gender;
    if (gender) {
      const match = options.find((o) => o.toLowerCase() === gender.toLowerCase());
      if (match) return match;
    }
  }

  // Default: select middle option (often neutral)
  const middleIndex = Math.floor(options.length / 2);
  return options[middleIndex] || options[0] || '';
}

/**
 * Generate a rating response (typically 1-5 or 1-10)
 */
function generateRatingResponse(question: PollQuestion, profile: UserProfile): number {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  const range = max - min;
  const midpoint = min + range / 2;
  const text = question.text.toLowerCase();

  // Adjust based on profile characteristics
  let bias = 0;

  // Political questions might use political leaning
  if (text.includes('political') || text.includes('conservative') || text.includes('liberal')) {
    if (profile.behavioral.politicalLeaning !== undefined) {
      // Scale political leaning (1-10) to rating scale
      bias = ((profile.behavioral.politicalLeaning - 5.5) / 4.5) * (range / 2);
    }
  }

  // Tech-related questions
  if (text.includes('technology') || text.includes('tech') || text.includes('digital')) {
    const techMap: Record<string, number> = { low: -1, medium: 0, high: 1 };
    bias = (techMap[profile.behavioral.techSavviness || 'medium'] || 0) * (range / 3);
  }

  // Apply some randomness
  const randomOffset = (Math.random() - 0.5) * (range / 4);

  // Calculate final rating
  let rating = Math.round(midpoint + bias + randomOffset);
  rating = Math.max(min, Math.min(max, rating));

  return rating;
}

/**
 * Generate an open-ended response
 */
function generateOpenEndedResponse(question: PollQuestion, profile: UserProfile): string {
  const text = question.text.toLowerCase();

  // Generate contextual responses based on question topic
  if (text.includes('why') || text.includes('reason')) {
    return 'Based on my personal experience and values, I believe this is important for maintaining balance in daily life.';
  }

  if (text.includes('opinion') || text.includes('think')) {
    return 'I think this is a nuanced topic that requires careful consideration of multiple perspectives.';
  }

  if (text.includes('experience')) {
    const occupation = profile.professional.occupation || 'my field';
    return `In my experience working in ${occupation}, I have found that consistency and attention to detail are key factors.`;
  }

  if (text.includes('improve') || text.includes('change')) {
    return 'I would focus on improving communication and transparency, as these tend to be foundational to positive outcomes.';
  }

  if (text.includes('describe') || text.includes('explain')) {
    return 'This is something that varies based on individual circumstances, but generally involves balancing multiple priorities.';
  }

  // Generic thoughtful response
  return 'This is something I have thought about, and I believe that a balanced approach considering various factors is most effective.';
}

/**
 * Assess confidence for open-ended responses
 */
function assessOpenEndedConfidence(question: PollQuestion, profile: UserProfile): ConfidenceLevel {
  const text = question.text.toLowerCase();

  // Higher confidence if question relates to profile data
  if (text.includes('occupation') || text.includes('job') || text.includes('work')) {
    if (profile.professional.occupation) return 'high';
  }

  if (text.includes('where you live') || text.includes('state') || text.includes('location')) {
    if (profile.demographics.state) return 'high';
  }

  // Medium confidence for general opinion questions
  if (text.includes('opinion') || text.includes('think')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate responses for all questions in a poll
 */
export function generateResponses(
  poll: DiscoveredPoll,
  profile: UserProfile
): QuestionResponse[] {
  const questions = poll.questions || [];
  return questions.map((question) => generateBasicResponse(question, profile));
}

/**
 * Assign confidence to a response based on profile coverage
 */
export function assignConfidence(
  response: QuestionResponse,
  _profile: UserProfile,
  _question?: PollQuestion
): ConfidenceLevel {
  // If we already have confidence from generation, use it
  if (response.confidence) {
    return response.confidence;
  }

  // Default assessment
  return 'medium';
}

/**
 * Format responses for submission to the API
 */
export function formatForSubmission(
  responses: QuestionResponse[],
  attestationHash: string
): ResponseSubmission {
  const confidenceScores: Record<string, ConfidenceLevel> = {};

  const formattedResponses = responses.map((r) => {
    confidenceScores[r.questionId] = r.confidence;
    return {
      questionId: r.questionId,
      answer: r.answer,
    };
  });

  return {
    responses: formattedResponses,
    confidenceScores,
    attestationHash,
  };
}

/**
 * Generate a complete agent response for a poll
 */
export function generateAgentResponse(
  poll: DiscoveredPoll,
  profile: UserProfile,
  attestationHash: string
): AgentResponse {
  const responses = generateResponses(poll, profile);
  const confidenceScores: Record<string, ConfidenceLevel> = {};

  for (const response of responses) {
    confidenceScores[response.questionId] = response.confidence;
  }

  return {
    pollId: poll.id,
    responses,
    confidenceScores,
    attestationHash,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Response Generator class with Claude API integration
 */
export class ResponseGenerator {
  private anthropic: Anthropic | null = null;
  private useClaudeApi: boolean = false;

  constructor(_config: AgentConfig) {
    // Config stored for future use (e.g., model selection, API settings)
    void _config;

    // Initialize Anthropic client if API key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.useClaudeApi = true;
    }
  }

  /**
   * Enable or disable Claude API usage
   */
  setUseClaudeApi(use: boolean): void {
    if (use && !this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }
    this.useClaudeApi = use;
  }

  /**
   * Generate responses for a poll
   */
  async generate(
    poll: DiscoveredPoll,
    profile: UserProfile
  ): Promise<QuestionResponse[]> {
    if (this.useClaudeApi && this.anthropic) {
      return this.generateWithClaude(poll, profile);
    }
    return generateResponses(poll, profile);
  }

  /**
   * Generate responses using Claude API for more sophisticated answers
   */
  private async generateWithClaude(
    poll: DiscoveredPoll,
    profile: UserProfile
  ): Promise<QuestionResponse[]> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const questions = poll.questions || [];
    const responses: QuestionResponse[] = [];

    // Build profile context
    const profileContext = this.buildProfileContext(profile);

    for (const question of questions) {
      const response = await this.generateSingleWithClaude(question, profileContext, profile);
      responses.push(response);
    }

    return responses;
  }

  /**
   * Build a context string from the profile
   */
  private buildProfileContext(profile: UserProfile): string {
    const parts: string[] = [];

    // Demographics
    if (profile.demographics.age) parts.push(`Age: ${profile.demographics.age}`);
    if (profile.demographics.gender) parts.push(`Gender: ${profile.demographics.gender}`);
    if (profile.demographics.state) parts.push(`State: ${profile.demographics.state}`);
    if (profile.demographics.city) parts.push(`City: ${profile.demographics.city}`);

    // Professional
    if (profile.professional.occupation) parts.push(`Occupation: ${profile.professional.occupation}`);
    if (profile.professional.industry) parts.push(`Industry: ${profile.professional.industry}`);
    if (profile.professional.education) parts.push(`Education: ${profile.professional.education}`);
    if (profile.professional.employmentStatus) parts.push(`Employment: ${profile.professional.employmentStatus}`);

    // Behavioral
    if (profile.behavioral.politicalLeaning !== undefined) {
      parts.push(`Political leaning: ${profile.behavioral.politicalLeaning}/10 (1=liberal, 10=conservative)`);
    }
    if (profile.behavioral.interests && profile.behavioral.interests.length > 0) {
      parts.push(`Interests: ${profile.behavioral.interests.join(', ')}`);
    }
    if (profile.behavioral.techSavviness) {
      parts.push(`Tech savviness: ${profile.behavioral.techSavviness}`);
    }

    // Verified attributes
    if (profile.verifiedAttributes.isVeteran) parts.push('Verified veteran');
    if (profile.verifiedAttributes.isRegisteredVoter) parts.push('Registered voter');
    if (profile.verifiedAttributes.isStudent) parts.push('Student');

    return parts.join('\n');
  }

  /**
   * Generate a single response using Claude
   */
  private async generateSingleWithClaude(
    question: PollQuestion,
    profileContext: string,
    profile: UserProfile
  ): Promise<QuestionResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemPrompt = `You are helping a user respond to a poll question. Based on their profile information, generate an authentic response that reflects their likely opinion or situation.

User Profile:
${profileContext}

Guidelines:
- Be authentic and consistent with the profile
- For multiple choice, respond with exactly one of the given options
- For yes/no, respond with exactly "yes" or "no"
- For ratings, respond with a number within the given range
- For open-ended, keep responses concise (1-3 sentences)
- If the profile doesn't have relevant information, make a reasonable inference`;

    let questionPrompt = `Question: ${question.text}\nType: ${question.type}`;

    if (question.options && question.options.length > 0) {
      questionPrompt += `\nOptions: ${question.options.join(', ')}`;
    }
    if (question.min !== undefined && question.max !== undefined) {
      questionPrompt += `\nRating range: ${question.min} to ${question.max}`;
    }

    questionPrompt += '\n\nRespond with ONLY the answer, no explanation.';

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: questionPrompt }],
      });

      const content = message.content[0];
      const answerText = content.type === 'text' ? content.text.trim() : '';

      // Parse the answer based on question type
      let answer: string | number | string[] = answerText;

      if (question.type === 'rating') {
        const num = parseInt(answerText, 10);
        if (!isNaN(num)) {
          answer = num;
        }
      } else if (question.type === 'ranking' && question.options) {
        // Try to parse as a list
        answer = answerText.split(',').map((s) => s.trim());
      }

      return {
        questionId: question.id,
        answer,
        confidence: 'high', // Claude responses are generally high confidence
        reasoning: 'Generated with Claude AI assistance',
      };
    } catch (error) {
      // Fall back to basic response on error
      console.error('Claude API error, falling back to basic response:', error);
      return generateBasicResponse(question, profile);
    }
  }

  /**
   * Format responses for submission
   */
  format(
    responses: QuestionResponse[],
    attestationHash: string
  ): ResponseSubmission {
    return formatForSubmission(responses, attestationHash);
  }

  /**
   * Generate a complete agent response
   */
  async generateAgentResponse(
    poll: DiscoveredPoll,
    profile: UserProfile,
    attestationHash: string
  ): Promise<AgentResponse> {
    const responses = await this.generate(poll, profile);
    const confidenceScores: Record<string, ConfidenceLevel> = {};

    for (const response of responses) {
      confidenceScores[response.questionId] = response.confidence;
    }

    return {
      pollId: poll.id,
      responses,
      confidenceScores,
      attestationHash,
      generatedAt: new Date().toISOString(),
    };
  }
}
