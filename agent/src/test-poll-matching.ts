/**
 * Test Poll Matching
 *
 * Creates test polls and validates matching against a user profile.
 * Tests the discovery and eligibility checking flow.
 */

import { loadProfile } from './profile.js';
import type { VerifiedAttributes } from './types.js';

// ============ Types ============

interface PollCriteria {
  minAge?: number;
  maxAge?: number;
  states?: string[];
  cities?: string[];
  isVeteran?: boolean;
  isRegisteredVoter?: boolean;
  isPropertyOwner?: boolean;
  occupations?: string[];
  industries?: string[];
}

interface PollQuestion {
  id: string;
  type: 'multiple_choice' | 'scale' | 'text';
  text: string;
  options?: string[];
  required: boolean;
}

interface TestPoll {
  id: string;
  title: string;
  description: string;
  criteria: PollCriteria;
  cashPoolUsdc: string;
  participantCap: number;
  questions: PollQuestion[];
  status: 'active';
}

// ============ Matching Logic (from backend/src/routes/agents.ts) ============

function matchesCriteria(
  criteria: PollCriteria,
  attributes: Partial<VerifiedAttributes> & {
    state?: string;
    city?: string;
    occupation?: string;
    industry?: string;
  }
): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check age range
  if (criteria.minAge && (!attributes.verifiedAge || attributes.verifiedAge < criteria.minAge)) {
    reasons.push(`Minimum age ${criteria.minAge} required`);
  }
  if (criteria.maxAge && (!attributes.verifiedAge || attributes.verifiedAge > criteria.maxAge)) {
    reasons.push(`Maximum age ${criteria.maxAge} required`);
  }

  // Check state (verified or self-reported)
  if (criteria.states && criteria.states.length > 0) {
    const userState = attributes.verifiedState || attributes.state;
    if (!userState || !criteria.states.includes(userState)) {
      reasons.push(`Must be in states: ${criteria.states.join(', ')}`);
    }
  }

  // Check city (verified or self-reported)
  if (criteria.cities && criteria.cities.length > 0) {
    const userCity = attributes.verifiedCity || attributes.city;
    if (!userCity || !criteria.cities.map(c => c.toLowerCase()).includes(userCity.toLowerCase())) {
      reasons.push(`Must be in cities: ${criteria.cities.join(', ')}`);
    }
  }

  // Check veteran status
  if (criteria.isVeteran === true && attributes.isVeteran !== true) {
    reasons.push('Must be a verified veteran');
  }

  // Check voter registration
  if (criteria.isRegisteredVoter === true && attributes.isRegisteredVoter !== true) {
    reasons.push('Must be a registered voter');
  }

  // Check property ownership
  if (criteria.isPropertyOwner === true && attributes.isPropertyOwner !== true) {
    reasons.push('Must be a verified property owner');
  }

  // Check occupation
  if (criteria.occupations && criteria.occupations.length > 0) {
    const userOccupation = attributes.occupation?.toLowerCase();
    const matchesOccupation = criteria.occupations.some(o =>
      userOccupation?.includes(o.toLowerCase()) || o.toLowerCase().includes(userOccupation || '')
    );
    if (!matchesOccupation) {
      reasons.push(`Must have occupation: ${criteria.occupations.join(' or ')}`);
    }
  }

  // Check industry
  if (criteria.industries && criteria.industries.length > 0) {
    const userIndustry = attributes.industry?.toLowerCase();
    const matchesIndustry = criteria.industries.some(i =>
      userIndustry?.includes(i.toLowerCase()) || i.toLowerCase().includes(userIndustry || '')
    );
    if (!matchesIndustry) {
      reasons.push(`Must work in industry: ${criteria.industries.join(' or ')}`);
    }
  }

  return {
    matches: reasons.length === 0,
    reasons,
  };
}

// ============ Test Polls ============

const TEST_POLLS: TestPoll[] = [
  // POLL 1: User SHOULD qualify (veteran in Nevada)
  {
    id: 'poll-001-veteran-nv',
    title: 'Veterans in Nevada: VA Healthcare Experience',
    description: 'Help us understand how Nevada veterans experience VA healthcare services. Your feedback will inform policy recommendations.',
    criteria: {
      isVeteran: true,
      states: ['NV'],
    },
    cashPoolUsdc: '5.00',
    participantCap: 5,
    status: 'active',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        text: 'How often do you use VA healthcare services?',
        options: ['Weekly', 'Monthly', 'A few times a year', 'Rarely', 'Never - I use private healthcare'],
        required: true,
      },
      {
        id: 'q2',
        type: 'scale',
        text: 'On a scale of 1-10, how would you rate your overall satisfaction with VA healthcare?',
        required: true,
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        text: 'What is your biggest challenge with VA healthcare?',
        options: ['Long wait times', 'Distance to facilities', 'Quality of care', 'Bureaucracy/paperwork', 'No major challenges'],
        required: true,
      },
      {
        id: 'q4',
        type: 'multiple_choice',
        text: 'Have you used VA telehealth services?',
        options: ['Yes, frequently', 'Yes, occasionally', 'Tried once', 'No, but interested', 'No, not interested'],
        required: true,
      },
      {
        id: 'q5',
        type: 'text',
        text: 'What one improvement would most impact your VA healthcare experience?',
        required: false,
      },
    ],
  },

  // POLL 2: User should NOT qualify (Texas property owner)
  {
    id: 'poll-002-texas-homeowner',
    title: 'Texas Homeowners: Property Tax Survey',
    description: 'Share your experience with Texas property taxes. Your input helps us understand the impact on homeowners.',
    criteria: {
      isPropertyOwner: true,
      states: ['TX'],
    },
    cashPoolUsdc: '2.00',
    participantCap: 10,
    status: 'active',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        text: 'How long have you owned property in Texas?',
        options: ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', 'Over 10 years'],
        required: true,
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        text: 'Has your property tax assessment increased in the last year?',
        options: ['Yes, significantly (>10%)', 'Yes, moderately (5-10%)', 'Yes, slightly (<5%)', 'No change', 'Decreased'],
        required: true,
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        text: 'Have you ever protested your property tax assessment?',
        options: ['Yes, successfully', 'Yes, unsuccessfully', 'No, but considering it', 'No, not aware of the process'],
        required: true,
      },
      {
        id: 'q4',
        type: 'scale',
        text: 'On a scale of 1-10, how fair do you consider your current property tax assessment?',
        required: true,
      },
    ],
  },

  // POLL 3: User SHOULD qualify (Las Vegas food service worker)
  {
    id: 'poll-003-vegas-foodservice',
    title: 'Las Vegas Food Service Workers: Wage Survey',
    description: 'Anonymous survey about wages and working conditions in Las Vegas food service industry.',
    criteria: {
      cities: ['Las Vegas'],
      industries: ['Food Service', 'Restaurant', 'Hospitality'],
    },
    cashPoolUsdc: '3.00',
    participantCap: 10,
    status: 'active',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        text: 'What is your current hourly wage (base, before tips)?',
        options: ['Minimum wage', '$12-15/hour', '$15-18/hour', '$18-22/hour', 'Over $22/hour', 'Salaried'],
        required: true,
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        text: 'Does your employer provide health insurance?',
        options: ['Yes, fully paid', 'Yes, partially subsidized', 'Available but too expensive', 'Not offered', 'I use other coverage'],
        required: true,
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        text: 'How many hours do you typically work per week?',
        options: ['Under 20', '20-30', '30-40', '40-50', 'Over 50'],
        required: true,
      },
      {
        id: 'q4',
        type: 'scale',
        text: 'On a scale of 1-10, how satisfied are you with your current compensation?',
        required: true,
      },
    ],
  },
];

// ============ Console Formatting ============

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function logHeader(text: string) {
  console.log(`\n${COLORS.bright}${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}${text}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}\n`);
}

function logPoll(poll: TestPoll) {
  console.log(`${COLORS.bright}${poll.title}${COLORS.reset}`);
  console.log(`${COLORS.gray}${poll.description}${COLORS.reset}`);
  console.log(`Pool: ${poll.cashPoolUsdc} USDC | Cap: ${poll.participantCap} | Questions: ${poll.questions.length}`);
  console.log(`Criteria: ${JSON.stringify(poll.criteria)}`);
}

function logMatch(matches: boolean, reasons: string[]) {
  if (matches) {
    console.log(`${COLORS.green}✓ ELIGIBLE${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}✗ NOT ELIGIBLE${COLORS.reset}`);
    reasons.forEach(r => console.log(`  ${COLORS.yellow}→ ${r}${COLORS.reset}`));
  }
}

// ============ Main Test ============

async function main() {
  logHeader('Poll Matching Test');

  // Load user profile
  const profilePath = process.env.HOME + '/.pollincash/profile.md';
  console.log(`Loading profile from: ${profilePath}\n`);

  const profile = await loadProfile(profilePath);

  if (!profile) {
    console.error('Failed to load profile!');
    process.exit(1);
  }

  // Extract attributes for matching
  const userAttributes = {
    // Verified attributes
    ...profile.verifiedAttributes,
    // Self-reported (fallback)
    state: profile.demographics.state,
    city: profile.demographics.city,
    occupation: profile.professional.occupation,
    industry: profile.professional.industry,
  };

  console.log(`${COLORS.bright}User Profile Summary:${COLORS.reset}`);
  console.log(`  Name: ${profile.verifiedAttributes.verifiedName || 'Not verified'}`);
  console.log(`  Age: ${profile.verifiedAttributes.verifiedAge || profile.demographics.age}`);
  console.log(`  State: ${profile.verifiedAttributes.verifiedState || profile.demographics.state} (verified: ${!!profile.verifiedAttributes.verifiedState})`);
  console.log(`  City: ${profile.verifiedAttributes.verifiedCity || profile.demographics.city}`);
  console.log(`  Veteran: ${profile.verifiedAttributes.isVeteran || false}`);
  console.log(`  Property Owner: ${profile.verifiedAttributes.isPropertyOwner || false}`);
  console.log(`  Industry: ${profile.professional.industry}`);
  console.log(`  Occupation: ${profile.professional.occupation}`);
  console.log(`  Verification Score: ${profile.verifiedAttributes.verificationScore}/100`);
  console.log('');

  // ============ Poll Discovery Simulation ============
  logHeader('Poll Discovery');

  console.log(`Found ${TEST_POLLS.length} active polls\n`);

  const results: { poll: TestPoll; matches: boolean; reasons: string[]; payout: string }[] = [];

  for (const poll of TEST_POLLS) {
    console.log(`${'─'.repeat(50)}`);
    logPoll(poll);
    console.log('');

    const { matches, reasons } = matchesCriteria(poll.criteria, userAttributes);
    const payoutPerPerson = (parseFloat(poll.cashPoolUsdc) * 0.9 / poll.participantCap).toFixed(4);

    logMatch(matches, reasons);
    if (matches) {
      console.log(`  ${COLORS.gray}Estimated payout: ${payoutPerPerson} USDC${COLORS.reset}`);
    }
    console.log('');

    results.push({ poll, matches, reasons, payout: payoutPerPerson });
  }

  // ============ Summary ============
  logHeader('Matching Summary');

  const eligible = results.filter(r => r.matches);
  const ineligible = results.filter(r => !r.matches);

  console.log(`${COLORS.green}Eligible (${eligible.length}):${COLORS.reset}`);
  eligible.forEach(r => {
    console.log(`  ✓ ${r.poll.title} — ${r.payout} USDC`);
  });

  console.log(`\n${COLORS.red}Not Eligible (${ineligible.length}):${COLORS.reset}`);
  ineligible.forEach(r => {
    console.log(`  ✗ ${r.poll.title}`);
    r.reasons.forEach(reason => console.log(`    → ${reason}`));
  });

  // ============ Agent Actions ============
  if (eligible.length > 0) {
    logHeader('Agent Actions (Auto-Mode)');

    console.log('Since auto-mode is enabled, the agent would:');
    console.log('');

    for (const { poll, payout } of eligible) {
      console.log(`${COLORS.bright}For "${poll.title}":${COLORS.reset}`);
      console.log(`  1. POST /agent/polls/${poll.id}/match — Verify eligibility`);
      console.log(`  2. Answer ${poll.questions.length} questions based on user context`);
      console.log(`  3. Create attestation signature with verified attributes`);
      console.log(`  4. POST /agent/polls/${poll.id}/respond — Submit response`);
      console.log(`  5. User earns ~${payout} USDC when poll closes`);
      console.log('');

      console.log(`  ${COLORS.gray}Sample questions:${COLORS.reset}`);
      poll.questions.slice(0, 2).forEach((q, i) => {
        console.log(`    Q${i + 1}: ${q.text}`);
        if (q.options) {
          console.log(`        Options: ${q.options.join(' | ')}`);
        }
      });
      console.log(`    ... and ${poll.questions.length - 2} more questions`);
      console.log('');
    }

    const totalPotentialEarnings = eligible.reduce((sum, r) => sum + parseFloat(r.payout), 0);
    console.log(`${COLORS.bright}Total potential earnings: ${totalPotentialEarnings.toFixed(4)} USDC${COLORS.reset}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
}

main().catch(console.error);
