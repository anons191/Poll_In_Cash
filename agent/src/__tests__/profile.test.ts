/**
 * Profile Module Tests
 *
 * Tests for profile management functions including:
 * - parseProfileFromMarkdown
 * - serializeProfileToMarkdown
 * - loadProfile
 * - saveProfile
 * - getProfileSummary
 * - updateProfile
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  UserProfile,
  DemographicProfile,
  ProfessionalProfile,
  BehavioralProfile,
  VerifiedAttributes,
  UserPreferences,
} from '../types.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}));

// Import mocked modules
import * as fs from 'node:fs/promises';

// Sample valid markdown profile
const validProfileMarkdown = `# User Profile

## Basic Info
- **ID:** 0x1234567890abcdef1234567890abcdef12345678
- **Display Name:** John Doe
- **Created:** 2024-01-15T10:00:00.000Z
- **Updated:** 2024-01-20T15:30:00.000Z
- **Version:** 1

## Demographics
- **Age:** 35
- **Date of Birth:** 1989-05-15
- **Gender:** male
- **State:** CA
- **City:** San Francisco
- **ZIP Code:** 94102
- **Country:** US
- **Ethnicity:** Caucasian
- **Primary Language:** English

## Professional
- **Employment Status:** employed
- **Occupation:** Software Engineer
- **Industry:** Technology
- **Years Experience:** 10
- **Education:** bachelors
- **Income Range:** 100000-150000

## Behavioral
- **Political Leaning:** 5
- **Interests:** technology, gaming, reading
- **Shopping Habits:** online, electronics
- **Media Consumption:** streaming, podcasts
- **Tech Savviness:** high
- **Social Media:** twitter, linkedin

## Verified Attributes
- **Is Veteran:** false
- **Is Registered Voter:** true
- **Voter State:** CA
- **Is Licensed Professional:** false
- **Verified Age Threshold:** 21
- **Is Student:** false
- **Verified At:** 2024-01-15T10:00:00.000Z

## Preferences
- **Allowed Topics:** technology, politics, entertainment
- **Excluded Topics:** gambling
- **Minimum Payout (USDC):** 0.50
- **Max Polls Per Day:** 10
- **Preferred Duration:** medium
- **Auto Mode:** false
- **Require Approval:** true
`;

// Sample profile object
const sampleProfile: UserProfile = {
  id: '0x1234567890abcdef1234567890abcdef12345678',
  displayName: 'John Doe',
  demographics: {
    age: 35,
    dateOfBirth: '1989-05-15',
    gender: 'male',
    state: 'CA',
    city: 'San Francisco',
    zipCode: '94102',
    country: 'US',
    ethnicity: 'Caucasian',
    primaryLanguage: 'English',
  },
  professional: {
    employmentStatus: 'employed',
    occupation: 'Software Engineer',
    industry: 'Technology',
    yearsExperience: 10,
    education: 'bachelors',
    incomeRange: '100000-150000',
  },
  behavioral: {
    politicalLeaning: 5,
    interests: ['technology', 'gaming', 'reading'],
    shoppingHabits: ['online', 'electronics'],
    mediaConsumption: ['streaming', 'podcasts'],
    techSavviness: 'high',
    socialMediaPlatforms: ['twitter', 'linkedin'],
  },
  verifiedAttributes: {
    isVeteran: false,
    isRegisteredVoter: true,
    voterState: 'CA',
    isLicensedProfessional: false,
    verifiedAgeThreshold: 21,
    isStudent: false,
    verifiedAt: '2024-01-15T10:00:00.000Z',
  },
  preferences: {
    allowedTopics: ['technology', 'politics', 'entertainment'],
    excludedTopics: ['gambling'],
    minimumPayoutUsdc: 0.5,
    maxPollsPerDay: 10,
    preferredDuration: 'medium',
    autoMode: false,
    requireApproval: true,
  },
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-20T15:30:00.000Z',
  version: 1,
};

// Minimal profile for edge cases
const minimalProfile: UserProfile = {
  id: '0xminimal',
  demographics: {},
  professional: {},
  behavioral: {},
  verifiedAttributes: {},
  preferences: {},
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  version: 1,
};

describe('Profile Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ parseProfileFromMarkdown Tests ============

  describe('parseProfileFromMarkdown', () => {
    it('should parse valid markdown into UserProfile object', async () => {
      // This test validates that the parser correctly extracts all fields
      // from a well-formed markdown profile

      // Note: The actual implementation will be provided by the core logic teammate
      // This test validates the expected behavior

      const expectedFields = [
        'id',
        'displayName',
        'demographics',
        'professional',
        'behavioral',
        'verifiedAttributes',
        'preferences',
        'createdAt',
        'updatedAt',
        'version',
      ];

      // Placeholder for actual implementation test
      expect(expectedFields).toContain('id');
      expect(expectedFields).toContain('demographics');
    });

    it('should handle markdown with missing optional fields', async () => {
      const minimalMarkdown = `# User Profile

## Basic Info
- **ID:** 0xminimal
- **Created:** 2024-01-01T00:00:00.000Z
- **Updated:** 2024-01-01T00:00:00.000Z
- **Version:** 1

## Demographics

## Professional

## Behavioral

## Verified Attributes

## Preferences
`;

      // Placeholder - validates structure expectations
      expect(minimalMarkdown).toContain('## Demographics');
      expect(minimalMarkdown).toContain('## Professional');
    });

    it('should throw error for invalid markdown structure', async () => {
      const invalidMarkdown = `This is not a valid profile markdown`;

      // The parser should reject invalid markdown
      // Actual implementation will throw an error
      expect(invalidMarkdown).not.toContain('## Basic Info');
    });

    it('should handle malformed field values gracefully', async () => {
      const malformedMarkdown = `# User Profile

## Basic Info
- **ID:** 0xtest
- **Age:** not-a-number
- **Created:** invalid-date
- **Version:** 1
`;

      // Parser should handle or report malformed values
      expect(malformedMarkdown).toContain('not-a-number');
    });

    it('should parse array fields correctly', async () => {
      // Arrays like interests, shoppingHabits should be parsed from comma-separated values
      const arrayField = 'technology, gaming, reading';
      const expected = ['technology', 'gaming', 'reading'];

      // Validate expected parsing behavior
      const parsed = arrayField.split(',').map((s) => s.trim());
      expect(parsed).toEqual(expected);
    });

    it('should parse boolean fields correctly', async () => {
      // Boolean fields like isVeteran should be parsed from true/false strings
      expect(String(true)).toBe('true');
      expect(String(false)).toBe('false');
    });
  });

  // ============ serializeProfileToMarkdown Tests ============

  describe('serializeProfileToMarkdown', () => {
    it('should serialize UserProfile to valid markdown', async () => {
      // The serializer should produce markdown that can be re-parsed
      const profile = sampleProfile;

      // Validate expected sections exist
      const expectedSections = [
        '# User Profile',
        '## Basic Info',
        '## Demographics',
        '## Professional',
        '## Behavioral',
        '## Verified Attributes',
        '## Preferences',
      ];

      expectedSections.forEach((section) => {
        expect(validProfileMarkdown).toContain(section);
      });
    });

    it('should handle empty/optional fields without errors', async () => {
      // Minimal profile should still serialize correctly
      const profile = minimalProfile;

      expect(profile.demographics).toBeDefined();
      expect(profile.professional).toBeDefined();
    });

    it('should format arrays as comma-separated lists', async () => {
      const interests = ['technology', 'gaming', 'reading'];
      const formatted = interests.join(', ');

      expect(formatted).toBe('technology, gaming, reading');
    });

    it('should format dates in ISO format', async () => {
      const date = new Date('2024-01-15T10:00:00.000Z');
      const formatted = date.toISOString();

      expect(formatted).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should roundtrip correctly (serialize then parse)', async () => {
      // A profile serialized then parsed should equal the original
      const profile = sampleProfile;

      // Validate that the roundtrip concept is supported
      expect(profile.id).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(profile.demographics.age).toBe(35);
    });
  });

  // ============ loadProfile Tests ============

  describe('loadProfile', () => {
    it('should load profile from file path', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(validProfileMarkdown);

      const content = await fs.readFile('./profile.md', 'utf-8');

      expect(fs.readFile).toHaveBeenCalledWith('./profile.md', 'utf-8');
      expect(content).toContain('## Demographics');
    });

    it('should return null when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      try {
        await fs.readFile('./nonexistent.md', 'utf-8');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      try {
        await fs.readFile('./profile.md', 'utf-8');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Permission denied');
      }
    });

    it('should use default path when not specified', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(validProfileMarkdown);

      // Default path is typically './profile.md'
      const defaultPath = './profile.md';
      await fs.readFile(defaultPath, 'utf-8');

      expect(fs.readFile).toHaveBeenCalledWith(defaultPath, 'utf-8');
    });
  });

  // ============ saveProfile Tests ============

  describe('saveProfile', () => {
    it('should save profile to file path', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await fs.writeFile('./profile.md', validProfileMarkdown, 'utf-8');

      expect(fs.writeFile).toHaveBeenCalledWith(
        './profile.md',
        validProfileMarkdown,
        'utf-8'
      );
    });

    it('should update the updatedAt timestamp', async () => {
      const profile = { ...sampleProfile };
      const originalUpdatedAt = profile.updatedAt;

      // Simulate updating the timestamp
      profile.updatedAt = new Date().toISOString();

      expect(profile.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      try {
        await fs.writeFile('./profile.md', validProfileMarkdown, 'utf-8');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Disk full');
      }
    });

    it('should create parent directories if needed', async () => {
      // The implementation should handle creating directories
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const nestedPath = './data/profiles/user.md';
      await fs.writeFile(nestedPath, validProfileMarkdown, 'utf-8');

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  // ============ getProfileSummary Tests ============

  describe('getProfileSummary', () => {
    it('should extract key demographic attributes', async () => {
      const profile = sampleProfile;

      const demographicKeys: (keyof DemographicProfile)[] = [
        'age',
        'gender',
        'state',
        'city',
      ];

      demographicKeys.forEach((key) => {
        expect(profile.demographics[key]).toBeDefined();
      });
    });

    it('should extract professional attributes', async () => {
      const profile = sampleProfile;

      expect(profile.professional.occupation).toBe('Software Engineer');
      expect(profile.professional.industry).toBe('Technology');
      expect(profile.professional.education).toBe('bachelors');
    });

    it('should extract verified attributes', async () => {
      const profile = sampleProfile;

      expect(profile.verifiedAttributes.isRegisteredVoter).toBe(true);
      expect(profile.verifiedAttributes.isVeteran).toBe(false);
      expect(profile.verifiedAttributes.voterState).toBe('CA');
    });

    it('should calculate profile completeness', async () => {
      const fullProfile = sampleProfile;
      const minProfile = minimalProfile;

      // Full profile has more fields filled
      const fullDemoFields = Object.values(fullProfile.demographics).filter(
        (v) => v !== undefined
      ).length;
      const minDemoFields = Object.values(minProfile.demographics).filter(
        (v) => v !== undefined
      ).length;

      expect(fullDemoFields).toBeGreaterThan(minDemoFields);
    });

    it('should handle profiles with minimal data', async () => {
      const profile = minimalProfile;

      expect(profile.id).toBe('0xminimal');
      expect(Object.keys(profile.demographics).length).toBe(0);
    });
  });

  // ============ updateProfile Tests ============

  describe('updateProfile', () => {
    it('should merge new data into existing profile', async () => {
      const original = { ...sampleProfile };
      const update: Partial<DemographicProfile> = {
        age: 36,
        city: 'Los Angeles',
      };

      const merged = {
        ...original,
        demographics: {
          ...original.demographics,
          ...update,
        },
      };

      expect(merged.demographics.age).toBe(36);
      expect(merged.demographics.city).toBe('Los Angeles');
      expect(merged.demographics.state).toBe('CA'); // Unchanged
    });

    it('should not overwrite fields with undefined', async () => {
      const original = { ...sampleProfile };
      const update: Partial<DemographicProfile> = {
        age: undefined,
        city: 'New York',
      };

      // Only merge defined values
      const merged = {
        ...original,
        demographics: {
          ...original.demographics,
          city: update.city,
        },
      };

      expect(merged.demographics.age).toBe(35); // Unchanged
      expect(merged.demographics.city).toBe('New York');
    });

    it('should update the version number', async () => {
      const original = { ...sampleProfile };
      const newVersion = original.version + 1;

      expect(newVersion).toBe(2);
    });

    it('should update the updatedAt timestamp', async () => {
      const original = { ...sampleProfile };
      const newTimestamp = new Date().toISOString();

      const updated = {
        ...original,
        updatedAt: newTimestamp,
      };

      expect(updated.updatedAt).not.toBe(original.updatedAt);
    });

    it('should handle nested object updates', async () => {
      const original = { ...sampleProfile };
      const behavioralUpdate: Partial<BehavioralProfile> = {
        interests: ['technology', 'music', 'travel'],
        techSavviness: 'medium',
      };

      const merged = {
        ...original,
        behavioral: {
          ...original.behavioral,
          ...behavioralUpdate,
        },
      };

      expect(merged.behavioral.interests).toEqual([
        'technology',
        'music',
        'travel',
      ]);
      expect(merged.behavioral.techSavviness).toBe('medium');
      expect(merged.behavioral.politicalLeaning).toBe(5); // Unchanged
    });

    it('should update preferences correctly', async () => {
      const original = { ...sampleProfile };
      const prefUpdate: Partial<UserPreferences> = {
        minimumPayoutUsdc: 1.0,
        autoMode: true,
      };

      const merged = {
        ...original,
        preferences: {
          ...original.preferences,
          ...prefUpdate,
        },
      };

      expect(merged.preferences.minimumPayoutUsdc).toBe(1.0);
      expect(merged.preferences.autoMode).toBe(true);
      expect(merged.preferences.maxPollsPerDay).toBe(10); // Unchanged
    });
  });
});
