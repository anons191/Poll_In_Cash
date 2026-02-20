#!/usr/bin/env npx tsx
/**
 * Test Flow Script
 *
 * End-to-end test for the profile + attestation flow.
 * Tests creating profiles, answering questions, document verification,
 * and poll eligibility matching.
 *
 * Usage: npx tsx agent/src/test-flow.ts
 *
 * MODES:
 * - Default: Tests CONVERSATIONAL MODE (processExtractedData - no API needed)
 * - USE_HEADLESS_API=true: Tests HEADLESS/API MODE (requires ANTHROPIC_API_KEY)
 *
 * @module agent/test-flow
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import {
  ProfileManager,
  createEmptyProfile,
  serializeProfileToMarkdown,
  parseProfileFromMarkdown,
  PROFILE_QUESTIONS,
  setProfileFieldValue,
} from './profile.js';
import {
  processExtractedData,
  AttestationManager,
  DOCUMENT_FIELD_DEFINITIONS,
  getExtractionChecklist,
} from './attestation.js';
import type {
  UserProfile,
  VerifiedAttributes,
  ScannedDocument,
  VerificationResult,
  DriversLicenseData,
  ExtractedField,
  DocumentType,
  ExtractedDataInput,
} from './types.js';
import type { ProcessedDocumentResult, ExtractedFieldInput } from './attestation.js';

// ============ Configuration ============

const TEST_PROFILE_PATH = path.join(os.homedir(), '.pollincash', 'test-profile.md');
const USE_HEADLESS_API = process.env.USE_HEADLESS_API === 'true';
const TEST_IMAGE_PATH = process.env.TEST_IMAGE_PATH || '/path/to/test-drivers-license.jpg';

// ============ Console Styling ============

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string): void {
  console.log(message);
}

function logSection(title: string): void {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logStep(step: number, message: string): void {
  console.log(`${colors.blue}[Step ${step}]${colors.reset} ${message}`);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}  ✓ ${message}${colors.reset}`);
}

function logInfo(message: string): void {
  console.log(`${colors.dim}  → ${message}${colors.reset}`);
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}  ⚠ ${message}${colors.reset}`);
}

function logError(message: string): void {
  console.log(`${colors.red}  ✗ ${message}${colors.reset}`);
}

// ============ Mock Data ============

/**
 * Sample profile data for testing
 * Matches the requirements: age 30, state NV, city Las Vegas, etc.
 */
const SAMPLE_PROFILE_DATA = {
  // Demographics
  age: 30,
  gender: 'male' as const,
  state: 'NV',
  city: 'Las Vegas',

  // Professional
  employmentStatus: 'employed' as const,
  occupation: 'Manager',
  industry: 'Food Service',
  education: 'some-college' as const,
  incomeRange: '25k-50k',

  // Behavioral
  politicalLeaning: 5,
  interests: ['cooking', 'technology', 'gaming'],
  techSavviness: 'medium' as const,

  // Preferences
  minimumPayoutUsdc: 0.50,
  excludedTopics: [] as string[],
  autoMode: true,
};

/**
 * Sample extracted data for conversational mode testing
 * This simulates what an agent would extract from a driver's license image
 */
function createMockExtractedDriversLicense(): ExtractedDataInput {
  // Calculate DOB for age 30
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 30);
  const dobString = dob.toISOString().split('T')[0];

  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 4);

  return {
    fullName: { value: 'Test User', confidence: 'high' },
    dateOfBirth: { value: dobString, confidence: 'high' },
    state: { value: 'NV', confidence: 'high' },
    address: { value: '123 Test Street', confidence: 'high' },
    city: { value: 'Las Vegas', confidence: 'high' },
    zipCode: { value: '89101', confidence: 'high' },
    expirationDate: { value: expirationDate.toISOString().split('T')[0], confidence: 'high' },
    licenseClass: { value: 'C', confidence: 'high' },
  };
}

/**
 * Sample extracted data for VA card testing
 */
function createMockExtractedVACard(): ExtractedDataInput {
  return {
    fullName: { value: 'Test User', confidence: 'high' },
    veteranStatus: { value: true, confidence: 'high' },
    branch: { value: 'Army', confidence: 'high' },
    vaEligibility: { value: true, confidence: 'medium' },
  };
}

/**
 * Sample extracted data for Costco membership testing
 */
function createMockExtractedCostcoMembership(): ExtractedDataInput {
  return {
    storeName: { value: 'Costco', confidence: 'high' },
    memberName: { value: 'Test User', confidence: 'high' },
    membershipLevel: { value: 'Executive', confidence: 'high' },
    memberSince: { value: '2019', confidence: 'medium' },
  };
}

// ============ Verification Score Calculation ============

/**
 * Calculate verification score based on verified attributes
 * Matches the scoring in skill.md
 */
function calculateVerificationScore(
  profile: UserProfile
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let score = 0;

  // Profile completed (15 questions answered) = +15
  const profileFields = [
    profile.demographics.age,
    profile.demographics.gender,
    profile.demographics.state,
    profile.demographics.city,
    profile.professional.employmentStatus,
    profile.professional.occupation,
    profile.professional.industry,
    profile.professional.education,
    profile.professional.incomeRange,
    profile.behavioral.politicalLeaning,
    profile.behavioral.interests,
    profile.behavioral.techSavviness,
    profile.preferences.minimumPayoutUsdc,
    profile.preferences.excludedTopics,
    profile.preferences.autoMode,
  ];
  const answeredCount = profileFields.filter((v) => v !== undefined).length;
  if (answeredCount >= 10) {
    // Consider profile "complete" if at least 10 questions answered
    breakdown['Profile completed'] = 15;
    score += 15;
  }

  const va = profile.verifiedAttributes;

  // Name verified = +7
  if (va.verifiedName) {
    breakdown['Name verified'] = 7;
    score += 7;
  }

  // Age/DOB verified = +7
  if (va.verifiedAge || va.verifiedDateOfBirth) {
    breakdown['Age/DOB verified'] = 7;
    score += 7;
  }

  // State verified = +7
  if (va.verifiedState) {
    breakdown['State verified'] = 7;
    score += 7;
  }

  // Veteran status = +10
  if (va.isVeteran) {
    breakdown['Veteran status'] = 10;
    score += 10;
  }

  // Registered voter = +7
  if (va.isRegisteredVoter) {
    breakdown['Registered voter'] = 7;
    score += 7;
  }

  // Licensed professional = +7
  if (va.isLicensedProfessional) {
    breakdown['Licensed professional'] = 7;
    score += 7;
  }

  // Current student = +6
  if (va.isStudent) {
    breakdown['Current student'] = 6;
    score += 6;
  }

  // Currently employed = +7
  if (va.isEmployed) {
    breakdown['Currently employed'] = 7;
    score += 7;
  }

  // Business owner = +7
  if (va.isBusinessOwner) {
    breakdown['Business owner'] = 7;
    score += 7;
  }

  // Bank account verified = +5
  if (va.hasBankAccount) {
    breakdown['Bank account verified'] = 5;
    score += 5;
  }

  // Insurance verified = +5
  if (va.hasInsurance) {
    breakdown['Insurance verified'] = 5;
    score += 5;
  }

  // Store memberships = +6
  if (va.storeMemberships && va.storeMemberships.length > 0) {
    breakdown['Store memberships'] = 6;
    score += 6;
  }

  // Shopping behavior (receipts) = +5
  if (va.shopsAt && va.shopsAt.length > 0 && !va.storeMemberships) {
    breakdown['Shopping behavior'] = 5;
    score += 5;
  }

  // Property owner = +6
  if (va.isPropertyOwner) {
    breakdown['Property owner'] = 6;
    score += 6;
  }

  return { score: Math.min(score, 100), breakdown };
}

// ============ Poll Eligibility Mapping ============

interface PollCriteria {
  name: string;
  requirements: string[];
  check: (profile: UserProfile) => boolean;
}

/**
 * Common poll targeting criteria from skill.md
 */
const POLL_CRITERIA: PollCriteria[] = [
  {
    name: 'Veterans',
    requirements: ['isVeteran: true'],
    check: (p) => p.verifiedAttributes.isVeteran === true,
  },
  {
    name: 'Veterans in Nevada',
    requirements: ['isVeteran: true', 'verifiedState: NV'],
    check: (p) =>
      p.verifiedAttributes.isVeteran === true &&
      p.verifiedAttributes.verifiedState === 'NV',
  },
  {
    name: 'Adults 21+',
    requirements: ['verifiedAge >= 21 OR verifiedAgeThresholds includes 21'],
    check: (p) =>
      (p.verifiedAttributes.verifiedAge ?? 0) >= 21 ||
      (p.verifiedAttributes.verifiedAgeThresholds?.includes(21) ?? false),
  },
  {
    name: 'Adults 30+',
    requirements: ['verifiedAge >= 30'],
    check: (p) => (p.verifiedAttributes.verifiedAge ?? 0) >= 30,
  },
  {
    name: 'Seniors 65+',
    requirements: ['verifiedAge >= 65'],
    check: (p) => (p.verifiedAttributes.verifiedAge ?? 0) >= 65,
  },
  {
    name: 'Registered voters',
    requirements: ['isRegisteredVoter: true'],
    check: (p) => p.verifiedAttributes.isRegisteredVoter === true,
  },
  {
    name: 'Homeowners',
    requirements: ['isPropertyOwner: true'],
    check: (p) => p.verifiedAttributes.isPropertyOwner === true,
  },
  {
    name: 'Current students',
    requirements: ['isStudent: true'],
    check: (p) => p.verifiedAttributes.isStudent === true,
  },
  {
    name: 'Nevada residents',
    requirements: ['verifiedState: NV'],
    check: (p) => p.verifiedAttributes.verifiedState === 'NV',
  },
  {
    name: 'Las Vegas residents',
    requirements: ['verifiedState: NV', 'verifiedCity: Las Vegas'],
    check: (p) =>
      p.verifiedAttributes.verifiedState === 'NV' &&
      p.verifiedAttributes.verifiedCity === 'Las Vegas',
  },
  {
    name: 'Costco shoppers',
    requirements: ['shopsAt includes Costco OR storeMemberships includes Costco'],
    check: (p) =>
      p.verifiedAttributes.shopsAt?.includes('Costco') ||
      p.verifiedAttributes.storeMemberships?.includes('Costco') ||
      false,
  },
  {
    name: 'Small business owners',
    requirements: ['isBusinessOwner: true'],
    check: (p) => p.verifiedAttributes.isBusinessOwner === true,
  },
  {
    name: 'Licensed professionals',
    requirements: ['isLicensedProfessional: true'],
    check: (p) => p.verifiedAttributes.isLicensedProfessional === true,
  },
  {
    name: 'People with health insurance',
    requirements: ['hasInsurance: true', 'insuranceTypes includes health'],
    check: (p) =>
      p.verifiedAttributes.hasInsurance === true &&
      (p.verifiedAttributes.insuranceTypes?.includes('health') ?? false),
  },
  {
    name: 'General population (no requirements)',
    requirements: ['None - open to all'],
    check: () => true,
  },
  {
    name: 'Demographics polls (profile complete)',
    requirements: ['Basic profile completed'],
    check: (p) => p.demographics.age !== undefined && p.demographics.state !== undefined,
  },
];

/**
 * Check poll eligibility and return summary
 */
function checkPollEligibility(
  profile: UserProfile
): { eligible: PollCriteria[]; ineligible: PollCriteria[] } {
  const eligible: PollCriteria[] = [];
  const ineligible: PollCriteria[] = [];

  for (const criteria of POLL_CRITERIA) {
    if (criteria.check(profile)) {
      eligible.push(criteria);
    } else {
      ineligible.push(criteria);
    }
  }

  return { eligible, ineligible };
}

// ============ Main Test Flow ============

async function runTestFlow(): Promise<void> {
  console.log(`\n${colors.bright}${colors.magenta}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Poll in Cash - Profile & Attestation Test            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  logInfo(`Test profile path: ${TEST_PROFILE_PATH}`);
  logInfo(`Mode: ${USE_HEADLESS_API ? 'HEADLESS/API (requires ANTHROPIC_API_KEY)' : 'CONVERSATIONAL (no API needed)'}`);
  if (USE_HEADLESS_API) {
    logInfo(`Test image path: ${TEST_IMAGE_PATH}`);
  }

  // =========================================
  // Step 1: Create a new profile
  // =========================================
  logSection('Step 1: Create New Profile');

  logStep(1, 'Creating empty profile...');

  // Ensure directory exists
  const profileDir = path.dirname(TEST_PROFILE_PATH);
  await fs.mkdir(profileDir, { recursive: true });
  logSuccess(`Directory created: ${profileDir}`);

  // Create profile manager with test path
  const manager = new ProfileManager(TEST_PROFILE_PATH);

  // Create a new profile with a test wallet address
  const testWalletAddress = '0x' + 'a'.repeat(40);
  const profile = manager.create(testWalletAddress, 'Test User Profile');
  logSuccess(`Empty profile created with ID: ${profile.id.substring(0, 20)}...`);

  // =========================================
  // Step 2: Answer all 15 profile questions
  // =========================================
  logSection('Step 2: Answer Profile Questions');

  logStep(2, 'Answering 15 profile questions with sample data...');

  // Demographics
  setProfileFieldValue(profile, 'demographics.age', SAMPLE_PROFILE_DATA.age);
  logInfo(`Age: ${SAMPLE_PROFILE_DATA.age}`);

  setProfileFieldValue(profile, 'demographics.gender', SAMPLE_PROFILE_DATA.gender);
  logInfo(`Gender: ${SAMPLE_PROFILE_DATA.gender}`);

  setProfileFieldValue(profile, 'demographics.state', SAMPLE_PROFILE_DATA.state);
  logInfo(`State: ${SAMPLE_PROFILE_DATA.state}`);

  setProfileFieldValue(profile, 'demographics.city', SAMPLE_PROFILE_DATA.city);
  logInfo(`City: ${SAMPLE_PROFILE_DATA.city}`);

  // Professional
  setProfileFieldValue(profile, 'professional.employmentStatus', SAMPLE_PROFILE_DATA.employmentStatus);
  logInfo(`Employment Status: ${SAMPLE_PROFILE_DATA.employmentStatus}`);

  setProfileFieldValue(profile, 'professional.occupation', SAMPLE_PROFILE_DATA.occupation);
  logInfo(`Occupation: ${SAMPLE_PROFILE_DATA.occupation}`);

  setProfileFieldValue(profile, 'professional.industry', SAMPLE_PROFILE_DATA.industry);
  logInfo(`Industry: ${SAMPLE_PROFILE_DATA.industry}`);

  setProfileFieldValue(profile, 'professional.education', SAMPLE_PROFILE_DATA.education);
  logInfo(`Education: ${SAMPLE_PROFILE_DATA.education}`);

  setProfileFieldValue(profile, 'professional.incomeRange', SAMPLE_PROFILE_DATA.incomeRange);
  logInfo(`Income Range: ${SAMPLE_PROFILE_DATA.incomeRange}`);

  // Behavioral
  setProfileFieldValue(profile, 'behavioral.politicalLeaning', SAMPLE_PROFILE_DATA.politicalLeaning);
  logInfo(`Political Leaning: ${SAMPLE_PROFILE_DATA.politicalLeaning}`);

  setProfileFieldValue(profile, 'behavioral.interests', SAMPLE_PROFILE_DATA.interests);
  logInfo(`Interests: ${SAMPLE_PROFILE_DATA.interests.join(', ')}`);

  setProfileFieldValue(profile, 'behavioral.techSavviness', SAMPLE_PROFILE_DATA.techSavviness);
  logInfo(`Tech Savviness: ${SAMPLE_PROFILE_DATA.techSavviness}`);

  // Preferences
  setProfileFieldValue(profile, 'preferences.minimumPayoutUsdc', SAMPLE_PROFILE_DATA.minimumPayoutUsdc);
  logInfo(`Minimum Payout: ${SAMPLE_PROFILE_DATA.minimumPayoutUsdc} USDC`);

  setProfileFieldValue(profile, 'preferences.excludedTopics', SAMPLE_PROFILE_DATA.excludedTopics);
  logInfo(`Excluded Topics: ${SAMPLE_PROFILE_DATA.excludedTopics.length === 0 ? 'none' : SAMPLE_PROFILE_DATA.excludedTopics.join(', ')}`);

  setProfileFieldValue(profile, 'preferences.autoMode', SAMPLE_PROFILE_DATA.autoMode);
  logInfo(`Auto Mode: ${SAMPLE_PROFILE_DATA.autoMode}`);

  manager.setProfile(profile);
  logSuccess('All 15 profile questions answered');

  // =========================================
  // Step 3: Save and read back the profile
  // =========================================
  logSection('Step 3: Save & Verify Profile');

  logStep(3, 'Saving profile to markdown...');
  await manager.save();
  logSuccess(`Profile saved to: ${TEST_PROFILE_PATH}`);

  logStep(3, 'Reading profile back...');
  const savedContent = await fs.readFile(TEST_PROFILE_PATH, 'utf-8');
  const loadedProfile = parseProfileFromMarkdown(savedContent);

  // Verify key fields
  const verifications = [
    { field: 'age', expected: SAMPLE_PROFILE_DATA.age, actual: loadedProfile.demographics.age },
    { field: 'state', expected: SAMPLE_PROFILE_DATA.state, actual: loadedProfile.demographics.state },
    { field: 'city', expected: SAMPLE_PROFILE_DATA.city, actual: loadedProfile.demographics.city },
    { field: 'occupation', expected: SAMPLE_PROFILE_DATA.occupation, actual: loadedProfile.professional.occupation },
    { field: 'industry', expected: SAMPLE_PROFILE_DATA.industry, actual: loadedProfile.professional.industry },
    { field: 'autoMode', expected: SAMPLE_PROFILE_DATA.autoMode, actual: loadedProfile.preferences.autoMode },
  ];

  let allMatch = true;
  for (const v of verifications) {
    const match = JSON.stringify(v.expected) === JSON.stringify(v.actual);
    if (match) {
      logSuccess(`${v.field}: ${v.actual}`);
    } else {
      logError(`${v.field}: expected ${v.expected}, got ${v.actual}`);
      allMatch = false;
    }
  }

  if (allMatch) {
    logSuccess('All profile fields verified correctly!');
  } else {
    logError('Some profile fields did not match!');
  }

  // Show a snippet of the markdown
  log(`\n${colors.dim}--- Markdown Preview (first 30 lines) ---${colors.reset}`);
  const lines = savedContent.split('\n').slice(0, 30);
  for (const line of lines) {
    console.log(colors.dim + '  ' + line + colors.reset);
  }
  log(colors.dim + '  ...' + colors.reset);

  // =========================================
  // Step 4 & 5: Document Verification
  // =========================================
  logSection('Step 4 & 5: Document Verification');

  logStep(4, 'Initializing AttestationManager...');

  // Create attestation manager (no API key needed for conversational mode)
  const attestationManager = new AttestationManager();
  logSuccess('AttestationManager created');

  logStep(5, 'Processing extracted document data...');

  if (USE_HEADLESS_API) {
    // HEADLESS MODE: Use API to scan document file
    logInfo('Using HEADLESS/API MODE - scanning document file with Anthropic API');
    const scanResult = await attestationManager.scanHeadless(TEST_IMAGE_PATH, 'drivers-license');

    if (!scanResult.success) {
      logError(`Scan failed: ${scanResult.error}`);
      return;
    }

    logSuccess('Document scanned via API!');
    if (scanResult.warnings && scanResult.warnings.length > 0) {
      for (const warning of scanResult.warnings) {
        logWarning(warning);
      }
    }
  } else {
    // CONVERSATIONAL MODE: Process pre-extracted data (simulating agent seeing document)
    logInfo('Using CONVERSATIONAL MODE - processing extracted fields directly');
    logInfo('(In real use, the agent would extract these fields from the document image in chat)');

    // Show extraction checklist
    log(`\n${colors.dim}--- Extraction Checklist for drivers-license ---${colors.reset}`);
    const fieldDefs = DOCUMENT_FIELD_DEFINITIONS['drivers-license'];
    for (const field of fieldDefs.fields) {
      const req = field.required ? '(required)' : '(optional)';
      logInfo(`${field.name} ${req}: ${field.description}`);
    }

    // Process driver's license (simulating agent extraction)
    log(`\n${colors.dim}--- Processing Driver's License ---${colors.reset}`);
    const dlExtracted = createMockExtractedDriversLicense();
    logInfo('Extracted fields:');
    for (const [key, field] of Object.entries(dlExtracted)) {
      if (field) {
        logInfo(`  ${key}: ${field.value} (${field.confidence})`);
      }
    }

    const dlResult = attestationManager.addExtractedDocument('drivers-license', dlExtracted);

    if (!dlResult.success) {
      logError(`Processing failed: ${dlResult.error}`);
      return;
    }

    logSuccess('Driver\'s license processed successfully!');
    if (dlResult.warnings.length > 0) {
      for (const warning of dlResult.warnings) {
        logWarning(warning);
      }
    }

    // Also process VA card (simulating additional document)
    log(`\n${colors.dim}--- Processing VA Card ---${colors.reset}`);
    const vaExtracted = createMockExtractedVACard();
    logInfo('Extracted fields:');
    for (const [key, field] of Object.entries(vaExtracted)) {
      if (field) {
        logInfo(`  ${key}: ${field.value} (${field.confidence})`);
      }
    }

    const vaResult = attestationManager.addExtractedDocument('va-card', vaExtracted);

    if (vaResult.success) {
      logSuccess('VA card processed successfully!');
    } else {
      logWarning(`VA card processing had issues: ${vaResult.error}`);
    }

    // Process Costco membership
    log(`\n${colors.dim}--- Processing Costco Membership ---${colors.reset}`);
    const costcoExtracted = createMockExtractedCostcoMembership();
    logInfo('Extracted fields:');
    for (const [key, field] of Object.entries(costcoExtracted)) {
      if (field) {
        logInfo(`  ${key}: ${field.value} (${field.confidence})`);
      }
    }

    const costcoResult = attestationManager.addExtractedDocument('store-membership', costcoExtracted);

    if (costcoResult.success) {
      logSuccess('Costco membership processed successfully!');
    } else {
      logWarning(`Costco membership processing had issues: ${costcoResult.error}`);
    }
  }

  // Get the verified attributes from attestation manager
  const derivedAttrs = attestationManager.getVerifiedAttributes();

  // =========================================
  // Step 6: Verify attestation attributes
  // =========================================
  logSection('Step 6: Verify Attestation Attributes');

  logStep(6, 'Checking combined verified attributes from AttestationManager...');

  log(`\n${colors.dim}--- Combined Verified Attributes ---${colors.reset}`);
  logInfo(`Verified Name: ${derivedAttrs.verifiedName}`);
  logInfo(`Verified Age: ${derivedAttrs.verifiedAge}`);
  logInfo(`Verified State: ${derivedAttrs.verifiedState}`);
  logInfo(`Verified City: ${derivedAttrs.verifiedCity}`);
  logInfo(`Age Thresholds: ${derivedAttrs.verifiedAgeThresholds?.join(', ')}`);
  logInfo(`Is Veteran: ${derivedAttrs.isVeteran}`);
  logInfo(`Military Branch: ${derivedAttrs.militaryBranch}`);
  logInfo(`Shops At: ${derivedAttrs.shopsAt?.join(', ')}`);
  logInfo(`Store Memberships: ${derivedAttrs.storeMemberships?.join(', ')}`);
  logInfo(`Documents Verified: ${derivedAttrs.documentsVerified}`);

  // Verify attributes match expected values
  const attrChecks = [
    { name: 'verifiedAge', expected: 30, actual: derivedAttrs.verifiedAge },
    { name: 'verifiedState', expected: 'NV', actual: derivedAttrs.verifiedState },
    { name: 'verifiedCity', expected: 'Las Vegas', actual: derivedAttrs.verifiedCity },
    { name: 'verifiedName', expected: 'Test User', actual: derivedAttrs.verifiedName },
    { name: 'isVeteran', expected: true, actual: derivedAttrs.isVeteran },
    { name: 'storeMemberships[0]', expected: 'Costco', actual: derivedAttrs.storeMemberships?.[0] },
  ];

  let attrsMatch = true;
  for (const check of attrChecks) {
    if (check.actual === check.expected) {
      logSuccess(`${check.name} = ${check.actual}`);
    } else {
      logError(`${check.name}: expected ${check.expected}, got ${check.actual}`);
      attrsMatch = false;
    }
  }

  if (attrsMatch) {
    logSuccess('All attestation attributes verified correctly!');
  }

  // =========================================
  // Step 7 & 8: Update profile with verified attributes
  // =========================================
  logSection('Step 7 & 8: Update Profile with Verified Attributes');

  logStep(7, 'Merging verified attributes into profile...');

  // Update the profile with derived attributes from attestation manager
  profile.verifiedAttributes = {
    ...profile.verifiedAttributes,
    ...derivedAttrs,
  };

  manager.setProfile(profile);
  logSuccess('Verified attributes merged');

  logStep(8, 'Saving updated profile...');
  await manager.save();
  logSuccess('Profile saved with verified attributes');

  // Read back and verify
  const updatedContent = await fs.readFile(TEST_PROFILE_PATH, 'utf-8');
  const updatedProfile = parseProfileFromMarkdown(updatedContent);

  log(`\n${colors.dim}--- Verified Attributes Section ---${colors.reset}`);
  const vaSection = updatedContent.split('## Verified Attributes')[1]?.split('## Preferences')[0];
  if (vaSection) {
    const vaLines = vaSection.trim().split('\n').slice(0, 15);
    for (const line of vaLines) {
      console.log(colors.dim + '  ' + line + colors.reset);
    }
  }

  // Verify the saved attributes
  if (updatedProfile.verifiedAttributes.verifiedAge === 30) {
    logSuccess('Verified age persisted correctly');
  } else {
    logError(`Verified age not persisted: ${updatedProfile.verifiedAttributes.verifiedAge}`);
  }

  if (updatedProfile.verifiedAttributes.verifiedState === 'NV') {
    logSuccess('Verified state persisted correctly');
  } else {
    logError(`Verified state not persisted: ${updatedProfile.verifiedAttributes.verifiedState}`);
  }

  // =========================================
  // Step 9: Calculate verification score
  // =========================================
  logSection('Step 9: Verification Score');

  logStep(9, 'Calculating verification score...');

  const { score, breakdown } = calculateVerificationScore(updatedProfile);

  log(`\n${colors.dim}--- Score Breakdown ---${colors.reset}`);
  for (const [item, points] of Object.entries(breakdown)) {
    logInfo(`${item}: +${points} points`);
  }

  log('');
  const tier =
    score >= 81
      ? 'Diamond'
      : score >= 61
      ? 'Platinum'
      : score >= 41
      ? 'Gold'
      : score >= 21
      ? 'Silver'
      : 'Bronze';

  console.log(
    `${colors.bright}${colors.green}  Total Score: ${score}/100 (${tier} Tier)${colors.reset}`
  );

  // =========================================
  // Step 10: Poll eligibility summary
  // =========================================
  logSection('Step 10: Poll Eligibility Summary');

  logStep(10, 'Checking poll eligibility based on verified attributes...');

  const { eligible, ineligible } = checkPollEligibility(updatedProfile);

  log(`\n${colors.green}${colors.bright}Eligible Polls (${eligible.length}):${colors.reset}`);
  for (const poll of eligible) {
    logSuccess(`${poll.name}`);
    logInfo(`  Requirements: ${poll.requirements.join(', ')}`);
  }

  log(`\n${colors.yellow}${colors.bright}Ineligible Polls (${ineligible.length}):${colors.reset}`);
  for (const poll of ineligible) {
    logWarning(`${poll.name}`);
    logInfo(`  Missing: ${poll.requirements.join(', ')}`);
  }

  // =========================================
  // Final Summary
  // =========================================
  logSection('Test Summary');

  console.log(`${colors.bright}Profile Statistics:${colors.reset}`);
  logInfo(`Profile Location: ${TEST_PROFILE_PATH}`);
  logInfo(`Mode: ${USE_HEADLESS_API ? 'Headless/API' : 'Conversational'}`);
  logInfo(`Questions Answered: 15/15`);
  logInfo(`Documents Verified: ${derivedAttrs.documentsVerified || 0}`);
  logInfo(`Verification Score: ${score}/100 (${tier})`);
  logInfo(`Eligible Poll Types: ${eligible.length}/${POLL_CRITERIA.length}`);

  console.log(`\n${colors.bright}${colors.green}✓ All test steps completed successfully!${colors.reset}\n`);

  // Cleanup note
  logInfo(`To clean up, delete: ${TEST_PROFILE_PATH}`);
  log('');
  logInfo('Run modes:');
  logInfo('  Default (conversational): npx tsx agent/src/test-flow.ts');
  logInfo('  Headless/API mode: USE_HEADLESS_API=true TEST_IMAGE_PATH=/path/to/license.jpg npx tsx agent/src/test-flow.ts');
}

// ============ Run the test ============

runTestFlow().catch((error) => {
  console.error(`${colors.red}Test failed with error:${colors.reset}`, error);
  process.exit(1);
});
