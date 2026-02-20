#!/usr/bin/env tsx
/**
 * Poll in Cash Agent - Interactive Onboarding Script
 *
 * This script walks users through creating their agent profile:
 * 1. Collect demographic information
 * 2. Collect professional information
 * 3. Collect behavioral preferences
 * 4. Set up user preferences
 * 5. Optionally scan a verification document (mock for now)
 * 6. Create wallet and display address
 * 7. Save profile to profile.md
 *
 * Run with: npx tsx agent/scripts/onboard.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import type {
  UserProfile,
  DemographicProfile,
  ProfessionalProfile,
  BehavioralProfile,
  VerifiedAttributes,
  UserPreferences,
} from '../src/types.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============ Console Formatting ============

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

function log(message: string = ''): void {
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

function logInfo(message: string): void {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

// ============ Readline Interface ============

let rl: readline.Interface;

function initReadline(): void {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function closeReadline(): void {
  if (rl) {
    rl.close();
  }
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const displayQuestion = defaultValue
      ? `${question} ${colors.dim}(${defaultValue})${colors.reset}: `
      : `${question}: `;

    rl.question(displayQuestion, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function promptNumber(
  question: string,
  min?: number,
  max?: number,
  defaultValue?: number
): Promise<number | undefined> {
  const answer = await prompt(
    question,
    defaultValue !== undefined ? String(defaultValue) : undefined
  );

  if (!answer) return undefined;

  const num = parseInt(answer);
  if (isNaN(num)) {
    logError('Please enter a valid number');
    return promptNumber(question, min, max, defaultValue);
  }

  if (min !== undefined && num < min) {
    logError(`Value must be at least ${min}`);
    return promptNumber(question, min, max, defaultValue);
  }

  if (max !== undefined && num > max) {
    logError(`Value must be at most ${max}`);
    return promptNumber(question, min, max, defaultValue);
  }

  return num;
}

async function promptSelect<T extends string>(
  question: string,
  options: { value: T; label: string }[],
  defaultValue?: T
): Promise<T | undefined> {
  log(`${question}`);
  options.forEach((opt, index) => {
    const marker = opt.value === defaultValue ? ' (default)' : '';
    log(`  ${colors.cyan}${index + 1}.${colors.reset} ${opt.label}${marker}`);
  });
  log('');

  const answer = await prompt('Enter number');

  if (!answer && defaultValue) {
    return defaultValue;
  }

  const index = parseInt(answer) - 1;
  if (isNaN(index) || index < 0 || index >= options.length) {
    logError('Please enter a valid option number');
    return promptSelect(question, options, defaultValue);
  }

  return options[index].value;
}

async function promptMultiSelect(
  question: string,
  options: string[]
): Promise<string[]> {
  log(`${question}`);
  log(`${colors.dim}(Enter comma-separated numbers, e.g., "1,3,5")${colors.reset}`);
  options.forEach((opt, index) => {
    log(`  ${colors.cyan}${index + 1}.${colors.reset} ${opt}`);
  });
  log('');

  const answer = await prompt('Enter numbers');

  if (!answer) return [];

  const indices = answer.split(',').map((s) => parseInt(s.trim()) - 1);
  const selected: string[] = [];

  for (const index of indices) {
    if (index >= 0 && index < options.length) {
      selected.push(options[index]);
    }
  }

  return selected;
}

async function promptYesNo(question: string, defaultValue?: boolean): Promise<boolean> {
  const defaultStr = defaultValue === true ? 'Y/n' : defaultValue === false ? 'y/N' : 'y/n';
  const answer = await prompt(`${question} (${defaultStr})`);

  if (!answer && defaultValue !== undefined) {
    return defaultValue;
  }

  const lower = answer.toLowerCase();
  if (lower === 'y' || lower === 'yes') return true;
  if (lower === 'n' || lower === 'no') return false;

  logError('Please enter y or n');
  return promptYesNo(question, defaultValue);
}

async function promptList(question: string): Promise<string[]> {
  log(`${question}`);
  log(`${colors.dim}(Enter comma-separated values)${colors.reset}`);

  const answer = await prompt('');

  if (!answer) return [];

  return answer.split(',').map((s) => s.trim()).filter(Boolean);
}

// ============ Profile Sections ============

async function collectDemographics(): Promise<DemographicProfile> {
  logSection('Demographics');
  log('This information helps match you with relevant polls.');
  log(`${colors.dim}Press Enter to skip any question.${colors.reset}`);
  log('');

  const demographics: DemographicProfile = {};

  demographics.age = await promptNumber('Your age', 18, 120);

  demographics.gender = await promptSelect('Your gender', [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'non-binary', label: 'Non-binary' },
    { value: 'other', label: 'Other' },
    { value: 'prefer-not-to-say', label: 'Prefer not to say' },
  ]);

  const state = await prompt('US State (2-letter code, e.g., CA)');
  if (state && /^[A-Z]{2}$/i.test(state)) {
    demographics.state = state.toUpperCase();
  }

  demographics.city = await prompt('City') || undefined;

  const zipCode = await prompt('ZIP Code');
  if (zipCode && /^\d{5}(-\d{4})?$/.test(zipCode)) {
    demographics.zipCode = zipCode;
  }

  demographics.country = 'US'; // Default to US

  demographics.primaryLanguage = await prompt('Primary language', 'English') || undefined;

  return demographics;
}

async function collectProfessional(): Promise<ProfessionalProfile> {
  logSection('Professional Information');
  log('This helps match you with industry-specific polls.');
  log('');

  const professional: ProfessionalProfile = {};

  professional.employmentStatus = await promptSelect('Employment status', [
    { value: 'employed', label: 'Employed' },
    { value: 'self-employed', label: 'Self-employed' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'student', label: 'Student' },
    { value: 'retired', label: 'Retired' },
  ]);

  professional.occupation = await prompt('Occupation/Job title') || undefined;

  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Retail',
    'Manufacturing',
    'Government',
    'Entertainment',
    'Other',
  ];

  const industryAnswer = await promptSelect(
    'Industry',
    industries.map((i) => ({ value: i.toLowerCase(), label: i }))
  );
  if (industryAnswer) {
    professional.industry =
      industries.find((i) => i.toLowerCase() === industryAnswer) || industryAnswer;
  }

  professional.yearsExperience = await promptNumber(
    'Years of professional experience',
    0,
    70
  );

  professional.education = await promptSelect('Highest education level', [
    { value: 'high-school', label: 'High School' },
    { value: 'some-college', label: 'Some College' },
    { value: 'bachelors', label: "Bachelor's Degree" },
    { value: 'masters', label: "Master's Degree" },
    { value: 'doctorate', label: 'Doctorate' },
    { value: 'other', label: 'Other' },
  ]);

  const incomeRanges = [
    'Under $25,000',
    '$25,000 - $50,000',
    '$50,000 - $75,000',
    '$75,000 - $100,000',
    '$100,000 - $150,000',
    '$150,000 - $200,000',
    '$200,000+',
    'Prefer not to say',
  ];

  const incomeAnswer = await promptSelect(
    'Annual income range',
    incomeRanges.map((r) => ({ value: r, label: r }))
  );
  professional.incomeRange = incomeAnswer || undefined;

  return professional;
}

async function collectBehavioral(): Promise<BehavioralProfile> {
  logSection('Interests & Lifestyle');
  log('This helps personalize your poll matches.');
  log('');

  const behavioral: BehavioralProfile = {};

  const politicalLeaning = await promptNumber(
    'Political leaning (1=very liberal, 5=moderate, 10=very conservative)',
    1,
    10,
    5
  );
  behavioral.politicalLeaning = politicalLeaning;

  const interestOptions = [
    'Technology',
    'Sports',
    'Gaming',
    'Music',
    'Movies/TV',
    'Reading',
    'Travel',
    'Fitness',
    'Cooking',
    'Fashion',
    'Finance/Investing',
    'Politics',
    'Art',
    'Outdoors',
  ];

  behavioral.interests = await promptMultiSelect(
    'Select your interests',
    interestOptions
  );

  const shoppingOptions = [
    'Online shopping',
    'In-store shopping',
    'Bargain hunting',
    'Brand loyal',
    'Impulse buyer',
    'Research before buying',
  ];

  behavioral.shoppingHabits = await promptMultiSelect(
    'Shopping habits',
    shoppingOptions
  );

  behavioral.techSavviness = await promptSelect('Tech savviness level', [
    { value: 'low', label: 'Low - Basic usage' },
    { value: 'medium', label: 'Medium - Comfortable with most tech' },
    { value: 'high', label: 'High - Early adopter, very comfortable' },
  ]);

  const socialPlatforms = [
    'Facebook',
    'Twitter/X',
    'Instagram',
    'LinkedIn',
    'TikTok',
    'Reddit',
    'YouTube',
    'Snapchat',
    'Discord',
    'None',
  ];

  behavioral.socialMediaPlatforms = await promptMultiSelect(
    'Social media platforms you use',
    socialPlatforms
  );

  return behavioral;
}

async function collectVerifiedAttributes(): Promise<VerifiedAttributes> {
  logSection('Verified Attributes');
  log('These attributes can be verified via document scanning.');
  log(`${colors.dim}For now, we'll collect self-reported values.${colors.reset}`);
  log('');

  const attributes: VerifiedAttributes = {};

  attributes.isVeteran = await promptYesNo('Are you a US military veteran?', false);

  attributes.isRegisteredVoter = await promptYesNo(
    'Are you registered to vote?',
    false
  );

  if (attributes.isRegisteredVoter) {
    const voterState = await prompt('Voter registration state (2-letter code)');
    if (voterState && /^[A-Z]{2}$/i.test(voterState)) {
      attributes.voterState = voterState.toUpperCase();
    }
  }

  attributes.isLicensedProfessional = await promptYesNo(
    'Are you a licensed professional (doctor, lawyer, CPA, etc.)?',
    false
  );

  if (attributes.isLicensedProfessional) {
    attributes.licenseType = await prompt('License type (e.g., Medical Doctor, Attorney)') || undefined;
  }

  attributes.isStudent = await promptYesNo('Are you currently a student?', false);

  // Set verification timestamp
  attributes.verifiedAt = new Date().toISOString();

  return attributes;
}

async function collectPreferences(): Promise<UserPreferences> {
  logSection('Poll Preferences');
  log('Configure how you want to participate in polls.');
  log('');

  const preferences: UserPreferences = {};

  const topicOptions = [
    'Technology',
    'Politics',
    'Healthcare',
    'Entertainment',
    'Sports',
    'Finance',
    'Education',
    'Lifestyle',
    'Consumer Products',
    'Travel',
  ];

  log('Select topics you are willing to answer polls about:');
  preferences.allowedTopics = await promptMultiSelect(
    'Allowed topics',
    topicOptions
  );

  log('');
  log('Select topics you want to EXCLUDE:');
  const excludeOptions = [
    'Gambling',
    'Adult content',
    'Alcohol',
    'Tobacco',
    'Political (specific parties)',
    'Religious',
    'None',
  ];
  preferences.excludedTopics = await promptMultiSelect(
    'Excluded topics',
    excludeOptions
  );

  // Filter out "None" if selected
  preferences.excludedTopics = preferences.excludedTopics.filter(
    (t) => t !== 'None'
  );

  preferences.minimumPayoutUsdc = await promptNumber(
    'Minimum payout per poll (USDC)',
    0,
    100,
    0.5
  );

  preferences.maxPollsPerDay = await promptNumber(
    'Maximum polls per day',
    1,
    50,
    10
  );

  preferences.preferredDuration = await promptSelect('Preferred poll length', [
    { value: 'short', label: 'Short (1-5 questions)' },
    { value: 'medium', label: 'Medium (6-15 questions)' },
    { value: 'long', label: 'Long (15+ questions)' },
  ]);

  preferences.autoMode = await promptYesNo(
    'Enable auto-mode (respond to polls automatically)?',
    false
  );

  if (!preferences.autoMode) {
    preferences.requireApproval = await promptYesNo(
      'Require approval before each submission?',
      true
    );
  }

  return preferences;
}

// ============ Document Scanning (Mock) ============

async function offerDocumentScan(): Promise<Partial<VerifiedAttributes>> {
  logSection('Document Verification (Optional)');
  log('You can verify certain attributes by scanning documents.');
  log(`${colors.dim}This is a mock implementation for demo purposes.${colors.reset}`);
  log('');

  const wantToScan = await promptYesNo(
    'Would you like to scan a document?',
    false
  );

  if (!wantToScan) {
    return {};
  }

  const docType = await promptSelect('Document type', [
    { value: 'drivers-license', label: "Driver's License" },
    { value: 'passport', label: 'Passport' },
    { value: 'voter-registration', label: 'Voter Registration Card' },
    { value: 'military-id', label: 'Military ID' },
    { value: 'professional-license', label: 'Professional License' },
    { value: 'student-id', label: 'Student ID' },
  ]);

  log('');
  logInfo('In a real implementation, this would open your camera or file picker.');
  logInfo('For now, we will simulate a successful scan.');
  log('');

  // Simulate scanning delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const extractedAttributes: Partial<VerifiedAttributes> = {
    verifiedAt: new Date().toISOString(),
  };

  switch (docType) {
    case 'drivers-license':
      extractedAttributes.verifiedAgeThreshold = 21;
      logSuccess('Verified: Age 21+');
      break;
    case 'voter-registration':
      extractedAttributes.isRegisteredVoter = true;
      logSuccess('Verified: Registered Voter');
      break;
    case 'military-id':
      extractedAttributes.isVeteran = true;
      logSuccess('Verified: Veteran Status');
      break;
    case 'professional-license':
      extractedAttributes.isLicensedProfessional = true;
      logSuccess('Verified: Licensed Professional');
      break;
    case 'student-id':
      extractedAttributes.isStudent = true;
      logSuccess('Verified: Student Status');
      break;
    default:
      logInfo('Document scanned but no attributes extracted');
  }

  return extractedAttributes;
}

// ============ Wallet Creation ============

interface WalletInfo {
  address: string;
  network: string;
  createdAt: string;
}

async function createWallet(): Promise<WalletInfo> {
  logSection('Wallet Setup');
  log('Creating your wallet for receiving poll payments...');
  log('');

  // In real implementation, this would use CDP SDK
  // For demo, we generate a mock address
  const walletInfo: WalletInfo = {
    address: '0x' + Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join(''),
    network: 'base-sepolia',
    createdAt: new Date().toISOString(),
  };

  // Save wallet data
  const walletPath = path.resolve(process.cwd(), 'wallet-data.json');
  await fs.writeFile(walletPath, JSON.stringify(walletInfo, null, 2));

  logSuccess(`Wallet created: ${walletInfo.address}`);
  logSuccess(`Network: ${walletInfo.network}`);
  logInfo(`Wallet data saved to: ${walletPath}`);

  return walletInfo;
}

// ============ Profile Serialization ============

function serializeProfileToMarkdown(profile: UserProfile): string {
  const lines: string[] = [];

  lines.push('# User Profile');
  lines.push('');

  // Basic Info
  lines.push('## Basic Info');
  lines.push(`- **ID:** ${profile.id}`);
  if (profile.displayName) {
    lines.push(`- **Display Name:** ${profile.displayName}`);
  }
  lines.push(`- **Created:** ${profile.createdAt}`);
  lines.push(`- **Updated:** ${profile.updatedAt}`);
  lines.push(`- **Version:** ${profile.version}`);
  lines.push('');

  // Demographics
  lines.push('## Demographics');
  const demo = profile.demographics;
  if (demo.age) lines.push(`- **Age:** ${demo.age}`);
  if (demo.dateOfBirth) lines.push(`- **Date of Birth:** ${demo.dateOfBirth}`);
  if (demo.gender) lines.push(`- **Gender:** ${demo.gender}`);
  if (demo.state) lines.push(`- **State:** ${demo.state}`);
  if (demo.city) lines.push(`- **City:** ${demo.city}`);
  if (demo.zipCode) lines.push(`- **ZIP Code:** ${demo.zipCode}`);
  if (demo.country) lines.push(`- **Country:** ${demo.country}`);
  if (demo.ethnicity) lines.push(`- **Ethnicity:** ${demo.ethnicity}`);
  if (demo.primaryLanguage) lines.push(`- **Primary Language:** ${demo.primaryLanguage}`);
  lines.push('');

  // Professional
  lines.push('## Professional');
  const prof = profile.professional;
  if (prof.employmentStatus) lines.push(`- **Employment Status:** ${prof.employmentStatus}`);
  if (prof.occupation) lines.push(`- **Occupation:** ${prof.occupation}`);
  if (prof.industry) lines.push(`- **Industry:** ${prof.industry}`);
  if (prof.yearsExperience) lines.push(`- **Years Experience:** ${prof.yearsExperience}`);
  if (prof.education) lines.push(`- **Education:** ${prof.education}`);
  if (prof.incomeRange) lines.push(`- **Income Range:** ${prof.incomeRange}`);
  lines.push('');

  // Behavioral
  lines.push('## Behavioral');
  const behav = profile.behavioral;
  if (behav.politicalLeaning) lines.push(`- **Political Leaning:** ${behav.politicalLeaning}`);
  if (behav.interests?.length) lines.push(`- **Interests:** ${behav.interests.join(', ')}`);
  if (behav.shoppingHabits?.length) lines.push(`- **Shopping Habits:** ${behav.shoppingHabits.join(', ')}`);
  if (behav.mediaConsumption?.length) lines.push(`- **Media Consumption:** ${behav.mediaConsumption.join(', ')}`);
  if (behav.techSavviness) lines.push(`- **Tech Savviness:** ${behav.techSavviness}`);
  if (behav.socialMediaPlatforms?.length) lines.push(`- **Social Media:** ${behav.socialMediaPlatforms.join(', ')}`);
  lines.push('');

  // Verified Attributes
  lines.push('## Verified Attributes');
  const verified = profile.verifiedAttributes;
  if (verified.isVeteran !== undefined) lines.push(`- **Is Veteran:** ${verified.isVeteran}`);
  if (verified.isRegisteredVoter !== undefined) lines.push(`- **Is Registered Voter:** ${verified.isRegisteredVoter}`);
  if (verified.voterState) lines.push(`- **Voter State:** ${verified.voterState}`);
  if (verified.isLicensedProfessional !== undefined) lines.push(`- **Is Licensed Professional:** ${verified.isLicensedProfessional}`);
  if (verified.licenseType) lines.push(`- **License Type:** ${verified.licenseType}`);
  if (verified.verifiedAgeThreshold) lines.push(`- **Verified Age Threshold:** ${verified.verifiedAgeThreshold}`);
  if (verified.isStudent !== undefined) lines.push(`- **Is Student:** ${verified.isStudent}`);
  if (verified.verifiedAt) lines.push(`- **Verified At:** ${verified.verifiedAt}`);
  lines.push('');

  // Preferences
  lines.push('## Preferences');
  const prefs = profile.preferences;
  if (prefs.allowedTopics?.length) lines.push(`- **Allowed Topics:** ${prefs.allowedTopics.join(', ')}`);
  if (prefs.excludedTopics?.length) lines.push(`- **Excluded Topics:** ${prefs.excludedTopics.join(', ')}`);
  if (prefs.minimumPayoutUsdc !== undefined) lines.push(`- **Minimum Payout (USDC):** ${prefs.minimumPayoutUsdc}`);
  if (prefs.maxPollsPerDay) lines.push(`- **Max Polls Per Day:** ${prefs.maxPollsPerDay}`);
  if (prefs.preferredDuration) lines.push(`- **Preferred Duration:** ${prefs.preferredDuration}`);
  if (prefs.autoMode !== undefined) lines.push(`- **Auto Mode:** ${prefs.autoMode}`);
  if (prefs.requireApproval !== undefined) lines.push(`- **Require Approval:** ${prefs.requireApproval}`);
  lines.push('');

  return lines.join('\n');
}

async function saveProfile(profile: UserProfile, profilePath: string): Promise<void> {
  const markdown = serializeProfileToMarkdown(profile);
  const fullPath = path.resolve(process.cwd(), profilePath);

  await fs.writeFile(fullPath, markdown, 'utf-8');
  logSuccess(`Profile saved to: ${fullPath}`);
}

// ============ Main Onboarding Flow ============

async function main(): Promise<void> {
  try {
    initReadline();

    logHeader('Poll in Cash Agent - Onboarding');

    log('Welcome! This wizard will help you set up your agent profile.');
    log('Your profile helps match you with relevant polls and maximize earnings.');
    log('');
    log(`${colors.dim}All information is stored locally on your device.${colors.reset}`);
    log(`${colors.dim}Press Ctrl+C at any time to cancel.${colors.reset}`);
    log('');

    // Get display name
    const displayName = await prompt('Enter your display name');

    // Collect all profile sections
    const demographics = await collectDemographics();
    const professional = await collectProfessional();
    const behavioral = await collectBehavioral();
    const verifiedAttributes = await collectVerifiedAttributes();
    const preferences = await collectPreferences();

    // Offer document scanning
    const scannedAttributes = await offerDocumentScan();

    // Merge scanned attributes with self-reported
    const mergedVerified: VerifiedAttributes = {
      ...verifiedAttributes,
      ...scannedAttributes,
    };

    // Create wallet
    const wallet = await createWallet();

    // Build profile
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: wallet.address,
      displayName: displayName || undefined,
      demographics,
      professional,
      behavioral,
      verifiedAttributes: mergedVerified,
      preferences,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Save profile
    const profilePath = process.env.PROFILE_PATH || './profile.md';
    await saveProfile(profile, profilePath);

    // Display summary
    logSection('Onboarding Complete!');

    log(`${colors.bold}Profile Summary:${colors.reset}`);
    log(`  Display Name: ${profile.displayName || 'Not set'}`);
    log(`  Wallet: ${profile.id}`);
    log(`  State: ${profile.demographics.state || 'Not set'}`);
    log(`  Occupation: ${profile.professional.occupation || 'Not set'}`);
    log(`  Registered Voter: ${profile.verifiedAttributes.isRegisteredVoter ? 'Yes' : 'No'}`);
    log(`  Veteran: ${profile.verifiedAttributes.isVeteran ? 'Yes' : 'No'}`);
    log('');

    logSection('Next Steps');

    log('1. Fund your wallet with testnet ETH for gas fees:');
    log(`   ${colors.cyan}https://www.coinbase.com/faucets${colors.reset}`);
    log('');
    log('2. Get testnet USDC (optional, for testing):');
    log(`   ${colors.cyan}https://faucet.circle.com/${colors.reset}`);
    log('');
    log('3. Run the demo script to discover polls:');
    log(`   ${colors.cyan}npx tsx agent/scripts/demo.ts${colors.reset}`);
    log('');
    log('4. Start the agent to automatically respond to polls:');
    log(`   ${colors.cyan}npm run dev${colors.reset}`);
    log('');

    log(`${colors.green}Happy polling!${colors.reset}`);
    log('');

    closeReadline();
    process.exit(0);
  } catch (error) {
    closeReadline();

    if ((error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
      // User pressed Ctrl+C
      log('');
      logInfo('Onboarding cancelled.');
      process.exit(0);
    }

    logError(`Onboarding failed: ${(error as Error).message}`);
    if (process.env.VERBOSE === 'true') {
      console.error(error);
    }
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('');
  logInfo('Onboarding cancelled.');
  closeReadline();
  process.exit(0);
});

// Run onboarding
main();
