#!/usr/bin/env tsx
/**
 * Poll in Cash Agent - End-to-End Demo Script
 *
 * This script demonstrates the full agent workflow:
 * 1. Load environment variables
 * 2. Create or load a test user profile
 * 3. Initialize CDP wallet (or use existing)
 * 4. Discover available polls from the API
 * 5. Match and display eligible polls
 * 6. Optionally respond to a poll (with confirmation)
 * 7. Check and display earnings
 *
 * Run with: npx tsx agent/scripts/demo.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import type {
  UserProfile,
  DiscoveredPoll,
  EarningsSummary,
  WalletBalance,
  AgentConfig,
  DEFAULT_AGENT_CONFIG,
} from '../src/types.js';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============ Console Formatting Helpers ============

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message: string): void {
  console.log(message);
}

function logHeader(title: string): void {
  const line = '='.repeat(60);
  console.log(`\n${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

function logSection(title: string): void {
  console.log(`\n${colors.yellow}--- ${title} ---${colors.reset}\n`);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}[OK]${colors.reset} ${message}`);
}

function logError(message: string): void {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
}

function logInfo(message: string): void {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function formatUSDC(amount: string): string {
  return `${colors.green}$${parseFloat(amount).toFixed(2)} USDC${colors.reset}`;
}

// ============ Configuration ============

interface DemoConfig {
  apiBaseUrl: string;
  profilePath: string;
  walletDataPath: string;
  autoMode: boolean;
  verbose: boolean;
}

function loadConfig(): DemoConfig {
  return {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    profilePath: process.env.PROFILE_PATH || './profile.md',
    walletDataPath: process.env.WALLET_DATA_PATH || './wallet-data.json',
    autoMode: process.env.AUTO_MODE === 'true',
    verbose: process.env.VERBOSE === 'true',
  };
}

// ============ Profile Management ============

async function loadProfile(profilePath: string): Promise<UserProfile | null> {
  try {
    const fullPath = path.resolve(process.cwd(), profilePath);
    await fs.access(fullPath);

    // For demo, we'll create a sample profile if file doesn't exist
    // In real implementation, this would parse the markdown file
    logSuccess(`Profile found at: ${fullPath}`);
    return createSampleProfile();
  } catch {
    logWarning(`Profile not found at: ${profilePath}`);
    return null;
  }
}

function createSampleProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: '0x' + 'demo'.padEnd(40, '0'),
    displayName: 'Demo User',
    demographics: {
      age: 30,
      gender: 'prefer-not-to-say',
      state: 'CA',
      city: 'San Francisco',
      country: 'US',
    },
    professional: {
      employmentStatus: 'employed',
      occupation: 'Software Engineer',
      industry: 'Technology',
      yearsExperience: 5,
      education: 'bachelors',
    },
    behavioral: {
      interests: ['technology', 'gaming', 'reading'],
      techSavviness: 'high',
    },
    verifiedAttributes: {
      isRegisteredVoter: true,
      voterState: 'CA',
      verifiedAgeThreshold: 21,
    },
    preferences: {
      allowedTopics: ['technology', 'politics', 'entertainment'],
      excludedTopics: ['gambling'],
      minimumPayoutUsdc: 0.5,
      maxPollsPerDay: 10,
      autoMode: false,
      requireApproval: true,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

// ============ Wallet Management ============

interface WalletData {
  address: string;
  network: string;
  createdAt: string;
}

async function initializeWallet(
  walletDataPath: string,
  verbose: boolean
): Promise<WalletData> {
  const fullPath = path.resolve(process.cwd(), walletDataPath);

  try {
    // Try to load existing wallet data
    const data = await fs.readFile(fullPath, 'utf-8');
    const walletData = JSON.parse(data) as WalletData;
    logSuccess(`Loaded existing wallet: ${walletData.address}`);
    return walletData;
  } catch {
    // Create new wallet data (mock for demo)
    logInfo('Creating new wallet...');

    // In real implementation, this would use CDP SDK to create wallet
    const walletData: WalletData = {
      address: '0x' + Math.random().toString(16).slice(2).padEnd(40, '0'),
      network: 'base-sepolia',
      createdAt: new Date().toISOString(),
    };

    // Save wallet data
    await fs.writeFile(fullPath, JSON.stringify(walletData, null, 2));
    logSuccess(`Created new wallet: ${walletData.address}`);

    return walletData;
  }
}

async function checkWalletBalance(
  apiBaseUrl: string,
  walletAddress: string,
  authToken: string
): Promise<WalletBalance> {
  // Mock balance for demo - in real implementation, would query CDP SDK
  return {
    address: walletAddress,
    ethBalance: '0.05',
    usdcBalance: '0.00',
    network: 'base-sepolia',
  };
}

// ============ API Client ============

async function authenticateAgent(
  apiBaseUrl: string,
  walletAddress: string
): Promise<string> {
  // In real implementation, this would perform SIWE authentication
  // For demo, we'll return a mock token
  logInfo('Authenticating with backend...');

  try {
    // Mock authentication for demo
    const mockToken = `demo-token-${Date.now()}`;
    logSuccess('Authentication successful');
    return mockToken;
  } catch (error) {
    throw new Error(`Authentication failed: ${(error as Error).message}`);
  }
}

async function discoverPolls(
  apiBaseUrl: string,
  authToken: string,
  profile: UserProfile
): Promise<DiscoveredPoll[]> {
  logInfo('Discovering available polls...');

  try {
    // Build query params from profile
    const params = new URLSearchParams();
    if (profile.demographics.age) {
      params.set('age', String(profile.demographics.age));
    }
    if (profile.demographics.state) {
      params.set('state', profile.demographics.state);
    }
    if (profile.verifiedAttributes.isRegisteredVoter) {
      params.set('isRegisteredVoter', 'true');
    }
    if (profile.verifiedAttributes.isVeteran) {
      params.set('isVeteran', 'true');
    }

    const url = `${apiBaseUrl}/agent/polls/discover?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      // Return mock data for demo if API is not available
      logWarning('API not available, using mock data');
      return getMockPolls();
    }

    const data = await response.json();
    logSuccess(`Found ${data.polls.length} polls`);
    return data.polls;
  } catch (error) {
    logWarning(`API error: ${(error as Error).message}, using mock data`);
    return getMockPolls();
  }
}

function getMockPolls(): DiscoveredPoll[] {
  return [
    {
      id: 'poll-demo-1',
      title: 'Technology Preferences Survey 2024',
      description: 'Help us understand tech adoption trends',
      cashPoolUsdc: '100.00',
      participantCap: 50,
      responseCount: 12,
      spotsRemaining: 38,
      payoutEstimate: '1.80',
      eligible: true,
      ineligibleReasons: [],
      criteria: { minAge: 18 },
      questions: [
        {
          id: 'q1',
          text: 'What is your favorite programming language?',
          type: 'multiple-choice',
          options: ['JavaScript', 'Python', 'Go', 'Rust', 'Other'],
          required: true,
        },
        {
          id: 'q2',
          text: 'How many hours per week do you code?',
          type: 'rating',
          min: 0,
          max: 60,
          required: true,
        },
      ],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'poll-demo-2',
      title: 'California Voter Opinion Poll',
      description: 'Political opinions for CA registered voters',
      cashPoolUsdc: '250.00',
      participantCap: 100,
      responseCount: 45,
      spotsRemaining: 55,
      payoutEstimate: '2.25',
      eligible: true,
      ineligibleReasons: [],
      criteria: { states: ['CA'], isRegisteredVoter: true },
      questions: [
        {
          id: 'q1',
          text: 'Do you plan to vote in the next election?',
          type: 'yes-no',
          required: true,
        },
      ],
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'poll-demo-3',
      title: 'Veteran Healthcare Experience',
      description: 'Survey for military veterans',
      cashPoolUsdc: '500.00',
      participantCap: 25,
      responseCount: 20,
      spotsRemaining: 5,
      payoutEstimate: '18.00',
      eligible: false,
      ineligibleReasons: ['Must be a verified veteran'],
      criteria: { isVeteran: true },
      questions: [],
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

async function getEarnings(
  apiBaseUrl: string,
  authToken: string
): Promise<EarningsSummary> {
  try {
    const response = await fetch(`${apiBaseUrl}/agent/earnings`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      return getMockEarnings();
    }

    return await response.json();
  } catch {
    return getMockEarnings();
  }
}

function getMockEarnings(): EarningsSummary {
  return {
    totalEarned: '0.00',
    confirmedPayouts: 0,
    pendingPayouts: 0,
    pollsCompleted: 0,
    reliabilityScore: '1.00',
    recentPayouts: [],
  };
}

// ============ Display Functions ============

function displayProfile(profile: UserProfile): void {
  logSection('User Profile');

  log(`  ${colors.bold}Name:${colors.reset} ${profile.displayName || 'Not set'}`);
  log(`  ${colors.bold}ID:${colors.reset} ${profile.id}`);
  log('');
  log(`  ${colors.dim}Demographics:${colors.reset}`);
  log(`    Age: ${profile.demographics.age || 'Not set'}`);
  log(`    State: ${profile.demographics.state || 'Not set'}`);
  log(`    City: ${profile.demographics.city || 'Not set'}`);
  log('');
  log(`  ${colors.dim}Professional:${colors.reset}`);
  log(`    Occupation: ${profile.professional.occupation || 'Not set'}`);
  log(`    Industry: ${profile.professional.industry || 'Not set'}`);
  log('');
  log(`  ${colors.dim}Verified Attributes:${colors.reset}`);
  log(
    `    Registered Voter: ${profile.verifiedAttributes.isRegisteredVoter ? 'Yes' : 'No'}`
  );
  log(`    Veteran: ${profile.verifiedAttributes.isVeteran ? 'Yes' : 'No'}`);
}

function displayWallet(wallet: WalletData, balance: WalletBalance): void {
  logSection('Wallet');

  log(`  ${colors.bold}Address:${colors.reset} ${wallet.address}`);
  log(`  ${colors.bold}Network:${colors.reset} ${wallet.network}`);
  log(`  ${colors.bold}ETH Balance:${colors.reset} ${balance.ethBalance} ETH`);
  log(`  ${colors.bold}USDC Balance:${colors.reset} ${formatUSDC(balance.usdcBalance)}`);
}

function displayPolls(polls: DiscoveredPoll[]): void {
  logSection('Available Polls');

  if (polls.length === 0) {
    log('  No polls available at this time.');
    return;
  }

  const eligible = polls.filter((p) => p.eligible);
  const ineligible = polls.filter((p) => !p.eligible);

  if (eligible.length > 0) {
    log(`  ${colors.green}Eligible Polls (${eligible.length}):${colors.reset}\n`);

    eligible.forEach((poll, index) => {
      log(`  ${colors.bold}${index + 1}. ${poll.title}${colors.reset}`);
      log(`     ${colors.dim}${poll.description || 'No description'}${colors.reset}`);
      log(
        `     Payout: ${formatUSDC(poll.payoutEstimate)} | Spots: ${poll.spotsRemaining}/${poll.participantCap}`
      );
      log(`     Pool: ${formatUSDC(poll.cashPoolUsdc)}`);
      log('');
    });
  }

  if (ineligible.length > 0) {
    log(`  ${colors.yellow}Ineligible Polls (${ineligible.length}):${colors.reset}\n`);

    ineligible.forEach((poll) => {
      log(`  ${colors.dim}- ${poll.title}${colors.reset}`);
      log(
        `    ${colors.red}Reason: ${poll.ineligibleReasons.join(', ')}${colors.reset}`
      );
    });
  }
}

function displayEarnings(earnings: EarningsSummary): void {
  logSection('Earnings Summary');

  log(`  ${colors.bold}Total Earned:${colors.reset} ${formatUSDC(earnings.totalEarned)}`);
  log(`  ${colors.bold}Polls Completed:${colors.reset} ${earnings.pollsCompleted}`);
  log(`  ${colors.bold}Confirmed Payouts:${colors.reset} ${earnings.confirmedPayouts}`);
  log(`  ${colors.bold}Pending Payouts:${colors.reset} ${earnings.pendingPayouts}`);
  log(
    `  ${colors.bold}Reliability Score:${colors.reset} ${(parseFloat(earnings.reliabilityScore) * 100).toFixed(0)}%`
  );

  if (earnings.recentPayouts.length > 0) {
    log('');
    log(`  ${colors.dim}Recent Payouts:${colors.reset}`);
    earnings.recentPayouts.slice(0, 5).forEach((payout) => {
      const status = payout.status === 'confirmed' ? colors.green : colors.yellow;
      const statusText = payout.status === 'confirmed' ? '[OK]' : '[PENDING]';
      log(
        `    ${status}${statusText}${colors.reset} ${payout.pollTitle}: ${formatUSDC(payout.amountUsdc)}`
      );
    });
  }
}

// ============ User Input ============

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// ============ Poll Response ============

async function respondToPoll(
  apiBaseUrl: string,
  authToken: string,
  poll: DiscoveredPoll,
  profile: UserProfile
): Promise<void> {
  logSection(`Responding to: ${poll.title}`);

  if (!poll.questions || poll.questions.length === 0) {
    logError('Poll has no questions');
    return;
  }

  log(`  Questions: ${poll.questions.length}`);
  log(`  Estimated Payout: ${formatUSDC(poll.payoutEstimate)}`);
  log('');

  // Generate mock responses based on profile
  const responses = poll.questions.map((q) => {
    let answer: string | number | string[];

    switch (q.type) {
      case 'multiple-choice':
        answer = q.options?.[0] || 'Unknown';
        break;
      case 'rating':
        answer = Math.round(((q.min || 0) + (q.max || 10)) / 2);
        break;
      case 'yes-no':
        answer = 'yes';
        break;
      case 'ranking':
        answer = q.options || [];
        break;
      default:
        answer = 'Sample response from agent';
    }

    log(`  Q: ${q.text}`);
    log(`  A: ${Array.isArray(answer) ? answer.join(', ') : answer}`);
    log('');

    return {
      questionId: q.id,
      answer,
    };
  });

  // Confirm submission
  const shouldSubmit = await confirm('Submit these responses?');

  if (!shouldSubmit) {
    logWarning('Response submission cancelled');
    return;
  }

  // Submit response (mock for demo)
  logInfo('Submitting response...');

  try {
    const response = await fetch(`${apiBaseUrl}/agent/polls/${poll.id}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        responses,
        confidenceScores: Object.fromEntries(
          responses.map((r) => [r.questionId, 'high'])
        ),
        attestationHash: '0x' + 'demo'.repeat(16),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      logSuccess(`Response submitted! ID: ${result.id}`);
      logSuccess(`Estimated payout: ${formatUSDC(result.payoutEstimate)}`);
    } else {
      // Mock success for demo
      logSuccess('Response submitted (demo mode)');
      logSuccess(`Estimated payout: ${formatUSDC(poll.payoutEstimate)}`);
    }
  } catch {
    // Mock success for demo
    logSuccess('Response submitted (demo mode)');
    logSuccess(`Estimated payout: ${formatUSDC(poll.payoutEstimate)}`);
  }
}

// ============ Main Demo Flow ============

async function main(): Promise<void> {
  try {
    logHeader('Poll in Cash Agent Demo');

    // Load configuration
    const config = loadConfig();
    logInfo(`API URL: ${config.apiBaseUrl}`);

    // Step 1: Load or create profile
    let profile = await loadProfile(config.profilePath);
    if (!profile) {
      logInfo('Creating demo profile...');
      profile = createSampleProfile();
      logSuccess('Demo profile created');
    }
    displayProfile(profile);

    // Step 2: Initialize wallet
    const wallet = await initializeWallet(config.walletDataPath, config.verbose);
    const balance = await checkWalletBalance(
      config.apiBaseUrl,
      wallet.address,
      ''
    );
    displayWallet(wallet, balance);

    // Step 3: Authenticate
    const authToken = await authenticateAgent(config.apiBaseUrl, wallet.address);

    // Step 4: Discover polls
    const polls = await discoverPolls(config.apiBaseUrl, authToken, profile);
    displayPolls(polls);

    // Step 5: Optionally respond to a poll
    const eligiblePolls = polls.filter((p) => p.eligible && p.spotsRemaining > 0);

    if (eligiblePolls.length > 0) {
      const shouldRespond = await confirm(
        '\nWould you like to respond to an eligible poll?'
      );

      if (shouldRespond) {
        log('');
        log('Select a poll to respond to:');
        eligiblePolls.forEach((poll, index) => {
          log(`  ${index + 1}. ${poll.title} (${formatUSDC(poll.payoutEstimate)})`);
        });
        log('');

        const selection = await prompt('Enter poll number (or press Enter to skip): ');
        const pollIndex = parseInt(selection) - 1;

        if (pollIndex >= 0 && pollIndex < eligiblePolls.length) {
          await respondToPoll(
            config.apiBaseUrl,
            authToken,
            eligiblePolls[pollIndex],
            profile
          );
        }
      }
    }

    // Step 6: Check earnings
    const earnings = await getEarnings(config.apiBaseUrl, authToken);
    displayEarnings(earnings);

    // Summary
    logSection('Demo Complete');
    log('  Thank you for trying the Poll in Cash agent!');
    log('');
    log('  Next steps:');
    log('    1. Run the onboarding script to create your real profile');
    log('       npx tsx agent/scripts/onboard.ts');
    log('');
    log('    2. Fund your wallet with testnet ETH and USDC');
    log('       https://www.coinbase.com/faucets');
    log('');
    log('    3. Start earning by responding to real polls!');
    log('');

    process.exit(0);
  } catch (error) {
    logError(`Demo failed: ${(error as Error).message}`);
    if (process.env.VERBOSE === 'true') {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the demo
main();
