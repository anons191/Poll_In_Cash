/**
 * Poll in Cash Agent
 *
 * Main agent class that orchestrates poll discovery, response generation,
 * and submission. Supports both auto and manual modes.
 *
 * @module agent/index
 */

import { EventEmitter } from 'events';
import type {
  AgentConfig,
  AgentState,
  AgentEvent,
  AgentEventHandler,
  UserProfile,
  DiscoveredPoll,
  AgentResponse,
  SubmissionResult,
} from './types.js';
import { INITIAL_AGENT_STATE } from './types.js';
import { createConfig, getConfigSummary } from './config.js';
import { ProfileManager, getProfileSummary } from './profile.js';
import { PollDiscoverer } from './discovery.js';
import { ResponseGenerator } from './responder.js';
import { AttestationManager } from './attestation.js';
import { WalletManager, type WalletData } from './wallet.js';

/**
 * Options for starting the agent
 */
export interface AgentStartOptions {
  /** Override config values */
  config?: Partial<AgentConfig>;
  /** Existing wallet data to restore */
  walletData?: WalletData;
  /** Auth token for API calls */
  authToken?: string;
}

/**
 * Poll pending approval in manual mode
 */
export interface PendingPoll {
  poll: DiscoveredPoll;
  response: AgentResponse;
  attestationHash: string;
}

/**
 * Main Poll Agent class
 * Ties together all agent components and manages the discovery-respond-collect loop
 */
export class PollAgent extends EventEmitter {
  private config: AgentConfig;
  private state: AgentState;
  private profileManager: ProfileManager;
  private discoverer: PollDiscoverer;
  private responder: ResponseGenerator;
  private attestationManager: AttestationManager;
  private walletManager: WalletManager;
  private authToken: string | null = null;
  private loopInterval: NodeJS.Timeout | null = null;
  private pendingPolls: Map<string, PendingPoll> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    super();
    this.config = createConfig(config);
    this.state = { ...INITIAL_AGENT_STATE };
    this.profileManager = new ProfileManager(this.config.profilePath);
    this.discoverer = new PollDiscoverer(this.config);
    this.responder = new ResponseGenerator(this.config);
    this.attestationManager = new AttestationManager();
    this.walletManager = new WalletManager(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Set the auth token for API calls
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.discoverer.setAuthToken(token);
    this.walletManager.setAuthToken(token);
  }

  /**
   * Initialize the agent
   * Loads profile and initializes wallet
   */
  async initialize(options?: AgentStartOptions): Promise<void> {
    this.emit('log', 'Initializing agent...');

    // Set auth token if provided
    if (options?.authToken) {
      this.setAuthToken(options.authToken);
    }

    // Load profile
    const profile = await this.profileManager.load();
    if (profile) {
      this.state.profile = profile;
      this.emitEvent('profile:loaded', { profile });
    } else {
      this.emit('log', 'No profile found. Run onboard() to create one.');
    }

    // Initialize wallet
    await this.walletManager.initialize(options?.walletData);
    const walletAddress = this.walletManager.getWalletAddress();

    if (walletAddress) {
      this.state.walletAddress = walletAddress;

      // Set up attestation manager with wallet signer
      const wallet = this.walletManager.getWallet();
      if (wallet) {
        this.attestationManager.setSigner(wallet);
      }

      this.emitEvent('wallet:balance', {
        address: walletAddress,
      });
    }

    this.emit('log', 'Agent initialized');
    this.emit('log', getConfigSummary(this.config));
  }

  /**
   * Start the main agent loop
   */
  async run(): Promise<void> {
    if (this.state.isRunning) {
      this.emit('log', 'Agent is already running');
      return;
    }

    if (!this.state.profile) {
      throw new Error('No profile loaded. Run onboard() or load a profile first.');
    }

    if (!this.authToken) {
      throw new Error('No auth token set. Call setAuthToken() first.');
    }

    this.state.isRunning = true;
    this.emitEvent('agent:started', {});

    this.emit('log', `Starting agent in ${this.config.autoMode ? 'auto' : 'manual'} mode`);
    this.emit('log', `Polling interval: ${this.config.pollingIntervalMs}ms`);

    // Run first iteration immediately
    await this.runIteration();

    // Set up interval for subsequent iterations
    this.loopInterval = setInterval(async () => {
      if (this.state.isRunning) {
        await this.runIteration();
      }
    }, this.config.pollingIntervalMs);
  }

  /**
   * Run a single iteration of the agent loop
   */
  private async runIteration(): Promise<void> {
    try {
      this.emit('log', 'Discovering polls...');

      // Discover and rank polls
      const polls = await this.discoverer.discoverAndRank(this.state.profile!);

      this.state.lastDiscoveryAt = new Date().toISOString();
      this.emitEvent('polls:discovered', { count: polls.length, polls });

      if (polls.length === 0) {
        this.emit('log', 'No eligible polls found');
        return;
      }

      this.emit('log', `Found ${polls.length} eligible polls`);

      // Process polls (respecting max concurrent)
      const pollsToProcess = polls.slice(0, this.config.maxConcurrentResponses);

      for (const poll of pollsToProcess) {
        // Skip if already processing or completed
        if (
          this.state.processingPolls.includes(poll.id) ||
          this.state.completedPolls.includes(poll.id)
        ) {
          continue;
        }

        await this.processPoll(poll);
      }
    } catch (error) {
      this.state.errorCount++;
      this.emitEvent('error', { error });

      // Circuit breaker: stop if too many errors
      if (this.state.errorCount >= 5) {
        this.emit('log', 'Too many errors, stopping agent');
        await this.stop();
      }
    }
  }

  /**
   * Process a single poll
   */
  private async processPoll(poll: DiscoveredPoll): Promise<void> {
    try {
      this.emit('log', `Processing poll: ${poll.title}`);
      this.state.processingPolls.push(poll.id);
      this.emitEvent('poll:responding', { pollId: poll.id, title: poll.title });

      // Generate response
      const userAddress = this.state.walletAddress!;
      const attestationHash = await this.attestationManager.createHash(poll.id, userAddress);
      const response = await this.responder.generateAgentResponse(poll, this.state.profile!, attestationHash);

      if (this.config.autoMode) {
        // Auto mode: submit immediately
        await this.submitResponse(poll, response, attestationHash);
      } else {
        // Manual mode: queue for approval
        this.pendingPolls.set(poll.id, { poll, response, attestationHash });
        this.emit('log', `Poll queued for approval: ${poll.title}`);
        this.emit('approval:required', { poll, response });
      }
    } catch (error) {
      this.emitEvent('poll:error', { pollId: poll.id, error });
    } finally {
      // Remove from processing
      this.state.processingPolls = this.state.processingPolls.filter((id) => id !== poll.id);
    }
  }

  /**
   * Submit a response to the API
   */
  private async submitResponse(
    poll: DiscoveredPoll,
    response: AgentResponse,
    attestationHash: string
  ): Promise<SubmissionResult> {
    const submission = this.responder.format(response.responses, attestationHash);

    const url = `${this.config.apiBaseUrl}/agent/polls/${poll.id}/respond`;

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(submission),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Failed to submit response: ${apiResponse.status} ${errorText}`);
    }

    const result = (await apiResponse.json()) as SubmissionResult;

    this.state.completedPolls.push(poll.id);
    this.emitEvent('poll:submitted', { pollId: poll.id, result });

    this.emit('log', `Response submitted for poll: ${poll.title}`);
    this.emit('log', `Estimated payout: $${result.payoutEstimate} USDC`);

    return result;
  }

  /**
   * Approve a pending poll (manual mode)
   */
  async approvePoll(pollId: string): Promise<SubmissionResult> {
    const pending = this.pendingPolls.get(pollId);
    if (!pending) {
      throw new Error(`No pending poll with ID: ${pollId}`);
    }

    const result = await this.submitResponse(pending.poll, pending.response, pending.attestationHash);
    this.pendingPolls.delete(pollId);
    return result;
  }

  /**
   * Reject a pending poll (manual mode)
   */
  rejectPoll(pollId: string): void {
    if (!this.pendingPolls.has(pollId)) {
      throw new Error(`No pending poll with ID: ${pollId}`);
    }
    this.pendingPolls.delete(pollId);
    this.emit('log', `Poll rejected: ${pollId}`);
  }

  /**
   * Get all pending polls (manual mode)
   */
  getPendingPolls(): PendingPoll[] {
    return Array.from(this.pendingPolls.values());
  }

  /**
   * Stop the agent loop
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      return;
    }

    this.emit('log', 'Stopping agent...');

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    this.state.isRunning = false;
    this.emitEvent('agent:stopped', {});
    this.emit('log', 'Agent stopped');
  }

  /**
   * Onboard a new user
   * Builds profile, scans documents, creates wallet
   */
  async onboard(options?: {
    profileId?: string;
    displayName?: string;
    walletData?: WalletData;
  }): Promise<{ profile: UserProfile; walletAddress: string }> {
    this.emit('log', 'Starting onboarding...');

    // Create new profile (ID is auto-generated)
    const profile = this.profileManager.create(options?.displayName);
    this.state.profile = profile;

    // Initialize the agent's Agentic Wallet (auto-provisioned, user never sees this)
    await this.walletManager.initialize(options?.walletData);
    const walletAddress = this.walletManager.getWalletAddress()!;
    this.state.walletAddress = walletAddress;

    // Link the agent wallet to the profile (internally, user doesn't need to know)
    profile.verifiedAttributes.agentWalletAddress = walletAddress;

    // Set up attestation manager
    const wallet = this.walletManager.getWallet();
    if (wallet) {
      this.attestationManager.setSigner(wallet);
    }

    // Save profile
    await this.profileManager.save();

    this.emitEvent('profile:loaded', { profile });

    this.emit('log', `Onboarding complete!`);
    this.emit('log', `Wallet address: ${walletAddress}`);
    this.emit('log', `Profile saved to: ${this.config.profilePath}`);

    return { profile, walletAddress };
  }

  /**
   * Get the next profile question to ask
   */
  getNextProfileQuestion() {
    return this.profileManager.getNextQuestion();
  }

  /**
   * Answer a profile question
   */
  answerProfileQuestion(questionId: string, answer: unknown): void {
    this.profileManager.answerQuestion(questionId, answer);
    this.state.profile = this.profileManager.getProfile();
    this.emitEvent('profile:updated', { profile: this.state.profile });
  }

  /**
   * Save the current profile
   */
  async saveProfile(): Promise<void> {
    await this.profileManager.save();
  }

  /**
   * Scan a document and update verified attributes
   */
  async scanDocument(filePath: string): Promise<void> {
    const result = await this.attestationManager.scan(filePath);

    if (result.success && result.document) {
      // Update profile with verified attributes
      this.profileManager.update({
        verifiedAttributes: result.document.extractedAttributes,
      });
      this.state.profile = this.profileManager.getProfile();
      await this.profileManager.save();

      this.emit('log', `Document scanned: ${result.document.type}`);
      this.emitEvent('profile:updated', { profile: this.state.profile });
    } else {
      this.emit('log', `Document scan failed: ${result.error}`);
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance() {
    return this.walletManager.checkBalance();
  }

  /**
   * Get earnings history
   */
  async getEarnings() {
    return this.walletManager.getEarningsHistory();
  }

  /**
   * Get formatted earnings summary
   */
  async getEarningsSummary(): Promise<string> {
    return this.walletManager.formatEarnings();
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.walletManager.getWalletAddress();
  }

  /**
   * Get wallet data for persistence
   */
  getWalletData(): WalletData | null {
    return this.walletManager.getWalletData();
  }

  /**
   * Get profile summary for poll matching
   */
  getProfileSummary() {
    if (!this.state.profile) return null;
    return getProfileSummary(this.state.profile);
  }

  /**
   * Get profile completeness percentage
   */
  getProfileCompleteness(): number {
    return this.profileManager.getCompleteness();
  }

  /**
   * Register an event handler
   */
  onEvent(handler: AgentEventHandler): void {
    this.on('event', handler);
  }

  /**
   * Emit an agent event
   */
  private emitEvent(type: AgentEvent['type'], data: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit('event', event);

    if (this.config.verbose) {
      this.emit('log', `[${type}] ${JSON.stringify(data)}`);
    }
  }
}

// Export all modules
export { createConfig, loadConfig, validateConfig, getConfigSummary } from './config.js';
export {
  ProfileManager,
  parseProfileFromMarkdown,
  serializeProfileToMarkdown,
  loadProfile,
  saveProfile,
  createEmptyProfile,
  updateProfile,
  getProfileSummary,
  PROFILE_QUESTIONS,
} from './profile.js';
export {
  PollDiscoverer,
  discoverPolls,
  matchPoll,
  rankPolls,
  filterByPreferences,
  filterByMinimumPayout,
  filterEligible,
  calculateMatchConfidence,
} from './discovery.js';
export {
  ResponseGenerator,
  generateResponses,
  generateBasicResponse,
  formatForSubmission,
  generateAgentResponse,
} from './responder.js';
export {
  AttestationManager,
  scanDocument,
  createAttestation,
  signAttestation,
  verifyAttestation,
  hashAttestation,
  createAttestationHash,
} from './attestation.js';
export {
  WalletManager,
  initializeWallet,
  checkBalance,
  getEarningsHistory,
  formatEarnings,
  formatBalance,
  type WalletData,
} from './wallet.js';
export * from './types.js';

// Default export
export default PollAgent;
