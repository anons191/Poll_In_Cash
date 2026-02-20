/**
 * Profile Manager
 *
 * Handles reading, writing, and managing user profile .md files.
 * Provides conversational flow for building profiles and extracting
 * verified attributes for poll matching.
 *
 * @module agent/profile
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  UserProfile,
  DemographicProfile,
  ProfessionalProfile,
  BehavioralProfile,
  VerifiedAttributes,
  UserPreferences,
} from './types.js';

/**
 * Default profile directory and file path
 */
export const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.pollincash');
export const DEFAULT_PROFILE_PATH = path.join(DEFAULT_PROFILE_DIR, 'profile.md');

/**
 * Get the default profile path (~/.pollincash/profile.md)
 */
export function getDefaultProfilePath(): string {
  return DEFAULT_PROFILE_PATH;
}

/**
 * Profile section headers in the markdown file
 */
const SECTION_HEADERS = {
  DEMOGRAPHICS: '## Demographics',
  PROFESSIONAL: '## Professional',
  BEHAVIORAL: '## Behavioral',
  VERIFIED: '## Verified Attributes',
  PREFERENCES: '## Preferences',
  METADATA: '## Metadata',
} as const;

/**
 * Questions for building a profile interactively
 */
export interface ProfileQuestion {
  /** Question ID for tracking */
  id: string;
  /** Section this question belongs to */
  section: keyof typeof SECTION_HEADERS;
  /** Question text to display */
  question: string;
  /** Field in the profile to update */
  field: string;
  /** Type of answer expected */
  type: 'text' | 'number' | 'select' | 'multi-select' | 'boolean';
  /** Options for select/multi-select */
  options?: string[];
  /** Whether this question is required */
  required: boolean;
  /** Validation function */
  validate?: (value: unknown) => boolean;
}

/**
 * Profile questions for interactive building
 */
export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  // Demographics
  {
    id: 'age',
    section: 'DEMOGRAPHICS',
    question: 'What is your age?',
    field: 'demographics.age',
    type: 'number',
    required: false,
    validate: (v) => typeof v === 'number' && v >= 18 && v <= 120,
  },
  {
    id: 'gender',
    section: 'DEMOGRAPHICS',
    question: 'What is your gender?',
    field: 'demographics.gender',
    type: 'select',
    options: ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'],
    required: false,
  },
  {
    id: 'state',
    section: 'DEMOGRAPHICS',
    question: 'What US state do you live in? (2-letter code)',
    field: 'demographics.state',
    type: 'text',
    required: false,
    validate: (v) => typeof v === 'string' && /^[A-Z]{2}$/.test(v.toUpperCase()),
  },
  {
    id: 'city',
    section: 'DEMOGRAPHICS',
    question: 'What city do you live in?',
    field: 'demographics.city',
    type: 'text',
    required: false,
  },
  // Professional
  {
    id: 'employmentStatus',
    section: 'PROFESSIONAL',
    question: 'What is your employment status?',
    field: 'professional.employmentStatus',
    type: 'select',
    options: ['employed', 'self-employed', 'unemployed', 'student', 'retired'],
    required: false,
  },
  {
    id: 'occupation',
    section: 'PROFESSIONAL',
    question: 'What is your occupation?',
    field: 'professional.occupation',
    type: 'text',
    required: false,
  },
  {
    id: 'industry',
    section: 'PROFESSIONAL',
    question: 'What industry do you work in?',
    field: 'professional.industry',
    type: 'text',
    required: false,
  },
  {
    id: 'education',
    section: 'PROFESSIONAL',
    question: 'What is your highest level of education?',
    field: 'professional.education',
    type: 'select',
    options: ['high-school', 'some-college', 'bachelors', 'masters', 'doctorate', 'other'],
    required: false,
  },
  {
    id: 'incomeRange',
    section: 'PROFESSIONAL',
    question: 'What is your annual income range?',
    field: 'professional.incomeRange',
    type: 'select',
    options: [
      'under-25k',
      '25k-50k',
      '50k-75k',
      '75k-100k',
      '100k-150k',
      '150k-250k',
      'over-250k',
    ],
    required: false,
  },
  // Behavioral
  {
    id: 'politicalLeaning',
    section: 'BEHAVIORAL',
    question: 'On a scale of 1-10 (1=very liberal, 10=very conservative), where do you fall politically?',
    field: 'behavioral.politicalLeaning',
    type: 'number',
    required: false,
    validate: (v) => typeof v === 'number' && v >= 1 && v <= 10,
  },
  {
    id: 'interests',
    section: 'BEHAVIORAL',
    question: 'What are your main interests/hobbies? (comma-separated)',
    field: 'behavioral.interests',
    type: 'multi-select',
    required: false,
  },
  {
    id: 'techSavviness',
    section: 'BEHAVIORAL',
    question: 'How would you rate your tech savviness?',
    field: 'behavioral.techSavviness',
    type: 'select',
    options: ['low', 'medium', 'high'],
    required: false,
  },
  // Preferences
  {
    id: 'minimumPayout',
    section: 'PREFERENCES',
    question: 'What is your minimum payout threshold in USDC?',
    field: 'preferences.minimumPayoutUsdc',
    type: 'number',
    required: false,
    validate: (v) => typeof v === 'number' && v >= 0,
  },
  {
    id: 'excludedTopics',
    section: 'PREFERENCES',
    question: 'Are there any topics you want to exclude? (comma-separated)',
    field: 'preferences.excludedTopics',
    type: 'multi-select',
    required: false,
  },
  {
    id: 'autoMode',
    section: 'PREFERENCES',
    question: 'Do you want to enable auto-response mode?',
    field: 'preferences.autoMode',
    type: 'boolean',
    required: false,
  },
];

/**
 * Parse a markdown profile file into a UserProfile object
 */
export function parseProfileFromMarkdown(markdown: string): UserProfile {
  const lines = markdown.split('\n');

  // Initialize empty profile
  const profile: UserProfile = {
    id: '',
    displayName: undefined,
    demographics: {},
    professional: {},
    behavioral: {},
    verifiedAttributes: {},
    preferences: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  let currentSection: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.substring(3).toLowerCase();
      continue;
    }

    // Check for title (profile ID/name)
    if (trimmed.startsWith('# ')) {
      profile.displayName = trimmed.substring(2);
      continue;
    }

    // Parse key-value pairs (format: "- **Key**: Value" or "- Key: Value")
    const kvMatch = trimmed.match(/^-\s*\*?\*?([^*:]+)\*?\*?:\s*(.+)$/);
    if (kvMatch && currentSection) {
      const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '');
      const value = kvMatch[2].trim();

      setProfileValue(profile, currentSection, key, value);
    }
  }

  return profile;
}

/**
 * Set a value in the profile based on section and key
 */
function setProfileValue(
  profile: UserProfile,
  section: string,
  key: string,
  value: string
): void {
  // Parse value based on expected type
  const parseValue = (v: string): unknown => {
    // Boolean
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
    // Number
    const num = parseFloat(v);
    if (!isNaN(num) && v.match(/^-?\d+(\.\d+)?$/)) return num;
    // Array (comma-separated)
    if (v.includes(',')) return v.split(',').map((s) => s.trim());
    // String
    return v;
  };

  const parsed = parseValue(value);

  switch (section) {
    case 'demographics':
      setNestedValue(profile.demographics as Record<string, unknown>, key, parsed);
      break;
    case 'professional':
      setNestedValue(profile.professional as Record<string, unknown>, key, parsed);
      break;
    case 'behavioral':
      setNestedValue(profile.behavioral as Record<string, unknown>, key, parsed);
      break;
    case 'verified attributes':
    case 'verifiedattributes':
      setNestedValue(profile.verifiedAttributes as Record<string, unknown>, key, parsed);
      break;
    case 'preferences':
      setNestedValue(profile.preferences as Record<string, unknown>, key, parsed);
      break;
    case 'metadata':
      if (key === 'id') profile.id = value;
      if (key === 'createdat') profile.createdAt = value;
      if (key === 'updatedat') profile.updatedAt = value;
      if (key === 'version') profile.version = parseInt(value, 10) || 1;
      break;
  }
}

/**
 * Set a nested value with key normalization
 */
function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  // Map common key variations to canonical names
  const keyMap: Record<string, string> = {
    // Demographics
    age: 'age',
    dateofbirth: 'dateOfBirth',
    gender: 'gender',
    state: 'state',
    city: 'city',
    zipcode: 'zipCode',
    country: 'country',
    ethnicity: 'ethnicity',
    primarylanguage: 'primaryLanguage',
    // Professional
    employmentstatus: 'employmentStatus',
    occupation: 'occupation',
    industry: 'industry',
    yearsexperience: 'yearsExperience',
    education: 'education',
    incomerange: 'incomeRange',
    // Behavioral
    politicalleaning: 'politicalLeaning',
    interests: 'interests',
    shoppinghabits: 'shoppingHabits',
    mediaconsumption: 'mediaConsumption',
    techsavviness: 'techSavviness',
    socialmediaplatforms: 'socialMediaPlatforms',
    // Verified - Identity
    verifiedname: 'verifiedName',
    verifieddob: 'verifiedDateOfBirth',
    verifieddateofbirth: 'verifiedDateOfBirth',
    verifiedage: 'verifiedAge',
    agethresholdsmet: 'verifiedAgeThresholds',
    verifiedagethresholds: 'verifiedAgeThresholds',
    verifiedagethreshold: 'verifiedAgeThreshold',
    // Verified - Military
    isveteran: 'isVeteran',
    militarybranch: 'militaryBranch',
    servicestatus: 'serviceStatus',
    vaeligible: 'isVaEligible',
    isvaeligible: 'isVaEligible',
    // Verified - Voter
    isregisteredvoter: 'isRegisteredVoter',
    voterstate: 'voterState',
    votercounty: 'voterCounty',
    partyaffiliation: 'partyAffiliation',
    // Verified - Professional
    islicensedprofessional: 'isLicensedProfessional',
    licensetypes: 'professionalLicenseTypes',
    professionallicensetypes: 'professionalLicenseTypes',
    licensetype: 'licenseType',
    licensestates: 'licenseStates',
    // Verified - Business
    isbusinessowner: 'isBusinessOwner',
    businesstypes: 'businessTypes',
    businessstates: 'businessStates',
    // Verified - Education
    isstudent: 'isStudent',
    educationlevel: 'verifiedEducationLevel',
    verifiededucationlevel: 'verifiedEducationLevel',
    schools: 'verifiedSchools',
    verifiedschools: 'verifiedSchools',
    // Verified - Residency
    verifiedstate: 'verifiedState',
    verifiedcity: 'verifiedCity',
    verifiedzip: 'verifiedZipCode',
    verifiedzipcode: 'verifiedZipCode',
    ispropertyowner: 'isPropertyOwner',
    // Verified - Employment
    isemployed: 'isEmployed',
    verifiedindustries: 'verifiedIndustries',
    // Verified - Shopping
    shopsat: 'shopsAt',
    storememberships: 'storeMemberships',
    // Verified - Financial
    hasbankaccount: 'hasBankAccount',
    banks: 'verifiedBanks',
    verifiedbanks: 'verifiedBanks',
    hasinsurance: 'hasInsurance',
    insurancetypes: 'insuranceTypes',
    // Verified - Metadata
    lastverified: 'lastVerifiedAt',
    lastverifiedat: 'lastVerifiedAt',
    verifiedat: 'verifiedAt',
    documentsverified: 'documentsVerified',
    verificationscore: 'verificationScore',
    // Preferences
    allowedtopics: 'allowedTopics',
    excludedtopics: 'excludedTopics',
    minimumpayoutusdc: 'minimumPayoutUsdc',
    maxpollsperday: 'maxPollsPerDay',
    preferredduration: 'preferredDuration',
    automode: 'autoMode',
    requireapproval: 'requireApproval',
  };

  const canonicalKey = keyMap[key.toLowerCase()] || key;
  obj[canonicalKey] = value;
}

/**
 * Serialize a UserProfile to markdown format
 */
export function serializeProfileToMarkdown(profile: UserProfile): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${profile.displayName || 'User Profile'}`);
  lines.push('');

  // Demographics section
  lines.push(SECTION_HEADERS.DEMOGRAPHICS);
  lines.push('');
  if (profile.demographics.age !== undefined) {
    lines.push(`- **Age**: ${profile.demographics.age}`);
  }
  if (profile.demographics.dateOfBirth) {
    lines.push(`- **Date of Birth**: ${profile.demographics.dateOfBirth}`);
  }
  if (profile.demographics.gender) {
    lines.push(`- **Gender**: ${profile.demographics.gender}`);
  }
  if (profile.demographics.state) {
    lines.push(`- **State**: ${profile.demographics.state}`);
  }
  if (profile.demographics.city) {
    lines.push(`- **City**: ${profile.demographics.city}`);
  }
  if (profile.demographics.zipCode) {
    lines.push(`- **Zip Code**: ${profile.demographics.zipCode}`);
  }
  if (profile.demographics.country) {
    lines.push(`- **Country**: ${profile.demographics.country}`);
  }
  if (profile.demographics.ethnicity) {
    lines.push(`- **Ethnicity**: ${profile.demographics.ethnicity}`);
  }
  if (profile.demographics.primaryLanguage) {
    lines.push(`- **Primary Language**: ${profile.demographics.primaryLanguage}`);
  }
  lines.push('');

  // Professional section
  lines.push(SECTION_HEADERS.PROFESSIONAL);
  lines.push('');
  if (profile.professional.employmentStatus) {
    lines.push(`- **Employment Status**: ${profile.professional.employmentStatus}`);
  }
  if (profile.professional.occupation) {
    lines.push(`- **Occupation**: ${profile.professional.occupation}`);
  }
  if (profile.professional.industry) {
    lines.push(`- **Industry**: ${profile.professional.industry}`);
  }
  if (profile.professional.yearsExperience !== undefined) {
    lines.push(`- **Years Experience**: ${profile.professional.yearsExperience}`);
  }
  if (profile.professional.education) {
    lines.push(`- **Education**: ${profile.professional.education}`);
  }
  if (profile.professional.incomeRange) {
    lines.push(`- **Income Range**: ${profile.professional.incomeRange}`);
  }
  lines.push('');

  // Behavioral section
  lines.push(SECTION_HEADERS.BEHAVIORAL);
  lines.push('');
  if (profile.behavioral.politicalLeaning !== undefined) {
    lines.push(`- **Political Leaning**: ${profile.behavioral.politicalLeaning}`);
  }
  if (profile.behavioral.interests && profile.behavioral.interests.length > 0) {
    lines.push(`- **Interests**: ${profile.behavioral.interests.join(', ')}`);
  }
  if (profile.behavioral.shoppingHabits && profile.behavioral.shoppingHabits.length > 0) {
    lines.push(`- **Shopping Habits**: ${profile.behavioral.shoppingHabits.join(', ')}`);
  }
  if (profile.behavioral.mediaConsumption && profile.behavioral.mediaConsumption.length > 0) {
    lines.push(`- **Media Consumption**: ${profile.behavioral.mediaConsumption.join(', ')}`);
  }
  if (profile.behavioral.techSavviness) {
    lines.push(`- **Tech Savviness**: ${profile.behavioral.techSavviness}`);
  }
  if (profile.behavioral.socialMediaPlatforms && profile.behavioral.socialMediaPlatforms.length > 0) {
    lines.push(`- **Social Media Platforms**: ${profile.behavioral.socialMediaPlatforms.join(', ')}`);
  }
  lines.push('');

  // Verified Attributes section
  lines.push(SECTION_HEADERS.VERIFIED);
  lines.push('');

  const va = profile.verifiedAttributes;

  // Identity
  if (va.verifiedName) {
    lines.push(`- **Verified Name**: ${va.verifiedName}`);
  }
  if (va.verifiedDateOfBirth) {
    lines.push(`- **Verified DOB**: ${va.verifiedDateOfBirth}`);
  }
  if (va.verifiedAge !== undefined) {
    lines.push(`- **Verified Age**: ${va.verifiedAge}`);
  }
  if (va.verifiedAgeThresholds && va.verifiedAgeThresholds.length > 0) {
    lines.push(`- **Age Thresholds Met**: ${va.verifiedAgeThresholds.join(', ')}+`);
  }

  // Military/Veteran
  if (va.isVeteran !== undefined) {
    lines.push(`- **Is Veteran**: ${va.isVeteran}`);
  }
  if (va.militaryBranch) {
    lines.push(`- **Military Branch**: ${va.militaryBranch}`);
  }
  if (va.serviceStatus) {
    lines.push(`- **Service Status**: ${va.serviceStatus}`);
  }
  if (va.isVaEligible !== undefined) {
    lines.push(`- **VA Eligible**: ${va.isVaEligible}`);
  }
  if (va.veteranVerification) {
    lines.push(`- **Veteran Verified**: ${va.veteranVerification.verifiedAt} (${va.veteranVerification.confidence} confidence, via ${va.veteranVerification.documentType})`);
  }

  // Voter Registration
  if (va.isRegisteredVoter !== undefined) {
    lines.push(`- **Is Registered Voter**: ${va.isRegisteredVoter}`);
  }
  if (va.voterState) {
    lines.push(`- **Voter State**: ${va.voterState}`);
  }
  if (va.voterCounty) {
    lines.push(`- **Voter County**: ${va.voterCounty}`);
  }
  if (va.partyAffiliation) {
    lines.push(`- **Party Affiliation**: ${va.partyAffiliation}`);
  }
  if (va.voterVerification) {
    lines.push(`- **Voter Verified**: ${va.voterVerification.verifiedAt} (${va.voterVerification.confidence} confidence)`);
  }

  // Professional
  if (va.isLicensedProfessional !== undefined) {
    lines.push(`- **Is Licensed Professional**: ${va.isLicensedProfessional}`);
  }
  if (va.professionalLicenseTypes && va.professionalLicenseTypes.length > 0) {
    lines.push(`- **License Types**: ${va.professionalLicenseTypes.join(', ')}`);
  }
  if (va.licenseStates && va.licenseStates.length > 0) {
    lines.push(`- **License States**: ${va.licenseStates.join(', ')}`);
  }

  // Business
  if (va.isBusinessOwner !== undefined) {
    lines.push(`- **Is Business Owner**: ${va.isBusinessOwner}`);
  }
  if (va.businessTypes && va.businessTypes.length > 0) {
    lines.push(`- **Business Types**: ${va.businessTypes.join(', ')}`);
  }
  if (va.businessStates && va.businessStates.length > 0) {
    lines.push(`- **Business States**: ${va.businessStates.join(', ')}`);
  }

  // Education
  if (va.isStudent !== undefined) {
    lines.push(`- **Is Student**: ${va.isStudent}`);
  }
  if (va.verifiedEducationLevel) {
    lines.push(`- **Education Level**: ${va.verifiedEducationLevel}`);
  }
  if (va.verifiedSchools && va.verifiedSchools.length > 0) {
    lines.push(`- **Schools**: ${va.verifiedSchools.join(', ')}`);
  }

  // Residency
  if (va.verifiedState) {
    lines.push(`- **Verified State**: ${va.verifiedState}`);
  }
  if (va.verifiedCity) {
    lines.push(`- **Verified City**: ${va.verifiedCity}`);
  }
  if (va.verifiedZipCode) {
    lines.push(`- **Verified Zip**: ${va.verifiedZipCode}`);
  }
  if (va.isPropertyOwner !== undefined) {
    lines.push(`- **Is Property Owner**: ${va.isPropertyOwner}`);
  }
  if (va.residencyVerifications && va.residencyVerifications.length > 0) {
    lines.push(`- **Residency Verifications**: ${va.residencyVerifications.length} document(s)`);
    for (const rv of va.residencyVerifications) {
      lines.push(`  - ${rv.state}${rv.city ? `, ${rv.city}` : ''} (${rv.verificationMethod}, ${rv.confidence} confidence)`);
    }
  }

  // Employment
  if (va.isEmployed !== undefined) {
    lines.push(`- **Is Employed**: ${va.isEmployed}`);
  }
  if (va.employmentVerifications && va.employmentVerifications.length > 0) {
    lines.push(`- **Employment Verifications**: ${va.employmentVerifications.length}`);
    for (const ev of va.employmentVerifications) {
      lines.push(`  - ${ev.employerName}${ev.jobTitle ? ` (${ev.jobTitle})` : ''} - ${ev.confidence} confidence`);
    }
  }
  if (va.verifiedIndustries && va.verifiedIndustries.length > 0) {
    lines.push(`- **Verified Industries**: ${va.verifiedIndustries.join(', ')}`);
  }

  // Shopping
  if (va.shopsAt && va.shopsAt.length > 0) {
    lines.push(`- **Shops At**: ${va.shopsAt.join(', ')}`);
  }
  if (va.storeMemberships && va.storeMemberships.length > 0) {
    lines.push(`- **Store Memberships**: ${va.storeMemberships.join(', ')}`);
  }
  if (va.shoppingVerifications && va.shoppingVerifications.length > 0) {
    lines.push(`- **Shopping Verifications**: ${va.shoppingVerifications.length}`);
    for (const sv of va.shoppingVerifications) {
      const details = [sv.storeName];
      if (sv.membershipLevel) details.push(`Level: ${sv.membershipLevel}`);
      if (sv.memberSince) details.push(`Since: ${sv.memberSince}`);
      if (sv.lastPurchaseDate) details.push(`Last: ${sv.lastPurchaseDate}`);
      lines.push(`  - ${details.join(', ')} (${sv.confidence} confidence)`);
    }
  }

  // Financial
  if (va.hasBankAccount !== undefined) {
    lines.push(`- **Has Bank Account**: ${va.hasBankAccount}`);
  }
  if (va.verifiedBanks && va.verifiedBanks.length > 0) {
    lines.push(`- **Banks**: ${va.verifiedBanks.join(', ')}`);
  }
  if (va.hasInsurance !== undefined) {
    lines.push(`- **Has Insurance**: ${va.hasInsurance}`);
  }
  if (va.insuranceTypes && va.insuranceTypes.length > 0) {
    lines.push(`- **Insurance Types**: ${va.insuranceTypes.join(', ')}`);
  }

  // Metadata
  if (va.lastVerifiedAt) {
    lines.push(`- **Last Verified**: ${va.lastVerifiedAt}`);
  }
  if (va.documentsVerified !== undefined) {
    lines.push(`- **Documents Verified**: ${va.documentsVerified}`);
  }
  if (va.verificationScore !== undefined) {
    lines.push(`- **Verification Score**: ${va.verificationScore}/100`);
  }

  lines.push('');

  // Preferences section
  lines.push(SECTION_HEADERS.PREFERENCES);
  lines.push('');
  if (profile.preferences.allowedTopics && profile.preferences.allowedTopics.length > 0) {
    lines.push(`- **Allowed Topics**: ${profile.preferences.allowedTopics.join(', ')}`);
  }
  if (profile.preferences.excludedTopics && profile.preferences.excludedTopics.length > 0) {
    lines.push(`- **Excluded Topics**: ${profile.preferences.excludedTopics.join(', ')}`);
  }
  if (profile.preferences.minimumPayoutUsdc !== undefined) {
    lines.push(`- **Minimum Payout USDC**: ${profile.preferences.minimumPayoutUsdc}`);
  }
  if (profile.preferences.maxPollsPerDay !== undefined) {
    lines.push(`- **Max Polls Per Day**: ${profile.preferences.maxPollsPerDay}`);
  }
  if (profile.preferences.preferredDuration) {
    lines.push(`- **Preferred Duration**: ${profile.preferences.preferredDuration}`);
  }
  if (profile.preferences.autoMode !== undefined) {
    lines.push(`- **Auto Mode**: ${profile.preferences.autoMode}`);
  }
  if (profile.preferences.requireApproval !== undefined) {
    lines.push(`- **Require Approval**: ${profile.preferences.requireApproval}`);
  }
  lines.push('');

  // Metadata section
  lines.push(SECTION_HEADERS.METADATA);
  lines.push('');
  lines.push(`- **ID**: ${profile.id}`);
  lines.push(`- **Created At**: ${profile.createdAt}`);
  lines.push(`- **Updated At**: ${profile.updatedAt}`);
  lines.push(`- **Version**: ${profile.version}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Load a profile from a markdown file
 */
export async function loadProfile(filePath: string): Promise<UserProfile | null> {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return parseProfileFromMarkdown(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Save a profile to a markdown file
 */
export async function saveProfile(profile: UserProfile, filePath: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  // Update the updatedAt timestamp
  profile.updatedAt = new Date().toISOString();

  const markdown = serializeProfileToMarkdown(profile);

  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(absolutePath, markdown, 'utf-8');
}

/**
 * Create a new empty profile with the given ID
 */
export function createEmptyProfile(id: string, displayName?: string): UserProfile {
  const now = new Date().toISOString();
  return {
    id,
    displayName,
    demographics: {},
    professional: {},
    behavioral: {},
    verifiedAttributes: {},
    preferences: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Build a profile interactively by returning questions to ask
 * Returns the next unanswered question or null if complete
 */
export function getNextQuestion(profile: UserProfile): ProfileQuestion | null {
  for (const question of PROFILE_QUESTIONS) {
    const value = getProfileFieldValue(profile, question.field);
    if (value === undefined || value === null || value === '') {
      return question;
    }
  }
  return null; // All questions answered
}

/**
 * Get a field value from the profile using dot notation
 */
function getProfileFieldValue(profile: UserProfile, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = profile;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a field value in the profile using dot notation
 */
export function setProfileFieldValue(profile: UserProfile, field: string, value: unknown): void {
  const parts = field.split('.');
  let current: Record<string, unknown> = profile as unknown as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Update a profile with new data points from a conversation
 */
export function updateProfile(
  profile: UserProfile,
  updates: Partial<{
    demographics: Partial<DemographicProfile>;
    professional: Partial<ProfessionalProfile>;
    behavioral: Partial<BehavioralProfile>;
    verifiedAttributes: Partial<VerifiedAttributes>;
    preferences: Partial<UserPreferences>;
  }>
): UserProfile {
  const updated = { ...profile };

  if (updates.demographics) {
    updated.demographics = { ...updated.demographics, ...updates.demographics };
  }
  if (updates.professional) {
    updated.professional = { ...updated.professional, ...updates.professional };
  }
  if (updates.behavioral) {
    updated.behavioral = { ...updated.behavioral, ...updates.behavioral };
  }
  if (updates.verifiedAttributes) {
    updated.verifiedAttributes = { ...updated.verifiedAttributes, ...updates.verifiedAttributes };
  }
  if (updates.preferences) {
    updated.preferences = { ...updated.preferences, ...updates.preferences };
  }

  updated.updatedAt = new Date().toISOString();
  updated.version += 1;

  return updated;
}

/**
 * Extract verified attributes for poll matching
 * Returns a summary of attributes that can be used for criteria matching
 */
export function getProfileSummary(profile: UserProfile): VerifiedAttributes & {
  age?: number;
  state?: string;
  occupation?: string;
} {
  return {
    // From verified attributes
    isVeteran: profile.verifiedAttributes.isVeteran,
    isRegisteredVoter: profile.verifiedAttributes.isRegisteredVoter,
    voterState: profile.verifiedAttributes.voterState,
    isLicensedProfessional: profile.verifiedAttributes.isLicensedProfessional,
    licenseType: profile.verifiedAttributes.licenseType,
    verifiedAgeThreshold: profile.verifiedAttributes.verifiedAgeThreshold,
    isStudent: profile.verifiedAttributes.isStudent,
    verifiedAt: profile.verifiedAttributes.verifiedAt,
    // From demographics (for convenience in matching)
    age: profile.demographics.age,
    state: profile.demographics.state,
    occupation: profile.professional.occupation,
  };
}

/**
 * Calculate profile completeness as a percentage
 */
export function getProfileCompleteness(profile: UserProfile): number {
  let filled = 0;
  let total = 0;

  // Count demographic fields
  const demoFields = ['age', 'gender', 'state', 'city'];
  for (const field of demoFields) {
    total++;
    if ((profile.demographics as Record<string, unknown>)[field] !== undefined) {
      filled++;
    }
  }

  // Count professional fields
  const profFields = ['employmentStatus', 'occupation', 'industry', 'education'];
  for (const field of profFields) {
    total++;
    if ((profile.professional as Record<string, unknown>)[field] !== undefined) {
      filled++;
    }
  }

  // Count behavioral fields
  const behavFields = ['politicalLeaning', 'interests', 'techSavviness'];
  for (const field of behavFields) {
    total++;
    if ((profile.behavioral as Record<string, unknown>)[field] !== undefined) {
      filled++;
    }
  }

  return Math.round((filled / total) * 100);
}

/**
 * Profile Manager class for stateful profile operations
 */
export class ProfileManager {
  private profilePath: string;
  private profile: UserProfile | null = null;

  /**
   * Create a ProfileManager instance
   * @param profilePath - Path to the profile.md file. Defaults to ~/.pollincash/profile.md
   */
  constructor(profilePath: string = DEFAULT_PROFILE_PATH) {
    this.profilePath = profilePath;
  }

  /**
   * Load the profile from disk
   */
  async load(): Promise<UserProfile | null> {
    this.profile = await loadProfile(this.profilePath);
    return this.profile;
  }

  /**
   * Save the current profile to disk
   */
  async save(): Promise<void> {
    if (!this.profile) {
      throw new Error('No profile loaded');
    }
    await saveProfile(this.profile, this.profilePath);
  }

  /**
   * Get the current profile
   */
  getProfile(): UserProfile | null {
    return this.profile;
  }

  /**
   * Set the current profile
   */
  setProfile(profile: UserProfile): void {
    this.profile = profile;
  }

  /**
   * Create a new profile with the given ID
   */
  create(id: string, displayName?: string): UserProfile {
    this.profile = createEmptyProfile(id, displayName);
    return this.profile;
  }

  /**
   * Update the profile with new data
   */
  update(
    updates: Partial<{
      demographics: Partial<DemographicProfile>;
      professional: Partial<ProfessionalProfile>;
      behavioral: Partial<BehavioralProfile>;
      verifiedAttributes: Partial<VerifiedAttributes>;
      preferences: Partial<UserPreferences>;
    }>
  ): UserProfile {
    if (!this.profile) {
      throw new Error('No profile loaded');
    }
    this.profile = updateProfile(this.profile, updates);
    return this.profile;
  }

  /**
   * Get a summary for poll matching
   */
  getSummary(): ReturnType<typeof getProfileSummary> | null {
    if (!this.profile) return null;
    return getProfileSummary(this.profile);
  }

  /**
   * Get the next question to ask
   */
  getNextQuestion(): ProfileQuestion | null {
    if (!this.profile) return null;
    return getNextQuestion(this.profile);
  }

  /**
   * Answer a profile question
   */
  answerQuestion(questionId: string, answer: unknown): void {
    if (!this.profile) {
      throw new Error('No profile loaded');
    }

    const question = PROFILE_QUESTIONS.find((q) => q.id === questionId);
    if (!question) {
      throw new Error(`Unknown question: ${questionId}`);
    }

    // Validate if validator provided
    if (question.validate && !question.validate(answer)) {
      throw new Error(`Invalid answer for question: ${questionId}`);
    }

    setProfileFieldValue(this.profile, question.field, answer);
    this.profile.updatedAt = new Date().toISOString();
  }

  /**
   * Get profile completeness
   */
  getCompleteness(): number {
    if (!this.profile) return 0;
    return getProfileCompleteness(this.profile);
  }
}
