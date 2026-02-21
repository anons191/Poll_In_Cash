/**
 * Agent Types
 *
 * Shared type definitions for the Poll in Cash agent system.
 * Used across profile management, poll discovery, response generation,
 * attestation handling, and wallet operations.
 *
 * @module agent/types
 */

// ============ Profile Types ============

/**
 * Demographic information section of user profile
 */
export interface DemographicProfile {
  /** User's age in years */
  age?: number;
  /** Date of birth (ISO string) */
  dateOfBirth?: string;
  /** Gender identity */
  gender?: 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say';
  /** US state of residence (2-letter code) */
  state?: string;
  /** City of residence */
  city?: string;
  /** ZIP code */
  zipCode?: string;
  /** Country (defaults to US) */
  country?: string;
  /** Ethnicity (optional, for targeted polls) */
  ethnicity?: string;
  /** Primary language */
  primaryLanguage?: string;
}

/**
 * Professional/employment information
 */
export interface ProfessionalProfile {
  /** Current employment status */
  employmentStatus?: 'employed' | 'self-employed' | 'unemployed' | 'student' | 'retired';
  /** Current or most recent occupation */
  occupation?: string;
  /** Industry sector */
  industry?: string;
  /** Years of experience */
  yearsExperience?: number;
  /** Highest education level */
  education?: 'high-school' | 'some-college' | 'bachelors' | 'masters' | 'doctorate' | 'other';
  /** Annual income range */
  incomeRange?: string;
}

/**
 * Behavioral and lifestyle information
 */
export interface BehavioralProfile {
  /** Political leaning (1-10 scale, 1=very liberal, 10=very conservative) */
  politicalLeaning?: number;
  /** Primary interests/hobbies */
  interests?: string[];
  /** Shopping preferences */
  shoppingHabits?: string[];
  /** Media consumption habits */
  mediaConsumption?: string[];
  /** Technology usage level */
  techSavviness?: 'low' | 'medium' | 'high';
  /** Social media platforms used */
  socialMediaPlatforms?: string[];
}

/**
 * Opinions & Preferences - learned over time through conversations
 * This section grows organically as the user answers poll questions
 */
export interface OpinionsProfile {
  /** Food & Dining preferences */
  foodAndDining?: {
    favoriteCuisine?: string;
    favoriteRestaurant?: string;
    dietaryRestrictions?: string;
    cookingPreference?: string;
    [key: string]: string | undefined;
  };
  /** Politics & Policy stances */
  politicsAndPolicy?: {
    healthcareStance?: string;
    immigrationStance?: string;
    economyPriority?: string;
    environmentStance?: string;
    educationStance?: string;
    [key: string]: string | undefined;
  };
  /** Shopping & Brands preferences */
  shoppingAndBrands?: {
    preferredGrocery?: string;
    favoriteBrands?: string;
    shoppingStyle?: string;
    [key: string]: string | undefined;
  };
  /** Lifestyle preferences */
  lifestyle?: {
    exerciseHabits?: string;
    entertainmentPreferences?: string;
    musicPreferences?: string;
    travelPreferences?: string;
    [key: string]: string | undefined;
  };
  /** Catch-all for learned opinions that don't fit categories */
  other?: Record<string, string>;
}

/**
 * Source of an answer - where the confidence comes from
 */
export type AnswerSource =
  | 'verified'       // From verified attributes (age, state, veteran status)
  | 'profile'        // From self-reported profile data
  | 'learned'        // From opinions section (previously answered)
  | 'user-confirmed' // User answered this specific question
  | 'inferred';      // Agent inferred from context (lowest confidence)

/**
 * Confidence classification for poll question answering
 */
export type AnswerConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Classification result for how to handle a poll question
 */
export interface QuestionClassification {
  /** Can the agent auto-answer this question? */
  canAutoAnswer: boolean;
  /** Confidence level if auto-answering */
  confidence: AnswerConfidenceLevel;
  /** Source of the answer */
  source: AnswerSource;
  /** The answer value if auto-answering */
  answer?: string | number | string[];
  /** Reason for classification (for debugging) */
  reason: string;
}

/**
 * Question types that are typically factual vs opinion-based
 */
export type QuestionNature = 'factual' | 'opinion' | 'preference' | 'experience';

/**
 * Learned opinion entry - stored when user manually answers
 */
export interface LearnedOpinion {
  /** The topic/category of the opinion */
  topic: string;
  /** The user's stance or preference */
  stance: string;
  /** When this was learned */
  learnedAt: string;
  /** Original question that led to this learning */
  sourceQuestion?: string;
  /** Confidence in this opinion (may decay over time) */
  confidence: AnswerConfidenceLevel;
}

/**
 * Individual verification record with metadata
 */
export interface VerificationRecord {
  /** Whether this attribute is verified */
  verified: boolean;
  /** Confidence level of verification */
  confidence: 'high' | 'medium' | 'low';
  /** Document type used for verification */
  documentType: string;
  /** When this was verified */
  verifiedAt: string;
  /** When this verification expires (if applicable) */
  expiresAt?: string;
}

/**
 * Shopping behavior verification
 */
export interface ShoppingVerification extends VerificationRecord {
  storeName: string;
  lastPurchaseDate?: string;
  membershipLevel?: string;
  memberSince?: string;
}

/**
 * Residency verification
 */
export interface ResidencyVerification extends VerificationRecord {
  state: string;
  city?: string;
  zipCode?: string;
  verificationMethod: 'utility-bill' | 'lease' | 'property-tax' | 'drivers-license' | 'bank-statement';
}

/**
 * Employment verification
 */
export interface EmploymentVerification extends VerificationRecord {
  employerName: string;
  jobTitle?: string;
  employmentType?: 'full-time' | 'part-time' | 'contractor';
  industry?: string;
}

/**
 * Verified attributes (proven via document scanning)
 */
export interface VerifiedAttributes {
  // ============ Identity ============
  /** Verified full name */
  verifiedName?: string;
  /** Verified date of birth (ISO string) */
  verifiedDateOfBirth?: string;
  /** Age thresholds verified (e.g., [18, 21, 25, 65]) */
  verifiedAgeThresholds?: number[];
  /** Calculated age from DOB */
  verifiedAge?: number;

  // ============ Military/Veteran ============
  /** Is a verified US military veteran */
  isVeteran?: boolean;
  /** Military branch served */
  militaryBranch?: string;
  /** Service status */
  serviceStatus?: 'active' | 'veteran' | 'retired' | 'reserve';
  /** Is VA eligible */
  isVaEligible?: boolean;
  /** Verification record */
  veteranVerification?: VerificationRecord;

  // ============ Voter Registration ============
  /** Is registered to vote */
  isRegisteredVoter?: boolean;
  /** Voter registration state */
  voterState?: string;
  /** Voter registration county */
  voterCounty?: string;
  /** Party affiliation (if disclosed) */
  partyAffiliation?: string;
  /** Verification record */
  voterVerification?: VerificationRecord;

  // ============ Professional ============
  /** Is a licensed professional */
  isLicensedProfessional?: boolean;
  /** Professional license types held */
  professionalLicenseTypes?: string[];
  /** License states */
  licenseStates?: string[];
  /** Verification records per license */
  professionalVerifications?: VerificationRecord[];

  // ============ Business Owner ============
  /** Is a verified business owner */
  isBusinessOwner?: boolean;
  /** Business types owned */
  businessTypes?: string[];
  /** Business states */
  businessStates?: string[];
  /** Verification record */
  businessVerification?: VerificationRecord;

  // ============ Education ============
  /** Is a verified current student */
  isStudent?: boolean;
  /** Education level verified */
  verifiedEducationLevel?: 'high-school' | 'undergraduate' | 'graduate' | 'doctoral';
  /** Schools attended (names only, no IDs) */
  verifiedSchools?: string[];
  /** Verification record */
  studentVerification?: VerificationRecord;

  // ============ Residency ============
  /** Verified state of residence */
  verifiedState?: string;
  /** Verified city */
  verifiedCity?: string;
  /** Verified zip code */
  verifiedZipCode?: string;
  /** Is property owner */
  isPropertyOwner?: boolean;
  /** Residency verifications (can have multiple) */
  residencyVerifications?: ResidencyVerification[];

  // ============ Employment ============
  /** Is currently employed */
  isEmployed?: boolean;
  /** Employment verifications */
  employmentVerifications?: EmploymentVerification[];
  /** Verified industries worked in */
  verifiedIndustries?: string[];

  // ============ Shopping Behavior ============
  /** Stores shopped at (verified via receipts/membership) */
  shopsAt?: string[];
  /** Store memberships held */
  storeMemberships?: string[];
  /** Shopping verifications */
  shoppingVerifications?: ShoppingVerification[];

  // ============ Financial ============
  /** Has verified bank relationship */
  hasBankAccount?: boolean;
  /** Banks used (names only) */
  verifiedBanks?: string[];
  /** Has insurance */
  hasInsurance?: boolean;
  /** Insurance types held */
  insuranceTypes?: ('health' | 'dental' | 'vision' | 'auto' | 'home' | 'life')[];
  /** Insurance verification */
  insuranceVerification?: VerificationRecord;

  // ============ Metadata ============
  /** Last verification timestamp */
  lastVerifiedAt?: string;
  /** Total documents verified */
  documentsVerified?: number;
  /** Overall verification score (0-100) */
  verificationScore?: number;

  // ============ Agent Wallet (Internal) ============
  /**
   * The agent's Agentic Wallet address (auto-provisioned)
   * This is managed by the agent, not provided by the user.
   * Users never need to see or interact with this address.
   */
  agentWalletAddress?: string;
}

/**
 * User preferences for poll participation
 */
export interface UserPreferences {
  /** Topics the user is willing to answer about */
  allowedTopics?: string[];
  /** Topics the user wants to exclude */
  excludedTopics?: string[];
  /** Minimum payout threshold in USDC */
  minimumPayoutUsdc?: number;
  /** Maximum polls per day */
  maxPollsPerDay?: number;
  /** Preferred poll duration (short/medium/long) */
  preferredDuration?: 'short' | 'medium' | 'long';
  /** Auto-respond mode enabled */
  autoMode?: boolean;
  /** Require approval before each submission */
  requireApproval?: boolean;
}

/**
 * Complete user profile
 */
export interface UserProfile {
  /** Unique profile ID (usually wallet address) */
  id: string;
  /** Display name */
  displayName?: string;
  /** Demographic information */
  demographics: DemographicProfile;
  /** Professional information */
  professional: ProfessionalProfile;
  /** Behavioral/lifestyle information */
  behavioral: BehavioralProfile;
  /** Opinions & preferences learned through conversation */
  opinions: OpinionsProfile;
  /** Verified attributes from documents */
  verifiedAttributes: VerifiedAttributes;
  /** User preferences */
  preferences: UserPreferences;
  /** Profile creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Profile version for migrations */
  version: number;
}

// ============ Poll Types ============

/**
 * Poll question from the API
 */
export interface PollQuestion {
  /** Question ID */
  id: string;
  /** Question text */
  text: string;
  /** Question type */
  type: 'multiple-choice' | 'rating' | 'open-ended' | 'yes-no' | 'ranking';
  /** Available options for multiple choice */
  options?: string[];
  /** Whether answer is required */
  required: boolean;
  /** Min/max for rating questions */
  min?: number;
  max?: number;
}

/**
 * Poll criteria for targeting
 */
export interface PollCriteria {
  /** Minimum age requirement */
  minAge?: number;
  /** Maximum age requirement */
  maxAge?: number;
  /** Required states */
  states?: string[];
  /** Requires veteran status */
  isVeteran?: boolean;
  /** Requires voter registration */
  isRegisteredVoter?: boolean;
  /** Required occupations */
  occupations?: string[];
  /** Required industries */
  industries?: string[];
  /** Required education level */
  education?: string[];
}

/**
 * Poll discovered from the API
 */
export interface DiscoveredPoll {
  /** Poll ID */
  id: string;
  /** Poll title */
  title: string;
  /** Poll description */
  description?: string;
  /** Total USDC in the pool */
  cashPoolUsdc: string;
  /** Maximum participants */
  participantCap: number;
  /** Current response count */
  responseCount: number;
  /** Spots remaining */
  spotsRemaining: number;
  /** Estimated payout per person */
  payoutEstimate: string;
  /** Whether user is eligible */
  eligible: boolean;
  /** Reasons if ineligible */
  ineligibleReasons: string[];
  /** Targeting criteria */
  criteria: PollCriteria;
  /** Questions in the poll */
  questions?: PollQuestion[];
  /** Expiration timestamp */
  expiresAt?: string;
}

/**
 * Poll match result from matching endpoint
 */
export interface PollMatch {
  /** Poll ID */
  pollId: string;
  /** Poll title */
  title: string;
  /** Whether user is eligible */
  eligible: boolean;
  /** Already responded to this poll */
  alreadyResponded: boolean;
  /** Spots remaining */
  spotsRemaining: number;
  /** Estimated payout */
  payoutEstimate: string;
  /** Reasons if ineligible */
  ineligibleReasons: string[];
  /** Match confidence score (0-1) */
  matchConfidence: number;
  /** Topics covered by this poll */
  topics: string[];
}

// ============ Response Types ============

/**
 * Confidence level for an answer
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Single question response
 */
export interface QuestionResponse {
  /** Question ID */
  questionId: string;
  /** The answer value */
  answer: string | number | string[];
  /** Confidence in this answer */
  confidence: ConfidenceLevel;
  /** Source of this answer (verified, learned, user-confirmed, etc.) */
  source: AnswerSource;
  /** Reasoning for the answer (internal use) */
  reasoning?: string;
}

/**
 * Complete agent response to a poll
 */
export interface AgentResponse {
  /** Poll ID */
  pollId: string;
  /** All question responses */
  responses: QuestionResponse[];
  /** Overall confidence scores */
  confidenceScores: Record<string, ConfidenceLevel>;
  /** Attestation hash */
  attestationHash: string;
  /** Timestamp of response generation */
  generatedAt: string;
}

/**
 * Response submission result
 */
export interface SubmissionResult {
  /** Response ID from backend */
  id: string;
  /** Poll ID */
  pollId: string;
  /** Submission timestamp */
  submittedAt: string;
  /** Estimated payout */
  payoutEstimate: string;
  /** Participant number */
  participantNumber: number;
  /** Success message */
  message: string;
}

// ============ Attestation Types ============

/**
 * Document types that can be scanned
 */
export type DocumentType =
  // Government IDs
  | 'drivers-license'
  | 'passport'
  | 'state-id'
  // Military/Veteran
  | 'military-id'
  | 'va-card'
  | 'dd214'
  // Civic
  | 'voter-registration'
  // Professional
  | 'professional-license'
  | 'business-license'
  // Education
  | 'student-id'
  | 'diploma'
  | 'transcript'
  // Financial/Shopping
  | 'store-receipt'
  | 'store-membership'
  | 'bank-statement'
  | 'pay-stub'
  // Residency
  | 'utility-bill'
  | 'lease-agreement'
  | 'property-tax-bill'
  // Insurance
  | 'insurance-card'
  | 'insurance-statement'
  // Other
  | 'other';

/**
 * Confidence level for extracted data
 */
export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'uncertain';

/**
 * Base extracted data with confidence
 */
export interface ExtractedField<T> {
  value: T;
  confidence: ExtractionConfidence;
  rawText?: string; // Original text from document (for debugging, never sent to platform)
}

// ============ Extracted Data Per Document Type ============

/**
 * Data extracted from driver's license
 */
export interface DriversLicenseData {
  fullName?: ExtractedField<string>;
  dateOfBirth?: ExtractedField<string>; // ISO date string
  state?: ExtractedField<string>; // 2-letter code
  address?: ExtractedField<string>;
  city?: ExtractedField<string>;
  zipCode?: ExtractedField<string>;
  licenseNumber?: ExtractedField<string>;
  expirationDate?: ExtractedField<string>;
  issueDate?: ExtractedField<string>;
  licenseClass?: ExtractedField<string>;
  restrictions?: ExtractedField<string[]>;
  endorsements?: ExtractedField<string[]>;
}

/**
 * Data extracted from passport
 */
export interface PassportData {
  fullName?: ExtractedField<string>;
  dateOfBirth?: ExtractedField<string>;
  nationality?: ExtractedField<string>;
  passportNumber?: ExtractedField<string>;
  expirationDate?: ExtractedField<string>;
  issueDate?: ExtractedField<string>;
  placeOfBirth?: ExtractedField<string>;
  gender?: ExtractedField<string>;
}

/**
 * Data extracted from military ID / VA card / DD214
 */
export interface MilitaryData {
  fullName?: ExtractedField<string>;
  branch?: ExtractedField<string>; // Army, Navy, Air Force, Marines, Coast Guard, Space Force
  rank?: ExtractedField<string>;
  serviceStatus?: ExtractedField<'active' | 'veteran' | 'retired' | 'reserve'>;
  serviceStartDate?: ExtractedField<string>;
  serviceEndDate?: ExtractedField<string>;
  dischargeType?: ExtractedField<string>; // Honorable, General, etc.
  veteranStatus?: ExtractedField<boolean>;
  vaEligibility?: ExtractedField<boolean>;
}

/**
 * Data extracted from voter registration
 */
export interface VoterRegistrationData {
  fullName?: ExtractedField<string>;
  registeredState?: ExtractedField<string>;
  county?: ExtractedField<string>;
  registrationDate?: ExtractedField<string>;
  partyAffiliation?: ExtractedField<string>;
  voterStatus?: ExtractedField<'active' | 'inactive' | 'pending'>;
  precinct?: ExtractedField<string>;
}

/**
 * Data extracted from professional license
 */
export interface ProfessionalLicenseData {
  fullName?: ExtractedField<string>;
  licenseType?: ExtractedField<string>; // Medical, Legal, CPA, Real Estate, etc.
  licenseNumber?: ExtractedField<string>;
  issuingAuthority?: ExtractedField<string>;
  state?: ExtractedField<string>;
  issueDate?: ExtractedField<string>;
  expirationDate?: ExtractedField<string>;
  status?: ExtractedField<'active' | 'inactive' | 'suspended' | 'expired'>;
  specializations?: ExtractedField<string[]>;
}

/**
 * Data extracted from business license
 */
export interface BusinessLicenseData {
  businessName?: ExtractedField<string>;
  ownerName?: ExtractedField<string>;
  businessType?: ExtractedField<string>; // LLC, Corp, Sole Prop, etc.
  state?: ExtractedField<string>;
  licenseNumber?: ExtractedField<string>;
  issueDate?: ExtractedField<string>;
  expirationDate?: ExtractedField<string>;
  status?: ExtractedField<'active' | 'inactive' | 'suspended'>;
  industry?: ExtractedField<string>;
}

/**
 * Data extracted from student ID
 */
export interface StudentIdData {
  fullName?: ExtractedField<string>;
  schoolName?: ExtractedField<string>;
  studentId?: ExtractedField<string>;
  enrollmentStatus?: ExtractedField<'full-time' | 'part-time' | 'graduated'>;
  expectedGraduation?: ExtractedField<string>;
  major?: ExtractedField<string>;
  level?: ExtractedField<'undergraduate' | 'graduate' | 'doctoral' | 'other'>;
}

/**
 * Data extracted from store receipt
 */
export interface StoreReceiptData {
  storeName?: ExtractedField<string>;
  storeLocation?: ExtractedField<string>;
  purchaseDate?: ExtractedField<string>;
  totalAmount?: ExtractedField<number>;
  currency?: ExtractedField<string>;
  itemCategories?: ExtractedField<string[]>; // groceries, electronics, clothing, etc.
  itemCount?: ExtractedField<number>;
  paymentMethod?: ExtractedField<string>;
  membershipUsed?: ExtractedField<boolean>;
}

/**
 * Data extracted from store membership card
 */
export interface StoreMembershipData {
  storeName?: ExtractedField<string>;
  memberName?: ExtractedField<string>;
  membershipLevel?: ExtractedField<string>; // Gold, Executive, Plus, etc.
  memberSince?: ExtractedField<string>;
  membershipNumber?: ExtractedField<string>;
  expirationDate?: ExtractedField<string>;
}

/**
 * Data extracted from utility bill
 */
export interface UtilityBillData {
  providerName?: ExtractedField<string>;
  accountHolderName?: ExtractedField<string>;
  serviceAddress?: ExtractedField<string>;
  city?: ExtractedField<string>;
  state?: ExtractedField<string>;
  zipCode?: ExtractedField<string>;
  billDate?: ExtractedField<string>;
  utilityType?: ExtractedField<'electric' | 'gas' | 'water' | 'internet' | 'phone' | 'other'>;
}

/**
 * Data extracted from bank statement
 */
export interface BankStatementData {
  bankName?: ExtractedField<string>;
  accountHolderName?: ExtractedField<string>;
  statementDate?: ExtractedField<string>;
  accountType?: ExtractedField<'checking' | 'savings' | 'investment' | 'other'>;
  // Note: NEVER extract account numbers or balances
}

/**
 * Data extracted from pay stub
 */
export interface PayStubData {
  employerName?: ExtractedField<string>;
  employeeName?: ExtractedField<string>;
  payPeriodStart?: ExtractedField<string>;
  payPeriodEnd?: ExtractedField<string>;
  payDate?: ExtractedField<string>;
  employmentType?: ExtractedField<'full-time' | 'part-time' | 'contractor'>;
  jobTitle?: ExtractedField<string>;
  // Note: NEVER extract actual salary amounts
}

/**
 * Data extracted from property tax bill
 */
export interface PropertyTaxBillData {
  ownerName?: ExtractedField<string>;
  propertyAddress?: ExtractedField<string>;
  city?: ExtractedField<string>;
  state?: ExtractedField<string>;
  zipCode?: ExtractedField<string>;
  assessmentYear?: ExtractedField<string>;
  propertyType?: ExtractedField<'residential' | 'commercial' | 'land' | 'other'>;
}

/**
 * Data extracted from insurance card
 */
export interface InsuranceCardData {
  providerName?: ExtractedField<string>;
  memberName?: ExtractedField<string>;
  planType?: ExtractedField<string>; // PPO, HMO, etc.
  coverageType?: ExtractedField<'health' | 'dental' | 'vision' | 'auto' | 'home' | 'life' | 'other'>;
  groupNumber?: ExtractedField<string>;
  effectiveDate?: ExtractedField<string>;
  // Note: NEVER extract member ID numbers for health insurance (HIPAA)
}

/**
 * Union type of all extracted document data
 */
export type ExtractedDocumentData =
  | { type: 'drivers-license' | 'state-id'; data: DriversLicenseData }
  | { type: 'passport'; data: PassportData }
  | { type: 'military-id' | 'va-card' | 'dd214'; data: MilitaryData }
  | { type: 'voter-registration'; data: VoterRegistrationData }
  | { type: 'professional-license'; data: ProfessionalLicenseData }
  | { type: 'business-license'; data: BusinessLicenseData }
  | { type: 'student-id' | 'diploma' | 'transcript'; data: StudentIdData }
  | { type: 'store-receipt'; data: StoreReceiptData }
  | { type: 'store-membership'; data: StoreMembershipData }
  | { type: 'utility-bill' | 'lease-agreement'; data: UtilityBillData }
  | { type: 'bank-statement'; data: BankStatementData }
  | { type: 'pay-stub'; data: PayStubData }
  | { type: 'property-tax-bill'; data: PropertyTaxBillData }
  | { type: 'insurance-card' | 'insurance-statement'; data: InsuranceCardData }
  | { type: 'other'; data: Record<string, ExtractedField<unknown>> };

/**
 * Verification result from AI document analysis
 */
export interface VerificationResult {
  /** Whether the document appears valid */
  isValid: boolean;
  /** Overall confidence in the verification */
  confidence: ExtractionConfidence;
  /** Document type detected */
  documentType: DocumentType;
  /** Extracted data from the document */
  extractedData: ExtractedDocumentData;
  /** Issues found during verification */
  issues: string[];
  /** Warnings (non-blocking) */
  warnings: string[];
  /** Verification timestamp */
  verifiedAt: string;
  /** Hash of the document image */
  documentHash: string;
}

/**
 * Scanned document result (enhanced)
 */
export interface ScannedDocument {
  /** Document type */
  type: DocumentType;
  /** Full verification result */
  verification: VerificationResult;
  /** Derived verified attributes (for poll matching) */
  derivedAttributes: Partial<VerifiedAttributes>;
  /** Scan timestamp */
  scannedAt: string;
  /** Document expiration if applicable */
  expiresAt?: string;
  /** Hash of the document for deduplication */
  documentHash: string;
}

/**
 * Attestation object (signed proof of attributes)
 */
export interface Attestation {
  /** Attestation ID */
  id: string;
  /** Poll ID this attestation is for */
  pollId: string;
  /** User's wallet address */
  userAddress: string;
  /** Contract address for verification */
  contractAddress: string;
  /** Attested attributes (only boolean flags and simple values) */
  attributes: Partial<VerifiedAttributes>;
  /** Signature from the attestation signer */
  signature: string;
  /** Timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt: string;
}

// ============ Wallet Types ============

/**
 * Wallet balance information
 */
export interface WalletBalance {
  /** Wallet address */
  address: string;
  /** ETH balance (for gas) */
  ethBalance: string;
  /** USDC balance */
  usdcBalance: string;
  /** Network */
  network: string;
}

/**
 * Payout record
 */
export interface Payout {
  /** Payout ID */
  id: string;
  /** Poll ID */
  pollId: string;
  /** Poll title */
  pollTitle: string;
  /** Amount in USDC */
  amountUsdc: string;
  /** Payout status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Transaction hash if confirmed */
  txHash?: string;
  /** Distribution timestamp */
  distributedAt?: string;
}

/**
 * Earnings summary
 */
export interface EarningsSummary {
  /** Total earned in USDC */
  totalEarned: string;
  /** Number of confirmed payouts */
  confirmedPayouts: number;
  /** Number of pending payouts */
  pendingPayouts: number;
  /** Total polls completed */
  pollsCompleted: number;
  /** Reliability score (0-1) */
  reliabilityScore: string;
  /** Recent payout history */
  recentPayouts: Payout[];
}

// ============ Withdrawal Types ============

/**
 * Withdrawal destination types
 */
export type WithdrawalDestination = 'wallet' | 'cashapp' | 'venmo' | 'bank';

/**
 * Withdrawal status
 */
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Withdrawal request parameters
 */
export interface WithdrawalRequest {
  /** Amount in USDC to withdraw */
  amount: string;
  /** Destination wallet address (for wallet type) or bridge address */
  destinationAddress: string;
  /** Type of destination */
  destinationType: WithdrawalDestination;
  /** Handle for non-wallet destinations (e.g., $cashtag, @venmo) */
  destinationHandle?: string;
}

/**
 * Withdrawal record
 */
export interface Withdrawal {
  /** Withdrawal ID */
  id: string;
  /** Amount in USDC */
  amount: string;
  /** Fee in USDC */
  fee: string;
  /** Destination type */
  destinationType: WithdrawalDestination;
  /** Destination address */
  destinationAddress: string;
  /** Destination handle (for non-wallet) */
  destinationHandle?: string;
  /** Current status */
  status: WithdrawalStatus;
  /** Transaction hash if completed */
  txHash?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Request timestamp */
  requestedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Explorer URL */
  explorerUrl?: string;
}

/**
 * Withdrawal result from API
 */
export interface WithdrawalResult {
  /** Success indicator */
  success: boolean;
  /** Withdrawal details */
  withdrawal: Withdrawal;
  /** Previous balance */
  previousBalance: string;
  /** New balance after withdrawal */
  newBalance: string;
  /** Explorer URL for transaction */
  explorerUrl?: string;
}

/**
 * Withdrawal history response
 */
export interface WithdrawalHistory {
  /** List of withdrawals */
  withdrawals: Withdrawal[];
}

// ============ Agent Configuration ============

/**
 * Agent runtime configuration
 */
export interface AgentConfig {
  /** Backend API base URL */
  apiBaseUrl: string;
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Minimum payout threshold in USDC */
  minimumPayoutUsdc: number;
  /** Auto mode (no user approval needed) */
  autoMode: boolean;
  /** Maximum concurrent poll responses */
  maxConcurrentResponses: number;
  /** Topics to exclude */
  excludedTopics: string[];
  /** Network (base-sepolia or base-mainnet) */
  network: 'base-sepolia' | 'base-mainnet';
  /** Path to user profile file */
  profilePath: string;
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  pollingIntervalMs: 60000, // 1 minute
  minimumPayoutUsdc: 0.01,
  autoMode: false,
  maxConcurrentResponses: 1,
  excludedTopics: [],
  network: 'base-sepolia',
  profilePath: './profile.md',
  verbose: false,
};

// ============ Agent State ============

/**
 * Agent runtime state
 */
export interface AgentState {
  /** Current user profile */
  profile: UserProfile | null;
  /** Agent's wallet address */
  walletAddress: string | null;
  /** Is agent currently running */
  isRunning: boolean;
  /** Last poll discovery timestamp */
  lastDiscoveryAt: string | null;
  /** Polls currently being processed */
  processingPolls: string[];
  /** Completed poll IDs (session) */
  completedPolls: string[];
  /** Error count for circuit breaker */
  errorCount: number;
}

/**
 * Initial agent state
 */
export const INITIAL_AGENT_STATE: AgentState = {
  profile: null,
  walletAddress: null,
  isRunning: false,
  lastDiscoveryAt: null,
  processingPolls: [],
  completedPolls: [],
  errorCount: 0,
};

// ============ Event Types ============

/**
 * Agent event types for logging and callbacks
 */
export type AgentEventType =
  | 'agent:started'
  | 'agent:stopped'
  | 'profile:loaded'
  | 'profile:updated'
  | 'polls:discovered'
  | 'poll:matched'
  | 'poll:responding'
  | 'poll:submitted'
  | 'poll:error'
  | 'wallet:balance'
  | 'earnings:updated'
  | 'error';

/**
 * Agent event payload
 */
export interface AgentEvent {
  /** Event type */
  type: AgentEventType;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Error if applicable */
  error?: Error;
}

/**
 * Agent event handler
 */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;
