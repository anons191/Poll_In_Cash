/**
 * Attestation Manager - Document Verification
 *
 * This module supports TWO MODES of document verification:
 *
 * 1. CONVERSATIONAL MODE (Primary) - No API key needed
 *    The AI agent (Claude) reads documents directly in conversation.
 *    User shares image → Agent sees it → Agent extracts fields →
 *    Agent calls processExtractedData() → Attributes stored in profile
 *
 * 2. HEADLESS/API MODE (Secondary) - Requires ANTHROPIC_API_KEY
 *    For automated scripts running without conversation context.
 *    Uses the Anthropic API to analyze document images.
 *
 * Raw documents NEVER leave the user's device.
 *
 * @module agent/attestation
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { ethers, keccak256, solidityPacked, getBytes, Wallet, type Signer } from 'ethers';
import { randomUUID } from 'crypto';
import type {
  Attestation,
  ScannedDocument,
  DocumentType,
  VerifiedAttributes,
  VerificationResult,
  ExtractedDocumentData,
  ExtractionConfidence,
  ExtractedField,
  DriversLicenseData,
  PassportData,
  MilitaryData,
  VoterRegistrationData,
  ProfessionalLicenseData,
  BusinessLicenseData,
  StudentIdData,
  StoreReceiptData,
  StoreMembershipData,
  UtilityBillData,
  BankStatementData,
  PayStubData,
  PropertyTaxBillData,
  InsuranceCardData,
  VerificationRecord,
  ShoppingVerification,
  ResidencyVerification,
  EmploymentVerification,
} from './types.js';
import { POLL_CONTRACT_ADDRESS } from './config.js';

// ============ Configuration ============

const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const SUPPORTED_PDF_EXTENSIONS = ['.pdf'];
const MAX_IMAGE_SIZE_MB = 20;

// ============ Types ============

export interface ScanResult {
  success: boolean;
  document?: ScannedDocument;
  error?: string;
  warnings?: string[];
}

/**
 * Result from processExtractedData (conversational mode)
 */
export interface ProcessedDocumentResult {
  success: boolean;
  documentType: DocumentType;
  verifiedAttributes: Partial<VerifiedAttributes>;
  verification: VerificationResult;
  warnings: string[];
  error?: string;
}

/**
 * Extracted field input for conversational mode
 * Agents provide this structure after reading a document
 */
export interface ExtractedFieldInput {
  value: string | number | boolean | string[] | null;
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
}

/**
 * Generic extracted data input for processExtractedData
 */
export type ExtractedDataInput = Record<string, ExtractedFieldInput | null | undefined>;

// ============ Extraction Field Definitions ============
// These define what fields to extract for each document type
// Exported for use in skill.md and agent prompts

/**
 * Field definitions for each document type
 * Agents use these to know what to extract from documents
 */
export const DOCUMENT_FIELD_DEFINITIONS: Record<DocumentType, {
  description: string;
  fields: { name: string; type: string; description: string; required: boolean }[];
}> = {
  'drivers-license': {
    description: "US Driver's License",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full legal name', required: true },
      { name: 'dateOfBirth', type: 'date', description: 'Date of birth (YYYY-MM-DD)', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'address', type: 'string', description: 'Street address', required: false },
      { name: 'city', type: 'string', description: 'City name', required: false },
      { name: 'zipCode', type: 'string', description: 'ZIP code', required: false },
      { name: 'expirationDate', type: 'date', description: 'Expiration date (YYYY-MM-DD)', required: true },
      { name: 'licenseClass', type: 'string', description: 'License class (A, B, C, etc.)', required: false },
    ],
  },
  'state-id': {
    description: "State-issued ID card",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full legal name', required: true },
      { name: 'dateOfBirth', type: 'date', description: 'Date of birth (YYYY-MM-DD)', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'address', type: 'string', description: 'Street address', required: false },
      { name: 'city', type: 'string', description: 'City name', required: false },
      { name: 'zipCode', type: 'string', description: 'ZIP code', required: false },
      { name: 'expirationDate', type: 'date', description: 'Expiration date (YYYY-MM-DD)', required: true },
    ],
  },
  'passport': {
    description: "Passport (US or international)",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full legal name', required: true },
      { name: 'dateOfBirth', type: 'date', description: 'Date of birth (YYYY-MM-DD)', required: true },
      { name: 'nationality', type: 'string', description: 'Country of citizenship', required: true },
      { name: 'expirationDate', type: 'date', description: 'Expiration date (YYYY-MM-DD)', required: true },
      { name: 'placeOfBirth', type: 'string', description: 'Place of birth', required: false },
      { name: 'gender', type: 'string', description: 'M or F', required: false },
    ],
  },
  'military-id': {
    description: "Active Military ID (CAC)",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full name', required: true },
      { name: 'branch', type: 'string', description: 'Military branch (Army, Navy, Air Force, Marines, Coast Guard, Space Force)', required: true },
      { name: 'rank', type: 'string', description: 'Military rank', required: false },
      { name: 'serviceStatus', type: 'string', description: 'active, veteran, retired, or reserve', required: true },
      { name: 'expirationDate', type: 'date', description: 'Card expiration date', required: false },
    ],
  },
  'va-card': {
    description: "VA Health ID Card",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full name', required: true },
      { name: 'veteranStatus', type: 'boolean', description: 'Is a veteran (true)', required: true },
      { name: 'branch', type: 'string', description: 'Military branch served', required: false },
      { name: 'vaEligibility', type: 'boolean', description: 'Eligible for VA benefits', required: false },
    ],
  },
  'dd214': {
    description: "DD-214 Discharge Papers",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full name', required: true },
      { name: 'branch', type: 'string', description: 'Military branch', required: true },
      { name: 'serviceStartDate', type: 'date', description: 'Service start date', required: false },
      { name: 'serviceEndDate', type: 'date', description: 'Service end date', required: false },
      { name: 'dischargeType', type: 'string', description: 'Honorable, General, etc.', required: true },
      { name: 'rank', type: 'string', description: 'Final rank', required: false },
    ],
  },
  'voter-registration': {
    description: "Voter Registration Card",
    fields: [
      { name: 'fullName', type: 'string', description: 'Full name', required: true },
      { name: 'registeredState', type: 'string', description: '2-letter state code', required: true },
      { name: 'county', type: 'string', description: 'County name', required: false },
      { name: 'partyAffiliation', type: 'string', description: 'Democrat, Republican, Independent, etc.', required: false },
      { name: 'voterStatus', type: 'string', description: 'active, inactive, or pending', required: false },
    ],
  },
  'professional-license': {
    description: "Professional License (Medical, Legal, CPA, etc.)",
    fields: [
      { name: 'fullName', type: 'string', description: 'License holder name', required: true },
      { name: 'licenseType', type: 'string', description: 'Type of license (Medical, Legal, CPA, etc.)', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'status', type: 'string', description: 'active, inactive, suspended, or expired', required: true },
      { name: 'expirationDate', type: 'date', description: 'Expiration date', required: false },
      { name: 'issuingAuthority', type: 'string', description: 'Issuing board/authority', required: false },
    ],
  },
  'business-license': {
    description: "Business License",
    fields: [
      { name: 'businessName', type: 'string', description: 'Business name', required: true },
      { name: 'ownerName', type: 'string', description: 'Owner/registrant name', required: true },
      { name: 'businessType', type: 'string', description: 'Type of business', required: false },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'status', type: 'string', description: 'active, inactive, or suspended', required: true },
      { name: 'expirationDate', type: 'date', description: 'Expiration date', required: false },
    ],
  },
  'student-id': {
    description: "Student ID Card",
    fields: [
      { name: 'fullName', type: 'string', description: 'Student name', required: true },
      { name: 'schoolName', type: 'string', description: 'School/university name', required: true },
      { name: 'enrollmentStatus', type: 'string', description: 'full-time, part-time, or graduated', required: false },
      { name: 'level', type: 'string', description: 'undergraduate, graduate, doctoral, or other', required: false },
      { name: 'expectedGraduation', type: 'string', description: 'Expected graduation year', required: false },
    ],
  },
  'diploma': {
    description: "Diploma or Degree Certificate",
    fields: [
      { name: 'fullName', type: 'string', description: 'Graduate name', required: true },
      { name: 'schoolName', type: 'string', description: 'School/university name', required: true },
      { name: 'level', type: 'string', description: 'high-school, bachelors, masters, doctoral, etc.', required: true },
      { name: 'major', type: 'string', description: 'Field of study', required: false },
      { name: 'graduationDate', type: 'date', description: 'Graduation date', required: false },
    ],
  },
  'transcript': {
    description: "Academic Transcript",
    fields: [
      { name: 'fullName', type: 'string', description: 'Student name', required: true },
      { name: 'schoolName', type: 'string', description: 'School/university name', required: true },
      { name: 'enrollmentStatus', type: 'string', description: 'full-time, part-time, or graduated', required: false },
      { name: 'level', type: 'string', description: 'undergraduate, graduate, doctoral, or other', required: false },
    ],
  },
  'store-receipt': {
    description: "Store Receipt",
    fields: [
      { name: 'storeName', type: 'string', description: 'Store name (Costco, Walmart, etc.)', required: true },
      { name: 'storeLocation', type: 'string', description: 'Store city/state', required: false },
      { name: 'purchaseDate', type: 'date', description: 'Purchase date (YYYY-MM-DD)', required: true },
      { name: 'membershipUsed', type: 'boolean', description: 'Was a membership used', required: false },
    ],
  },
  'store-membership': {
    description: "Store Membership Card",
    fields: [
      { name: 'storeName', type: 'string', description: 'Store name (Costco, Amazon Prime, etc.)', required: true },
      { name: 'memberName', type: 'string', description: 'Member name', required: true },
      { name: 'membershipLevel', type: 'string', description: 'Membership tier (Executive, Plus, Prime, etc.)', required: false },
      { name: 'memberSince', type: 'string', description: 'Member since date or year', required: false },
      { name: 'expirationDate', type: 'date', description: 'Expiration date', required: false },
    ],
  },
  'utility-bill': {
    description: "Utility Bill",
    fields: [
      { name: 'providerName', type: 'string', description: 'Utility company name', required: true },
      { name: 'accountHolderName', type: 'string', description: 'Account holder name', required: true },
      { name: 'serviceAddress', type: 'string', description: 'Service address', required: false },
      { name: 'city', type: 'string', description: 'City', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'zipCode', type: 'string', description: 'ZIP code', required: false },
      { name: 'billDate', type: 'date', description: 'Bill date', required: true },
      { name: 'utilityType', type: 'string', description: 'electric, gas, water, internet, phone, or other', required: false },
    ],
  },
  'lease-agreement': {
    description: "Lease Agreement",
    fields: [
      { name: 'tenantName', type: 'string', description: 'Tenant name', required: true },
      { name: 'propertyAddress', type: 'string', description: 'Property address', required: false },
      { name: 'city', type: 'string', description: 'City', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'zipCode', type: 'string', description: 'ZIP code', required: false },
      { name: 'leaseStartDate', type: 'date', description: 'Lease start date', required: false },
      { name: 'leaseEndDate', type: 'date', description: 'Lease end date', required: false },
    ],
  },
  'bank-statement': {
    description: "Bank Statement (header only)",
    fields: [
      { name: 'bankName', type: 'string', description: 'Bank name', required: true },
      { name: 'accountHolderName', type: 'string', description: 'Account holder name', required: true },
      { name: 'statementDate', type: 'date', description: 'Statement date', required: true },
      { name: 'accountType', type: 'string', description: 'checking, savings, investment, or other', required: false },
    ],
  },
  'pay-stub': {
    description: "Pay Stub",
    fields: [
      { name: 'employerName', type: 'string', description: 'Employer name', required: true },
      { name: 'employeeName', type: 'string', description: 'Employee name', required: true },
      { name: 'payDate', type: 'date', description: 'Pay date', required: true },
      { name: 'jobTitle', type: 'string', description: 'Job title', required: false },
      { name: 'employmentType', type: 'string', description: 'full-time, part-time, or contractor', required: false },
    ],
  },
  'property-tax-bill': {
    description: "Property Tax Bill",
    fields: [
      { name: 'ownerName', type: 'string', description: 'Property owner name', required: true },
      { name: 'propertyAddress', type: 'string', description: 'Property address', required: false },
      { name: 'city', type: 'string', description: 'City', required: true },
      { name: 'state', type: 'string', description: '2-letter state code', required: true },
      { name: 'zipCode', type: 'string', description: 'ZIP code', required: false },
      { name: 'propertyType', type: 'string', description: 'residential, commercial, land, or other', required: false },
      { name: 'assessmentYear', type: 'string', description: 'Tax year', required: false },
    ],
  },
  'insurance-card': {
    description: "Insurance Card",
    fields: [
      { name: 'providerName', type: 'string', description: 'Insurance company name', required: true },
      { name: 'memberName', type: 'string', description: 'Member name', required: true },
      { name: 'coverageType', type: 'string', description: 'health, dental, vision, auto, home, life, or other', required: true },
      { name: 'planType', type: 'string', description: 'Plan name/type', required: false },
      { name: 'effectiveDate', type: 'date', description: 'Coverage effective date', required: false },
    ],
  },
  'insurance-statement': {
    description: "Insurance Statement",
    fields: [
      { name: 'providerName', type: 'string', description: 'Insurance company name', required: true },
      { name: 'memberName', type: 'string', description: 'Member name', required: true },
      { name: 'coverageType', type: 'string', description: 'health, dental, vision, auto, home, life, or other', required: true },
      { name: 'statementDate', type: 'date', description: 'Statement date', required: false },
    ],
  },
  'other': {
    description: "Other document type",
    fields: [
      { name: 'documentDescription', type: 'string', description: 'Description of the document', required: true },
    ],
  },
};

// ============ Conversational Mode Functions ============
// These functions are for when the agent reads the document directly in conversation

/**
 * Process extracted document data (CONVERSATIONAL MODE)
 *
 * This is the PRIMARY function for document verification.
 * Use this when the agent can see the document directly in conversation.
 *
 * The agent:
 * 1. Sees the document image shared by the user
 * 2. Extracts fields based on DOCUMENT_FIELD_DEFINITIONS
 * 3. Calls this function with the extracted data
 * 4. Receives verified attributes to store in the profile
 *
 * @param documentType - Type of document being verified
 * @param extractedData - Fields extracted by the agent from the document
 * @param documentHash - Optional hash for deduplication (agent can provide sha256 of image)
 * @returns ProcessedDocumentResult with verified attributes
 *
 * @example
 * // Agent extracts fields from a driver's license image in conversation
 * const result = processExtractedData('drivers-license', {
 *   fullName: { value: 'John Smith', confidence: 'high' },
 *   dateOfBirth: { value: '1990-05-15', confidence: 'high' },
 *   state: { value: 'NV', confidence: 'high' },
 *   city: { value: 'Las Vegas', confidence: 'high' },
 *   expirationDate: { value: '2028-05-15', confidence: 'high' },
 * });
 *
 * if (result.success) {
 *   // result.verifiedAttributes contains: verifiedName, verifiedAge, verifiedState, etc.
 *   // Merge into user's profile
 * }
 */
export function processExtractedData(
  documentType: DocumentType,
  extractedData: ExtractedDataInput,
  documentHash?: string
): ProcessedDocumentResult {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // Validate document type
  if (!DOCUMENT_FIELD_DEFINITIONS[documentType]) {
    return {
      success: false,
      documentType,
      verifiedAttributes: {},
      verification: {
        isValid: false,
        confidence: 'uncertain',
        documentType,
        extractedData: { type: 'other', data: {} },
        issues: [`Unknown document type: ${documentType}`],
        warnings: [],
        verifiedAt: now,
        documentHash: documentHash || '',
      },
      warnings: [],
      error: `Unknown document type: ${documentType}`,
    };
  }

  // Check for required fields
  const fieldDefs = DOCUMENT_FIELD_DEFINITIONS[documentType];
  const missingRequired: string[] = [];

  for (const field of fieldDefs.fields) {
    if (field.required) {
      const fieldData = extractedData[field.name];
      if (!fieldData || fieldData.value === null || fieldData.value === undefined) {
        missingRequired.push(field.name);
      }
    }
  }

  if (missingRequired.length > 0) {
    warnings.push(`Missing required fields: ${missingRequired.join(', ')}`);
  }

  // Calculate overall confidence
  const confidences = Object.values(extractedData)
    .filter((f): f is ExtractedFieldInput => f !== null && f !== undefined)
    .map((f) => f.confidence);

  const overallConfidence = calculateOverallConfidence(confidences);

  // Build typed extracted data
  const typedData = buildExtractedData(documentType, extractedData as Record<string, { value: unknown; confidence: string }>);

  // Build verification result
  const verification: VerificationResult = {
    isValid: missingRequired.length === 0 || overallConfidence !== 'uncertain',
    confidence: overallConfidence,
    documentType,
    extractedData: typedData,
    issues: missingRequired.length > 0 ? [`Missing required fields: ${missingRequired.join(', ')}`] : [],
    warnings,
    verifiedAt: now,
    documentHash: documentHash || createHash('sha256').update(JSON.stringify(extractedData) + now).digest('hex'),
  };

  // Derive verified attributes
  const verifiedAttributes = deriveVerifiedAttributes(documentType, verification);

  return {
    success: true,
    documentType,
    verifiedAttributes,
    verification,
    warnings,
  };
}

/**
 * Get extraction checklist for a document type
 *
 * Returns a human-readable checklist that agents can use
 * when extracting fields from a document image.
 *
 * @example
 * const checklist = getExtractionChecklist('drivers-license');
 * // Returns formatted checklist for agent to follow
 */
export function getExtractionChecklist(documentType: DocumentType): string {
  const def = DOCUMENT_FIELD_DEFINITIONS[documentType];
  if (!def) {
    return `Unknown document type: ${documentType}`;
  }

  const lines = [
    `## ${def.description} - Extraction Checklist`,
    '',
    'Extract the following fields from the document:',
    '',
  ];

  for (const field of def.fields) {
    const required = field.required ? '(REQUIRED)' : '(optional)';
    lines.push(`- **${field.name}** ${required}: ${field.description} [${field.type}]`);
  }

  lines.push('');
  lines.push('For each field, assess confidence:');
  lines.push('- **high**: Clearly visible and readable');
  lines.push('- **medium**: Partially visible or some uncertainty');
  lines.push('- **low**: Barely visible, best guess');
  lines.push('- **uncertain**: Cannot reliably extract');

  return lines.join('\n');
}

/**
 * Get all extraction checklists (for skill.md)
 */
export function getAllExtractionChecklists(): string {
  const lines: string[] = [];

  for (const [docType, def] of Object.entries(DOCUMENT_FIELD_DEFINITIONS)) {
    if (docType === 'other') continue;

    lines.push(`### ${def.description} (\`${docType}\`)`);
    lines.push('');
    lines.push('| Field | Type | Required | Description |');
    lines.push('|-------|------|----------|-------------|');

    for (const field of def.fields) {
      const req = field.required ? 'Yes' : 'No';
      lines.push(`| \`${field.name}\` | ${field.type} | ${req} | ${field.description} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// Helper to calculate overall confidence
function calculateOverallConfidence(confidences: ExtractionConfidence[]): ExtractionConfidence {
  if (confidences.length === 0) return 'uncertain';

  const weights: Record<ExtractionConfidence, number> = {
    high: 4,
    medium: 3,
    low: 2,
    uncertain: 1,
  };

  const avgWeight = confidences.reduce((sum, c) => sum + weights[c], 0) / confidences.length;

  if (avgWeight >= 3.5) return 'high';
  if (avgWeight >= 2.5) return 'medium';
  if (avgWeight >= 1.5) return 'low';
  return 'uncertain';
}

// ============ Extraction Prompts ============

/**
 * Get the extraction prompt for a specific document type
 */
function getExtractionPrompt(documentType: DocumentType): string {
  const baseInstructions = `You are a document verification assistant. Analyze this document image and extract the requested information.

IMPORTANT RULES:
1. Only extract information that is CLEARLY VISIBLE in the document
2. If a field is not visible or unclear, mark it as null
3. For each field, provide a confidence level: "high" (clearly visible), "medium" (partially visible/some uncertainty), "low" (barely visible), "uncertain" (guessing)
4. NEVER fabricate or guess information that isn't in the document
5. If this doesn't appear to be the expected document type, indicate that in your response
6. For sensitive fields (SSN, full account numbers), extract ONLY the last 4 digits or mark as "REDACTED"

Respond with a JSON object. Do not include any text outside the JSON.`;

  const prompts: Record<DocumentType, string> = {
    'drivers-license': `${baseInstructions}

Extract the following from this DRIVER'S LICENSE:
{
  "isValidDocument": true/false,
  "documentType": "drivers-license",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "dateOfBirth": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "address": { "value": "full street address or null", "confidence": "..." },
    "city": { "value": "string or null", "confidence": "..." },
    "zipCode": { "value": "string or null", "confidence": "..." },
    "licenseNumber": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "issueDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "licenseClass": { "value": "string or null", "confidence": "..." }
  }
}`,

    'state-id': `${baseInstructions}

Extract the following from this STATE ID:
{
  "isValidDocument": true/false,
  "documentType": "state-id",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "dateOfBirth": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "address": { "value": "full street address or null", "confidence": "..." },
    "city": { "value": "string or null", "confidence": "..." },
    "zipCode": { "value": "string or null", "confidence": "..." },
    "idNumber": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." }
  }
}`,

    'passport': `${baseInstructions}

Extract the following from this PASSPORT:
{
  "isValidDocument": true/false,
  "documentType": "passport",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "dateOfBirth": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "nationality": { "value": "country name or null", "confidence": "..." },
    "passportNumber": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "issueDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "placeOfBirth": { "value": "string or null", "confidence": "..." },
    "gender": { "value": "M/F or null", "confidence": "..." }
  }
}`,

    'military-id': `${baseInstructions}

Extract the following from this MILITARY ID:
{
  "isValidDocument": true/false,
  "documentType": "military-id",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "branch": { "value": "Army/Navy/Air Force/Marines/Coast Guard/Space Force or null", "confidence": "..." },
    "rank": { "value": "string or null", "confidence": "..." },
    "serviceStatus": { "value": "active/veteran/retired/reserve or null", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." }
  }
}`,

    'va-card': `${baseInstructions}

Extract the following from this VA CARD (Veterans Affairs):
{
  "isValidDocument": true/false,
  "documentType": "va-card",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "veteranStatus": { "value": true/false, "confidence": "..." },
    "branch": { "value": "Army/Navy/Air Force/Marines/Coast Guard/Space Force or null", "confidence": "..." },
    "vaEligibility": { "value": true/false/null, "confidence": "..." }
  }
}`,

    'dd214': `${baseInstructions}

Extract the following from this DD214 (Certificate of Release or Discharge):
{
  "isValidDocument": true/false,
  "documentType": "dd214",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "branch": { "value": "Army/Navy/Air Force/Marines/Coast Guard/Space Force or null", "confidence": "..." },
    "serviceStartDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "serviceEndDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "dischargeType": { "value": "Honorable/General/Other Than Honorable/Bad Conduct/Dishonorable or null", "confidence": "..." },
    "rank": { "value": "string or null", "confidence": "..." }
  }
}`,

    'voter-registration': `${baseInstructions}

Extract the following from this VOTER REGISTRATION document:
{
  "isValidDocument": true/false,
  "documentType": "voter-registration",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "registeredState": { "value": "2-letter state code or null", "confidence": "..." },
    "county": { "value": "string or null", "confidence": "..." },
    "registrationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "partyAffiliation": { "value": "Democrat/Republican/Independent/Libertarian/Green/Other or null", "confidence": "..." },
    "voterStatus": { "value": "active/inactive/pending or null", "confidence": "..." }
  }
}`,

    'professional-license': `${baseInstructions}

Extract the following from this PROFESSIONAL LICENSE:
{
  "isValidDocument": true/false,
  "documentType": "professional-license",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "licenseType": { "value": "Medical/Legal/CPA/Real Estate/Nursing/Engineering/Teaching/Other - specify", "confidence": "..." },
    "licenseNumber": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "issuingAuthority": { "value": "string or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "issueDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "status": { "value": "active/inactive/suspended/expired or null", "confidence": "..." }
  }
}`,

    'business-license': `${baseInstructions}

Extract the following from this BUSINESS LICENSE:
{
  "isValidDocument": true/false,
  "documentType": "business-license",
  "issues": ["list any issues found"],
  "data": {
    "businessName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "ownerName": { "value": "string or null", "confidence": "..." },
    "businessType": { "value": "LLC/Corporation/Sole Proprietorship/Partnership/Other or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "industry": { "value": "string or null", "confidence": "..." },
    "issueDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "status": { "value": "active/inactive/suspended or null", "confidence": "..." }
  }
}`,

    'student-id': `${baseInstructions}

Extract the following from this STUDENT ID:
{
  "isValidDocument": true/false,
  "documentType": "student-id",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "schoolName": { "value": "string or null", "confidence": "..." },
    "studentId": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "expectedGraduation": { "value": "YYYY or YYYY-MM or null", "confidence": "..." },
    "major": { "value": "string or null", "confidence": "..." },
    "level": { "value": "undergraduate/graduate/doctoral/other or null", "confidence": "..." }
  }
}`,

    'diploma': `${baseInstructions}

Extract the following from this DIPLOMA/DEGREE:
{
  "isValidDocument": true/false,
  "documentType": "diploma",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "schoolName": { "value": "string or null", "confidence": "..." },
    "degreeType": { "value": "High School/Associate/Bachelor/Master/Doctorate or null", "confidence": "..." },
    "major": { "value": "string or null", "confidence": "..." },
    "graduationDate": { "value": "YYYY-MM-DD or YYYY or null", "confidence": "..." }
  }
}`,

    'transcript': `${baseInstructions}

Extract the following from this ACADEMIC TRANSCRIPT:
{
  "isValidDocument": true/false,
  "documentType": "transcript",
  "issues": ["list any issues found"],
  "data": {
    "fullName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "schoolName": { "value": "string or null", "confidence": "..." },
    "enrollmentStatus": { "value": "full-time/part-time/graduated or null", "confidence": "..." },
    "level": { "value": "undergraduate/graduate/doctoral/other or null", "confidence": "..." },
    "major": { "value": "string or null", "confidence": "..." }
  }
}`,

    'store-receipt': `${baseInstructions}

Extract the following from this STORE RECEIPT:
{
  "isValidDocument": true/false,
  "documentType": "store-receipt",
  "issues": ["list any issues found"],
  "data": {
    "storeName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "storeLocation": { "value": "city, state or address or null", "confidence": "..." },
    "purchaseDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "totalAmount": { "value": number or null, "confidence": "..." },
    "currency": { "value": "USD/other or null", "confidence": "..." },
    "itemCategories": { "value": ["groceries", "electronics", etc] or null, "confidence": "..." },
    "itemCount": { "value": number or null, "confidence": "..." },
    "paymentMethod": { "value": "cash/credit/debit/other or null", "confidence": "..." },
    "membershipUsed": { "value": true/false/null, "confidence": "..." }
  }
}`,

    'store-membership': `${baseInstructions}

Extract the following from this STORE MEMBERSHIP CARD:
{
  "isValidDocument": true/false,
  "documentType": "store-membership",
  "issues": ["list any issues found"],
  "data": {
    "storeName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "memberName": { "value": "string or null", "confidence": "..." },
    "membershipLevel": { "value": "Gold/Executive/Plus/Basic/Other or null", "confidence": "..." },
    "memberSince": { "value": "YYYY or YYYY-MM or null", "confidence": "..." },
    "membershipNumber": { "value": "REDACTED or last 4 digits", "confidence": "..." },
    "expirationDate": { "value": "YYYY-MM-DD or null", "confidence": "..." }
  }
}`,

    'utility-bill': `${baseInstructions}

Extract the following from this UTILITY BILL:
{
  "isValidDocument": true/false,
  "documentType": "utility-bill",
  "issues": ["list any issues found"],
  "data": {
    "providerName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "accountHolderName": { "value": "string or null", "confidence": "..." },
    "serviceAddress": { "value": "full street address or null", "confidence": "..." },
    "city": { "value": "string or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "zipCode": { "value": "string or null", "confidence": "..." },
    "billDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "utilityType": { "value": "electric/gas/water/internet/phone/other or null", "confidence": "..." }
  }
}`,

    'lease-agreement': `${baseInstructions}

Extract the following from this LEASE AGREEMENT:
{
  "isValidDocument": true/false,
  "documentType": "lease-agreement",
  "issues": ["list any issues found"],
  "data": {
    "tenantName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "propertyAddress": { "value": "full street address or null", "confidence": "..." },
    "city": { "value": "string or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "zipCode": { "value": "string or null", "confidence": "..." },
    "leaseStartDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "leaseEndDate": { "value": "YYYY-MM-DD or null", "confidence": "..." }
  }
}`,

    'bank-statement': `${baseInstructions}

Extract ONLY the following from this BANK STATEMENT (DO NOT extract account numbers or balances):
{
  "isValidDocument": true/false,
  "documentType": "bank-statement",
  "issues": ["list any issues found"],
  "data": {
    "bankName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "accountHolderName": { "value": "string or null", "confidence": "..." },
    "statementDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "accountType": { "value": "checking/savings/investment/other or null", "confidence": "..." }
  }
}

IMPORTANT: Do NOT extract any account numbers, routing numbers, or balance amounts.`,

    'pay-stub': `${baseInstructions}

Extract ONLY the following from this PAY STUB (DO NOT extract salary amounts):
{
  "isValidDocument": true/false,
  "documentType": "pay-stub",
  "issues": ["list any issues found"],
  "data": {
    "employerName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "employeeName": { "value": "string or null", "confidence": "..." },
    "payPeriodStart": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "payPeriodEnd": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "payDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "employmentType": { "value": "full-time/part-time/contractor or null", "confidence": "..." },
    "jobTitle": { "value": "string or null", "confidence": "..." }
  }
}

IMPORTANT: Do NOT extract any salary amounts, tax information, or deduction amounts.`,

    'property-tax-bill': `${baseInstructions}

Extract the following from this PROPERTY TAX BILL:
{
  "isValidDocument": true/false,
  "documentType": "property-tax-bill",
  "issues": ["list any issues found"],
  "data": {
    "ownerName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "propertyAddress": { "value": "full street address or null", "confidence": "..." },
    "city": { "value": "string or null", "confidence": "..." },
    "state": { "value": "2-letter state code or null", "confidence": "..." },
    "zipCode": { "value": "string or null", "confidence": "..." },
    "assessmentYear": { "value": "YYYY or null", "confidence": "..." },
    "propertyType": { "value": "residential/commercial/land/other or null", "confidence": "..." }
  }
}`,

    'insurance-card': `${baseInstructions}

Extract the following from this INSURANCE CARD (DO NOT extract member ID for health insurance):
{
  "isValidDocument": true/false,
  "documentType": "insurance-card",
  "issues": ["list any issues found"],
  "data": {
    "providerName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "memberName": { "value": "string or null", "confidence": "..." },
    "planType": { "value": "PPO/HMO/EPO/POS/HDHP/Other or null", "confidence": "..." },
    "coverageType": { "value": "health/dental/vision/auto/home/life/other or null", "confidence": "..." },
    "groupNumber": { "value": "string or null (OK for non-health)", "confidence": "..." },
    "effectiveDate": { "value": "YYYY-MM-DD or null", "confidence": "..." }
  }
}

IMPORTANT: For HEALTH insurance, do NOT extract member ID numbers (HIPAA compliance).`,

    'insurance-statement': `${baseInstructions}

Extract the following from this INSURANCE STATEMENT:
{
  "isValidDocument": true/false,
  "documentType": "insurance-statement",
  "issues": ["list any issues found"],
  "data": {
    "providerName": { "value": "string or null", "confidence": "high/medium/low/uncertain" },
    "memberName": { "value": "string or null", "confidence": "..." },
    "coverageType": { "value": "health/dental/vision/auto/home/life/other or null", "confidence": "..." },
    "statementDate": { "value": "YYYY-MM-DD or null", "confidence": "..." },
    "coverageStatus": { "value": "active/inactive/pending or null", "confidence": "..." }
  }
}`,

    'other': `${baseInstructions}

This document type is unknown. Try to identify what type of document this is and extract any relevant identifying information:
{
  "isValidDocument": true/false,
  "documentType": "best guess of document type",
  "issues": ["list any issues found"],
  "data": {
    "documentDescription": { "value": "brief description of what this document appears to be", "confidence": "..." },
    "fullName": { "value": "if a name is visible, or null", "confidence": "..." },
    "date": { "value": "if a date is visible (YYYY-MM-DD), or null", "confidence": "..." },
    "issuingOrganization": { "value": "if visible, or null", "confidence": "..." }
  }
}`,
  };

  return prompts[documentType] || prompts['other'];
}

// ============ Image Handling ============

/**
 * Get the MIME type for an image file
 */
function getImageMimeType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Read and encode an image file to base64
 */
async function readImageAsBase64(filePath: string): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  // Check file exists
  const stats = await fs.stat(absolutePath);

  // Check file size
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > MAX_IMAGE_SIZE_MB) {
    throw new Error(`Image file too large: ${sizeMB.toFixed(2)}MB (max: ${MAX_IMAGE_SIZE_MB}MB)`);
  }

  // Read and encode
  const buffer = await fs.readFile(absolutePath);
  const base64 = buffer.toString('base64');
  const mimeType = getImageMimeType(filePath);

  return { base64, mimeType };
}

/**
 * Create a hash of the document file
 */
async function hashDocumentFile(filePath: string): Promise<string> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const buffer = await fs.readFile(absolutePath);
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Infer document type from file path/name
 */
function inferDocumentType(filePath: string): DocumentType {
  const lower = filePath.toLowerCase();
  const filename = path.basename(lower);

  // Check for specific document types in filename
  if (filename.includes('license') && (filename.includes('driver') || filename.includes('dl'))) {
    return 'drivers-license';
  }
  if (filename.includes('state') && filename.includes('id')) {
    return 'state-id';
  }
  if (filename.includes('passport')) {
    return 'passport';
  }
  if (filename.includes('dd214') || filename.includes('dd-214')) {
    return 'dd214';
  }
  if (filename.includes('va') && (filename.includes('card') || filename.includes('id'))) {
    return 'va-card';
  }
  if (filename.includes('military') || filename.includes('cac')) {
    return 'military-id';
  }
  if (filename.includes('voter') || filename.includes('registration')) {
    return 'voter-registration';
  }
  if (filename.includes('professional') && filename.includes('license')) {
    return 'professional-license';
  }
  if (filename.includes('business') && filename.includes('license')) {
    return 'business-license';
  }
  if (filename.includes('student') && filename.includes('id')) {
    return 'student-id';
  }
  if (filename.includes('diploma') || filename.includes('degree')) {
    return 'diploma';
  }
  if (filename.includes('transcript')) {
    return 'transcript';
  }
  if (filename.includes('receipt')) {
    return 'store-receipt';
  }
  if (filename.includes('membership') || filename.includes('member')) {
    return 'store-membership';
  }
  if (filename.includes('utility') || filename.includes('electric') || filename.includes('gas') || filename.includes('water')) {
    return 'utility-bill';
  }
  if (filename.includes('lease') || filename.includes('rental')) {
    return 'lease-agreement';
  }
  if (filename.includes('bank') && filename.includes('statement')) {
    return 'bank-statement';
  }
  if (filename.includes('pay') && (filename.includes('stub') || filename.includes('check'))) {
    return 'pay-stub';
  }
  if (filename.includes('property') && filename.includes('tax')) {
    return 'property-tax-bill';
  }
  if (filename.includes('insurance')) {
    if (filename.includes('card')) return 'insurance-card';
    return 'insurance-statement';
  }

  return 'other';
}

// ============ AI Vision Verification ============

/**
 * Verify a document using AI vision
 */
async function verifyDocumentWithAI(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  documentType: DocumentType,
  anthropicApiKey?: string
): Promise<VerificationResult> {
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for document verification');
  }

  const client = new Anthropic({ apiKey });
  const prompt = getExtractionPrompt(documentType);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  // Extract the text response
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse JSON response
  let parsed: {
    isValidDocument: boolean;
    documentType: string;
    issues: string[];
    data: Record<string, { value: unknown; confidence: string }>;
  };

  try {
    // Try to extract JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${e}`);
  }

  // Build verification result
  const issues: string[] = parsed.issues || [];
  const warnings: string[] = [];

  // Check if document type matches
  if (parsed.documentType && parsed.documentType !== documentType && parsed.documentType !== 'other') {
    warnings.push(`Document appears to be ${parsed.documentType}, not ${documentType}`);
  }

  // Calculate overall confidence
  let confidenceSum = 0;
  let confidenceCount = 0;
  const confidenceMap: Record<string, number> = { high: 3, medium: 2, low: 1, uncertain: 0 };

  for (const [_key, field] of Object.entries(parsed.data)) {
    if (field && typeof field === 'object' && 'confidence' in field) {
      const conf = field.confidence as string;
      if (conf in confidenceMap) {
        confidenceSum += confidenceMap[conf];
        confidenceCount++;
      }
    }
  }

  const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
  let overallConfidence: ExtractionConfidence = 'uncertain';
  if (avgConfidence >= 2.5) overallConfidence = 'high';
  else if (avgConfidence >= 1.5) overallConfidence = 'medium';
  else if (avgConfidence >= 0.5) overallConfidence = 'low';

  // Build extracted data structure
  const extractedData = buildExtractedData(documentType, parsed.data);

  return {
    isValid: parsed.isValidDocument && issues.length === 0,
    confidence: overallConfidence,
    documentType,
    extractedData,
    issues,
    warnings,
    verifiedAt: new Date().toISOString(),
    documentHash: '', // Will be set by caller
  };
}

/**
 * Build typed extracted data from parsed response
 */
function buildExtractedData(
  documentType: DocumentType,
  data: Record<string, { value: unknown; confidence: string }>
): ExtractedDocumentData {
  const convertField = <T>(field: { value: unknown; confidence: string } | undefined): ExtractedField<T> | undefined => {
    if (!field || field.value === null || field.value === undefined) return undefined;
    return {
      value: field.value as T,
      confidence: field.confidence as ExtractionConfidence,
    };
  };

  switch (documentType) {
    case 'drivers-license':
    case 'state-id':
      return {
        type: documentType,
        data: {
          fullName: convertField<string>(data.fullName),
          dateOfBirth: convertField<string>(data.dateOfBirth),
          state: convertField<string>(data.state),
          address: convertField<string>(data.address),
          city: convertField<string>(data.city),
          zipCode: convertField<string>(data.zipCode),
          licenseNumber: convertField<string>(data.licenseNumber || data.idNumber),
          expirationDate: convertField<string>(data.expirationDate),
          issueDate: convertField<string>(data.issueDate),
          licenseClass: convertField<string>(data.licenseClass),
        } as DriversLicenseData,
      };

    case 'passport':
      return {
        type: 'passport',
        data: {
          fullName: convertField<string>(data.fullName),
          dateOfBirth: convertField<string>(data.dateOfBirth),
          nationality: convertField<string>(data.nationality),
          passportNumber: convertField<string>(data.passportNumber),
          expirationDate: convertField<string>(data.expirationDate),
          issueDate: convertField<string>(data.issueDate),
          placeOfBirth: convertField<string>(data.placeOfBirth),
          gender: convertField<string>(data.gender),
        } as PassportData,
      };

    case 'military-id':
    case 'va-card':
    case 'dd214':
      return {
        type: documentType,
        data: {
          fullName: convertField<string>(data.fullName),
          branch: convertField<string>(data.branch),
          rank: convertField<string>(data.rank),
          serviceStatus: convertField<'active' | 'veteran' | 'retired' | 'reserve'>(data.serviceStatus),
          serviceStartDate: convertField<string>(data.serviceStartDate),
          serviceEndDate: convertField<string>(data.serviceEndDate),
          dischargeType: convertField<string>(data.dischargeType),
          veteranStatus: convertField<boolean>(data.veteranStatus),
          vaEligibility: convertField<boolean>(data.vaEligibility),
        } as MilitaryData,
      };

    case 'voter-registration':
      return {
        type: 'voter-registration',
        data: {
          fullName: convertField<string>(data.fullName),
          registeredState: convertField<string>(data.registeredState),
          county: convertField<string>(data.county),
          registrationDate: convertField<string>(data.registrationDate),
          partyAffiliation: convertField<string>(data.partyAffiliation),
          voterStatus: convertField<'active' | 'inactive' | 'pending'>(data.voterStatus),
        } as VoterRegistrationData,
      };

    case 'professional-license':
      return {
        type: 'professional-license',
        data: {
          fullName: convertField<string>(data.fullName),
          licenseType: convertField<string>(data.licenseType),
          licenseNumber: convertField<string>(data.licenseNumber),
          issuingAuthority: convertField<string>(data.issuingAuthority),
          state: convertField<string>(data.state),
          issueDate: convertField<string>(data.issueDate),
          expirationDate: convertField<string>(data.expirationDate),
          status: convertField<'active' | 'inactive' | 'suspended' | 'expired'>(data.status),
        } as ProfessionalLicenseData,
      };

    case 'business-license':
      return {
        type: 'business-license',
        data: {
          businessName: convertField<string>(data.businessName),
          ownerName: convertField<string>(data.ownerName),
          businessType: convertField<string>(data.businessType),
          state: convertField<string>(data.state),
          industry: convertField<string>(data.industry),
          issueDate: convertField<string>(data.issueDate),
          expirationDate: convertField<string>(data.expirationDate),
          status: convertField<'active' | 'inactive' | 'suspended'>(data.status),
        } as BusinessLicenseData,
      };

    case 'student-id':
    case 'diploma':
    case 'transcript':
      return {
        type: documentType,
        data: {
          fullName: convertField<string>(data.fullName),
          schoolName: convertField<string>(data.schoolName),
          studentId: convertField<string>(data.studentId),
          enrollmentStatus: convertField<'full-time' | 'part-time' | 'graduated'>(data.enrollmentStatus),
          expectedGraduation: convertField<string>(data.expectedGraduation || data.graduationDate),
          major: convertField<string>(data.major),
          level: convertField<'undergraduate' | 'graduate' | 'doctoral' | 'other'>(data.level || data.degreeType),
        } as StudentIdData,
      };

    case 'store-receipt':
      return {
        type: 'store-receipt',
        data: {
          storeName: convertField<string>(data.storeName),
          storeLocation: convertField<string>(data.storeLocation),
          purchaseDate: convertField<string>(data.purchaseDate),
          totalAmount: convertField<number>(data.totalAmount),
          currency: convertField<string>(data.currency),
          itemCategories: convertField<string[]>(data.itemCategories),
          itemCount: convertField<number>(data.itemCount),
          paymentMethod: convertField<string>(data.paymentMethod),
          membershipUsed: convertField<boolean>(data.membershipUsed),
        } as StoreReceiptData,
      };

    case 'store-membership':
      return {
        type: 'store-membership',
        data: {
          storeName: convertField<string>(data.storeName),
          memberName: convertField<string>(data.memberName),
          membershipLevel: convertField<string>(data.membershipLevel),
          memberSince: convertField<string>(data.memberSince),
          membershipNumber: convertField<string>(data.membershipNumber),
          expirationDate: convertField<string>(data.expirationDate),
        } as StoreMembershipData,
      };

    case 'utility-bill':
    case 'lease-agreement':
      return {
        type: documentType,
        data: {
          providerName: convertField<string>(data.providerName),
          accountHolderName: convertField<string>(data.accountHolderName || data.tenantName),
          serviceAddress: convertField<string>(data.serviceAddress || data.propertyAddress),
          city: convertField<string>(data.city),
          state: convertField<string>(data.state),
          zipCode: convertField<string>(data.zipCode),
          billDate: convertField<string>(data.billDate || data.leaseStartDate),
          utilityType: convertField<'electric' | 'gas' | 'water' | 'internet' | 'phone' | 'other'>(data.utilityType),
        } as UtilityBillData,
      };

    case 'bank-statement':
      return {
        type: 'bank-statement',
        data: {
          bankName: convertField<string>(data.bankName),
          accountHolderName: convertField<string>(data.accountHolderName),
          statementDate: convertField<string>(data.statementDate),
          accountType: convertField<'checking' | 'savings' | 'investment' | 'other'>(data.accountType),
        } as BankStatementData,
      };

    case 'pay-stub':
      return {
        type: 'pay-stub',
        data: {
          employerName: convertField<string>(data.employerName),
          employeeName: convertField<string>(data.employeeName),
          payPeriodStart: convertField<string>(data.payPeriodStart),
          payPeriodEnd: convertField<string>(data.payPeriodEnd),
          payDate: convertField<string>(data.payDate),
          employmentType: convertField<'full-time' | 'part-time' | 'contractor'>(data.employmentType),
          jobTitle: convertField<string>(data.jobTitle),
        } as PayStubData,
      };

    case 'property-tax-bill':
      return {
        type: 'property-tax-bill',
        data: {
          ownerName: convertField<string>(data.ownerName),
          propertyAddress: convertField<string>(data.propertyAddress),
          city: convertField<string>(data.city),
          state: convertField<string>(data.state),
          zipCode: convertField<string>(data.zipCode),
          assessmentYear: convertField<string>(data.assessmentYear),
          propertyType: convertField<'residential' | 'commercial' | 'land' | 'other'>(data.propertyType),
        } as PropertyTaxBillData,
      };

    case 'insurance-card':
    case 'insurance-statement':
      return {
        type: documentType,
        data: {
          providerName: convertField<string>(data.providerName),
          memberName: convertField<string>(data.memberName),
          planType: convertField<string>(data.planType),
          coverageType: convertField<'health' | 'dental' | 'vision' | 'auto' | 'home' | 'life' | 'other'>(data.coverageType),
          groupNumber: convertField<string>(data.groupNumber),
          effectiveDate: convertField<string>(data.effectiveDate || data.statementDate),
        } as InsuranceCardData,
      };

    default:
      return {
        type: 'other',
        data: data as Record<string, ExtractedField<unknown>>,
      };
  }
}

// ============ Derived Attributes ============

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Derive verified attributes from extracted document data
 */
function deriveVerifiedAttributes(
  documentType: DocumentType,
  verification: VerificationResult
): Partial<VerifiedAttributes> {
  const attrs: Partial<VerifiedAttributes> = {
    lastVerifiedAt: verification.verifiedAt,
  };

  const data = verification.extractedData.data;
  const now = new Date().toISOString();

  // Helper to create verification record
  const createVerificationRecord = (confidence: ExtractionConfidence): VerificationRecord => ({
    verified: true,
    confidence: confidence === 'uncertain' ? 'low' : confidence,
    documentType,
    verifiedAt: now,
  });

  switch (documentType) {
    case 'drivers-license':
    case 'state-id': {
      const dlData = data as DriversLicenseData;
      if (dlData.fullName?.value) {
        attrs.verifiedName = dlData.fullName.value;
      }
      if (dlData.dateOfBirth?.value) {
        attrs.verifiedDateOfBirth = dlData.dateOfBirth.value;
        const age = calculateAge(dlData.dateOfBirth.value);
        attrs.verifiedAge = age;
        attrs.verifiedAgeThresholds = [18, 21, 25, 30, 40, 50, 55, 60, 65].filter(t => age >= t);
      }
      if (dlData.state?.value) {
        attrs.verifiedState = dlData.state.value;
        attrs.verifiedCity = dlData.city?.value;
        attrs.verifiedZipCode = dlData.zipCode?.value;
        attrs.residencyVerifications = [{
          ...createVerificationRecord(dlData.state.confidence),
          state: dlData.state.value,
          city: dlData.city?.value,
          zipCode: dlData.zipCode?.value,
          verificationMethod: 'drivers-license',
        }];
      }
      break;
    }

    case 'passport': {
      const passData = data as PassportData;
      if (passData.fullName?.value) {
        attrs.verifiedName = passData.fullName.value;
      }
      if (passData.dateOfBirth?.value) {
        attrs.verifiedDateOfBirth = passData.dateOfBirth.value;
        const age = calculateAge(passData.dateOfBirth.value);
        attrs.verifiedAge = age;
        attrs.verifiedAgeThresholds = [18, 21, 25, 30, 40, 50, 55, 60, 65].filter(t => age >= t);
      }
      break;
    }

    case 'military-id':
    case 'va-card':
    case 'dd214': {
      const milData = data as MilitaryData;
      attrs.isVeteran = milData.veteranStatus?.value === true ||
        milData.serviceStatus?.value === 'veteran' ||
        milData.serviceStatus?.value === 'retired' ||
        documentType === 'dd214' ||
        documentType === 'va-card';

      if (milData.branch?.value) {
        attrs.militaryBranch = milData.branch.value;
      }
      if (milData.serviceStatus?.value) {
        attrs.serviceStatus = milData.serviceStatus.value;
      }
      if (milData.vaEligibility?.value !== undefined) {
        attrs.isVaEligible = milData.vaEligibility.value;
      }
      attrs.veteranVerification = createVerificationRecord(
        milData.veteranStatus?.confidence || milData.serviceStatus?.confidence || 'medium'
      );
      break;
    }

    case 'voter-registration': {
      const voterData = data as VoterRegistrationData;
      attrs.isRegisteredVoter = true;
      if (voterData.registeredState?.value) {
        attrs.voterState = voterData.registeredState.value;
      }
      if (voterData.county?.value) {
        attrs.voterCounty = voterData.county.value;
      }
      if (voterData.partyAffiliation?.value) {
        attrs.partyAffiliation = voterData.partyAffiliation.value;
      }
      attrs.voterVerification = createVerificationRecord(voterData.registeredState?.confidence || 'medium');
      break;
    }

    case 'professional-license': {
      const profData = data as ProfessionalLicenseData;
      attrs.isLicensedProfessional = profData.status?.value === 'active';
      if (profData.licenseType?.value) {
        attrs.professionalLicenseTypes = [profData.licenseType.value];
      }
      if (profData.state?.value) {
        attrs.licenseStates = [profData.state.value];
      }
      attrs.professionalVerifications = [createVerificationRecord(profData.licenseType?.confidence || 'medium')];
      break;
    }

    case 'business-license': {
      const bizData = data as BusinessLicenseData;
      attrs.isBusinessOwner = bizData.status?.value === 'active';
      if (bizData.businessType?.value) {
        attrs.businessTypes = [bizData.businessType.value];
      }
      if (bizData.state?.value) {
        attrs.businessStates = [bizData.state.value];
      }
      attrs.businessVerification = createVerificationRecord(bizData.businessName?.confidence || 'medium');
      break;
    }

    case 'student-id':
    case 'diploma':
    case 'transcript': {
      const stuData = data as StudentIdData;
      attrs.isStudent = documentType === 'student-id' || stuData.enrollmentStatus?.value !== 'graduated';
      if (stuData.level?.value) {
        attrs.verifiedEducationLevel = stuData.level.value;
      }
      if (stuData.schoolName?.value) {
        attrs.verifiedSchools = [stuData.schoolName.value];
      }
      attrs.studentVerification = createVerificationRecord(stuData.schoolName?.confidence || 'medium');
      break;
    }

    case 'store-receipt': {
      const receiptData = data as StoreReceiptData;
      if (receiptData.storeName?.value) {
        attrs.shopsAt = [receiptData.storeName.value];
        attrs.shoppingVerifications = [{
          ...createVerificationRecord(receiptData.storeName.confidence),
          storeName: receiptData.storeName.value,
          lastPurchaseDate: receiptData.purchaseDate?.value,
        }];
      }
      break;
    }

    case 'store-membership': {
      const memberData = data as StoreMembershipData;
      if (memberData.storeName?.value) {
        attrs.storeMemberships = [memberData.storeName.value];
        attrs.shopsAt = attrs.shopsAt || [];
        if (!attrs.shopsAt.includes(memberData.storeName.value)) {
          attrs.shopsAt.push(memberData.storeName.value);
        }
        attrs.shoppingVerifications = attrs.shoppingVerifications || [];
        attrs.shoppingVerifications.push({
          ...createVerificationRecord(memberData.storeName.confidence),
          storeName: memberData.storeName.value,
          membershipLevel: memberData.membershipLevel?.value,
          memberSince: memberData.memberSince?.value,
        });
      }
      break;
    }

    case 'utility-bill':
    case 'lease-agreement': {
      const utilData = data as UtilityBillData;
      if (utilData.state?.value) {
        attrs.verifiedState = utilData.state.value;
        attrs.verifiedCity = utilData.city?.value;
        attrs.verifiedZipCode = utilData.zipCode?.value;

        attrs.residencyVerifications = attrs.residencyVerifications || [];
        attrs.residencyVerifications.push({
          ...createVerificationRecord(utilData.state.confidence),
          state: utilData.state.value,
          city: utilData.city?.value,
          zipCode: utilData.zipCode?.value,
          verificationMethod: documentType === 'utility-bill' ? 'utility-bill' : 'lease',
        });
      }
      break;
    }

    case 'bank-statement': {
      const bankData = data as BankStatementData;
      attrs.hasBankAccount = true;
      if (bankData.bankName?.value) {
        attrs.verifiedBanks = [bankData.bankName.value];
      }
      break;
    }

    case 'pay-stub': {
      const payData = data as PayStubData;
      attrs.isEmployed = true;
      if (payData.employerName?.value) {
        const empVerification: EmploymentVerification = {
          ...createVerificationRecord(payData.employerName.confidence),
          employerName: payData.employerName.value,
          jobTitle: payData.jobTitle?.value,
          employmentType: payData.employmentType?.value,
        };
        attrs.employmentVerifications = [empVerification];
      }
      break;
    }

    case 'property-tax-bill': {
      const propData = data as PropertyTaxBillData;
      attrs.isPropertyOwner = true;
      if (propData.state?.value) {
        attrs.verifiedState = propData.state.value;
        attrs.verifiedCity = propData.city?.value;
        attrs.verifiedZipCode = propData.zipCode?.value;

        attrs.residencyVerifications = attrs.residencyVerifications || [];
        attrs.residencyVerifications.push({
          ...createVerificationRecord(propData.state.confidence),
          state: propData.state.value,
          city: propData.city?.value,
          zipCode: propData.zipCode?.value,
          verificationMethod: 'property-tax',
        });
      }
      break;
    }

    case 'insurance-card':
    case 'insurance-statement': {
      const insData = data as InsuranceCardData;
      attrs.hasInsurance = true;
      if (insData.coverageType?.value) {
        attrs.insuranceTypes = [insData.coverageType.value];
      }
      attrs.insuranceVerification = createVerificationRecord(insData.providerName?.confidence || 'medium');
      break;
    }
  }

  return attrs;
}

// ============ Headless/API Mode Functions ============
// These functions require an Anthropic API key
// Use for automated scripts running without conversation context

/**
 * Scan a document file using the Anthropic API (HEADLESS/API MODE)
 *
 * This function is for automated agents running as scripts
 * WITHOUT a conversation context (no user chat).
 *
 * IMPORTANT: Requires ANTHROPIC_API_KEY environment variable or explicit key.
 * For conversational agents, use processExtractedData() instead.
 *
 * @param filePath - Path to the document image file
 * @param documentType - Optional document type (will be inferred from filename if not provided)
 * @param anthropicApiKey - API key (uses ANTHROPIC_API_KEY env var if not provided)
 * @returns ScanResult with verification details
 *
 * @example
 * // Headless mode - script needs API key
 * const result = await scanDocumentHeadless('/path/to/license.jpg', 'drivers-license');
 */
export async function scanDocumentHeadless(
  filePath: string,
  documentType?: DocumentType,
  anthropicApiKey?: string
): Promise<ScanResult> {
  const warnings: string[] = [];

  // Check for API key
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'ANTHROPIC_API_KEY required for headless mode. For conversational agents, use processExtractedData() instead.',
      warnings: ['Headless mode requires an API key. Set ANTHROPIC_API_KEY environment variable.'],
    };
  }

  // Validate file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    if (SUPPORTED_PDF_EXTENSIONS.includes(ext)) {
      return {
        success: false,
        error: 'PDF files are not yet supported. Please convert to an image format (JPG, PNG).',
      };
    }
    return {
      success: false,
      error: `Unsupported file type: ${ext}. Supported: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`,
    };
  }

  // Infer document type if not provided
  const inferredType = documentType || inferDocumentType(filePath);
  if (!documentType) {
    warnings.push(`Document type inferred from filename: ${inferredType}`);
  }

  try {
    // Read and encode image
    const { base64, mimeType } = await readImageAsBase64(filePath);

    // Hash the document
    const documentHash = await hashDocumentFile(filePath);

    // Verify with AI (use the validated apiKey)
    const verification = await verifyDocumentWithAI(base64, mimeType, inferredType, apiKey);
    verification.documentHash = documentHash;

    // Derive verified attributes
    const derivedAttributes = deriveVerifiedAttributes(inferredType, verification);

    // Create scanned document
    const scannedDocument: ScannedDocument = {
      type: inferredType,
      verification,
      derivedAttributes,
      scannedAt: new Date().toISOString(),
      documentHash,
    };

    // Set expiration if document has one
    const extractedData = verification.extractedData.data;
    if ('expirationDate' in extractedData && extractedData.expirationDate?.value) {
      scannedDocument.expiresAt = (extractedData.expirationDate as ExtractedField<string>).value;
    }

    return {
      success: true,
      document: scannedDocument,
      warnings: [...warnings, ...verification.warnings],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

/**
 * Backward compatibility alias for scanDocumentHeadless
 * @deprecated Use processExtractedData() for conversational mode or scanDocumentHeadless() for API mode
 */
export const scanDocument = scanDocumentHeadless;

// ============ Attestation Functions ============

/**
 * Create an attestation for a poll response
 */
export async function createAttestation(
  pollId: string,
  userAddress: string,
  attributes: Partial<VerifiedAttributes>,
  signer: Signer
): Promise<Attestation> {
  const contractAddress = POLL_CONTRACT_ADDRESS;
  const attestationId = randomUUID();
  const createdAt = new Date().toISOString();

  // Set expiration (24 hours)
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 24);
  const expiresAt = expirationDate.toISOString();

  const signature = await signAttestation(pollId, userAddress, contractAddress, signer);

  return {
    id: attestationId,
    pollId,
    userAddress,
    contractAddress,
    attributes,
    signature,
    createdAt,
    expiresAt,
  };
}

/**
 * Sign an attestation
 */
export async function signAttestation(
  pollId: string,
  userAddress: string,
  contractAddress: string,
  signer: Signer
): Promise<string> {
  let pollIdBytes: string;

  if (pollId.includes('-')) {
    pollIdBytes = keccak256(new TextEncoder().encode(pollId));
  } else {
    const pollIdNum = BigInt(pollId);
    pollIdBytes = ethers.zeroPadValue(ethers.toBeHex(pollIdNum), 32);
  }

  const messageHash = keccak256(
    solidityPacked(
      ['bytes32', 'address', 'address'],
      [pollIdBytes, userAddress, contractAddress]
    )
  );

  return signer.signMessage(getBytes(messageHash));
}

/**
 * Verify an attestation signature
 */
export function verifyAttestation(attestation: Attestation): boolean {
  try {
    let pollIdBytes: string;

    if (attestation.pollId.includes('-')) {
      pollIdBytes = keccak256(new TextEncoder().encode(attestation.pollId));
    } else {
      const pollIdNum = BigInt(attestation.pollId);
      pollIdBytes = ethers.zeroPadValue(ethers.toBeHex(pollIdNum), 32);
    }

    const messageHash = keccak256(
      solidityPacked(
        ['bytes32', 'address', 'address'],
        [pollIdBytes, attestation.userAddress, attestation.contractAddress]
      )
    );

    const recoveredAddress = ethers.verifyMessage(
      getBytes(messageHash),
      attestation.signature
    );

    return recoveredAddress.toLowerCase() === attestation.userAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Hash an attestation
 */
export function hashAttestation(attestation: Attestation): string {
  const dataToHash = JSON.stringify({
    id: attestation.id,
    pollId: attestation.pollId,
    userAddress: attestation.userAddress,
    contractAddress: attestation.contractAddress,
    attributes: attestation.attributes,
    createdAt: attestation.createdAt,
  });

  return keccak256(new TextEncoder().encode(dataToHash));
}

// ============ Attestation Manager Class ============

/**
 * Attestation Manager for stateful document verification operations
 *
 * Supports two modes:
 * - Conversational: Use addExtractedDocument() with data extracted by the agent
 * - Headless/API: Use scanHeadless() with ANTHROPIC_API_KEY (for scripts)
 */
export class AttestationManager {
  private signer: Signer | null = null;
  private scannedDocuments: ScannedDocument[] = [];
  private verifiedAttributes: VerifiedAttributes = {};
  private anthropicApiKey?: string;

  /**
   * Create an AttestationManager
   * @param anthropicApiKey - Optional API key for headless mode (not needed for conversational mode)
   */
  constructor(anthropicApiKey?: string) {
    this.anthropicApiKey = anthropicApiKey;
  }

  /**
   * Set the Anthropic API key (for headless mode only)
   */
  setAnthropicApiKey(apiKey: string): void {
    this.anthropicApiKey = apiKey;
  }

  /**
   * Set the signer for creating attestations
   */
  setSigner(signer: Signer): void {
    this.signer = signer;
  }

  /**
   * Create a signer from a private key
   */
  setSignerFromPrivateKey(privateKey: string): void {
    this.signer = new Wallet(privateKey);
  }

  // ============ CONVERSATIONAL MODE (Primary) ============

  /**
   * Process extracted document data (CONVERSATIONAL MODE)
   *
   * Use this when the agent has already seen and extracted data from a document.
   * No API key required - the agent does the vision work.
   *
   * @param documentType - Type of document verified
   * @param extractedData - Fields extracted by the agent
   * @param documentHash - Optional hash for deduplication
   * @returns ProcessedDocumentResult with verified attributes
   *
   * @example
   * // Agent sees a driver's license in chat, extracts fields, then calls:
   * const result = manager.addExtractedDocument('drivers-license', {
   *   fullName: { value: 'John Smith', confidence: 'high' },
   *   dateOfBirth: { value: '1990-05-15', confidence: 'high' },
   *   state: { value: 'NV', confidence: 'high' },
   *   expirationDate: { value: '2028-05-15', confidence: 'high' },
   * });
   */
  addExtractedDocument(
    documentType: DocumentType,
    extractedData: ExtractedDataInput,
    documentHash?: string
  ): ProcessedDocumentResult {
    const result = processExtractedData(documentType, extractedData, documentHash);

    if (result.success) {
      // Create a ScannedDocument to track
      const scannedDoc: ScannedDocument = {
        type: documentType,
        verification: result.verification,
        derivedAttributes: result.verifiedAttributes,
        scannedAt: new Date().toISOString(),
        documentHash: result.verification.documentHash,
      };

      this.scannedDocuments.push(scannedDoc);
      this.mergeVerifiedAttributes(result.verifiedAttributes);
    }

    return result;
  }

  // ============ HEADLESS/API MODE (Secondary) ============

  /**
   * Scan a document using the API (HEADLESS MODE)
   *
   * Use this for automated scripts without conversation context.
   * Requires ANTHROPIC_API_KEY to be set.
   *
   * @param filePath - Path to the document image file
   * @param documentType - Optional document type
   * @returns ScanResult with verification details
   */
  async scanHeadless(filePath: string, documentType?: DocumentType): Promise<ScanResult> {
    if (!this.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: 'Headless mode requires ANTHROPIC_API_KEY. For conversational mode, use addExtractedDocument() instead.',
      };
    }

    const result = await scanDocumentHeadless(filePath, documentType, this.anthropicApiKey);

    if (result.success && result.document) {
      this.scannedDocuments.push(result.document);
      this.mergeVerifiedAttributes(result.document.derivedAttributes);
    }

    return result;
  }

  /**
   * @deprecated Use addExtractedDocument() for conversational mode or scanHeadless() for API mode
   */
  async scan(filePath: string, documentType?: DocumentType): Promise<ScanResult> {
    return this.scanHeadless(filePath, documentType);
  }

  /**
   * Merge new verified attributes with existing ones
   */
  private mergeVerifiedAttributes(newAttrs: Partial<VerifiedAttributes>): void {
    // Simple merge for scalar values
    for (const [key, value] of Object.entries(newAttrs)) {
      if (value === undefined) continue;

      const existing = (this.verifiedAttributes as Record<string, unknown>)[key];

      // Array values: merge and dedupe
      if (Array.isArray(value)) {
        if (Array.isArray(existing)) {
          (this.verifiedAttributes as Record<string, unknown>)[key] = [...new Set([...existing, ...value])];
        } else {
          (this.verifiedAttributes as Record<string, unknown>)[key] = value;
        }
      }
      // Non-array: overwrite
      else {
        (this.verifiedAttributes as Record<string, unknown>)[key] = value;
      }
    }

    // Update metadata
    this.verifiedAttributes.lastVerifiedAt = new Date().toISOString();
    this.verifiedAttributes.documentsVerified = this.scannedDocuments.length;

    // Calculate verification score (simple: based on number of verified attributes)
    let verifiedCount = 0;
    const importantFields = [
      'verifiedName', 'verifiedDateOfBirth', 'verifiedState', 'isVeteran',
      'isRegisteredVoter', 'isLicensedProfessional', 'isStudent', 'isEmployed',
      'isBusinessOwner', 'hasBankAccount', 'hasInsurance', 'shopsAt', 'storeMemberships',
    ];
    for (const field of importantFields) {
      if ((this.verifiedAttributes as Record<string, unknown>)[field]) {
        verifiedCount++;
      }
    }
    this.verifiedAttributes.verificationScore = Math.min(100, Math.round((verifiedCount / importantFields.length) * 100));
  }

  /**
   * Get all verified attributes
   */
  getVerifiedAttributes(): VerifiedAttributes {
    return { ...this.verifiedAttributes };
  }

  /**
   * Get all scanned documents
   */
  getScannedDocuments(): ScannedDocument[] {
    return [...this.scannedDocuments];
  }

  /**
   * Create an attestation for a poll
   */
  async createAttestation(
    pollId: string,
    userAddress: string,
    attributes?: Partial<VerifiedAttributes>
  ): Promise<Attestation> {
    if (!this.signer) {
      throw new Error('Signer not configured');
    }
    return createAttestation(pollId, userAddress, attributes || this.verifiedAttributes, this.signer);
  }

  /**
   * Verify an attestation
   */
  verify(attestation: Attestation): boolean {
    return verifyAttestation(attestation);
  }

  /**
   * Hash an attestation
   */
  hash(attestation: Attestation): string {
    return hashAttestation(attestation);
  }

  /**
   * Clear all scanned documents and attributes
   */
  clear(): void {
    this.scannedDocuments = [];
    this.verifiedAttributes = {};
  }

  /**
   * Manually add verified attributes
   */
  addVerifiedAttributes(attributes: Partial<VerifiedAttributes>): void {
    this.mergeVerifiedAttributes({
      ...attributes,
      lastVerifiedAt: new Date().toISOString(),
    });
  }

  /**
   * Check if a specific attribute is verified
   */
  hasVerifiedAttribute(attribute: keyof VerifiedAttributes): boolean {
    const value = this.verifiedAttributes[attribute];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }

  /**
   * Get verification summary for display
   */
  getVerificationSummary(): {
    totalDocuments: number;
    verificationScore: number;
    verifiedClaims: string[];
  } {
    const claims: string[] = [];

    if (this.verifiedAttributes.verifiedName) claims.push('Identity verified');
    if (this.verifiedAttributes.verifiedAge) claims.push(`Age: ${this.verifiedAttributes.verifiedAge}`);
    if (this.verifiedAttributes.verifiedState) claims.push(`Resident of ${this.verifiedAttributes.verifiedState}`);
    if (this.verifiedAttributes.isVeteran) claims.push('US Military Veteran');
    if (this.verifiedAttributes.isRegisteredVoter) claims.push(`Registered voter (${this.verifiedAttributes.voterState})`);
    if (this.verifiedAttributes.isLicensedProfessional) {
      const types = this.verifiedAttributes.professionalLicenseTypes?.join(', ') || 'Professional';
      claims.push(`Licensed ${types}`);
    }
    if (this.verifiedAttributes.isStudent) claims.push('Current student');
    if (this.verifiedAttributes.isEmployed) claims.push('Currently employed');
    if (this.verifiedAttributes.isBusinessOwner) claims.push('Business owner');
    if (this.verifiedAttributes.storeMemberships?.length) {
      claims.push(`Member: ${this.verifiedAttributes.storeMemberships.join(', ')}`);
    }
    if (this.verifiedAttributes.shopsAt?.length) {
      claims.push(`Shops at: ${this.verifiedAttributes.shopsAt.join(', ')}`);
    }
    if (this.verifiedAttributes.hasInsurance) claims.push('Has insurance');
    if (this.verifiedAttributes.isPropertyOwner) claims.push('Property owner');

    return {
      totalDocuments: this.scannedDocuments.length,
      verificationScore: this.verifiedAttributes.verificationScore || 0,
      verifiedClaims: claims,
    };
  }
}
