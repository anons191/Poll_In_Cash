import { z } from "zod";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types/hono.js";

// ============ Auth Schemas ============

export const nonceRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
});

export const verifyRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  signature: z.string().min(1, "Signature is required"),
  nonce: z.string().min(1, "Nonce is required"),
});

// ============ Poll Schemas ============

export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["multiple_choice", "rating_scale", "yes_no", "short_text", "ranking"]),
  text: z.string().min(1, "Question text is required"),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

export const pollCriteriaSchema = z.object({
  minAge: z.number().int().positive().optional(),
  maxAge: z.number().int().positive().optional(),
  states: z.array(z.string().length(2)).optional(),
  isVeteran: z.boolean().optional(),
  isRegisteredVoter: z.boolean().optional(),
  occupations: z.array(z.string()).optional(),
  incomeRange: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  customAttributes: z.record(z.string(), z.unknown()).optional(),
});

export const createPollSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  questions: z.array(questionSchema).min(1, "At least one question is required").max(20),
  criteria: pollCriteriaSchema,
  cashPoolUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount")
    .refine((val) => parseFloat(val) >= 4, { message: "Minimum pool is 4 USDC" }),
  participantCap: z.number().int().positive().min(1).max(10000),
  visibility: z.enum(["public", "private"]).default("public"),
  expiresAt: z.string().datetime().optional(),
});

export const fundPollSchema = z.object({
  contractPollId: z.number().int().nonnegative(),
});

// ============ Agent/Response Schemas ============

/**
 * Source of an answer - where the confidence comes from
 */
export const answerSourceSchema = z.enum([
  "verified",       // From verified attributes (age, state, veteran status)
  "profile",        // From self-reported profile data
  "learned",        // From opinions section (previously answered)
  "user-confirmed", // User answered this specific question
  "inferred",       // Agent inferred from context (lowest confidence)
]);

/**
 * Enhanced response answer with confidence and source
 */
export const responseAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.union([z.string(), z.number(), z.array(z.string())]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  source: answerSourceSchema.optional(),
});

/**
 * @deprecated Use confidence and source in responseAnswerSchema instead
 */
export const confidenceScoreSchema = z.object({
  questionId: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export const submitResponseSchema = z.object({
  responses: z.array(responseAnswerSchema).min(1),
  confidenceScores: z.array(confidenceScoreSchema).optional(), // Deprecated, kept for backwards compatibility
  attestationHash: z.string().min(1, "Attestation hash is required"),
});

export const verifiedAttributesSchema = z.object({
  // Verified attributes (from document verification)
  verifiedName: z.string().optional(),
  verifiedAge: z.number().int().positive().optional(),
  verifiedState: z.string().length(2).optional(),
  verifiedCity: z.string().optional(),
  verifiedZipCode: z.string().optional(),
  isVeteran: z.boolean().optional(),
  isRegisteredVoter: z.boolean().optional(),
  isPropertyOwner: z.boolean().optional(),
  // Self-reported attributes (fallback)
  state: z.string().length(2).optional(),
  age: z.number().int().positive().optional(),
  occupation: z.string().optional(),
});

export const matchRequestSchema = z.object({
  verifiedAttributes: verifiedAttributesSchema,
});

// Extended verified attributes for attestation sync
export const syncAttestationsSchema = z.object({
  verifiedAttributes: z.object({
    // Identity
    verifiedName: z.string().optional(),
    verifiedAge: z.number().int().positive().optional(),
    verifiedAgeThresholds: z.array(z.number()).optional(),
    verifiedState: z.string().length(2).optional(),
    verifiedCity: z.string().optional(),
    verifiedZipCode: z.string().optional(),
    // Military
    isVeteran: z.boolean().optional(),
    militaryBranch: z.string().optional(),
    serviceStatus: z.string().optional(),
    isVaEligible: z.boolean().optional(),
    // Voter
    isRegisteredVoter: z.boolean().optional(),
    voterState: z.string().length(2).optional(),
    voterCounty: z.string().optional(),
    partyAffiliation: z.string().optional(),
    // Professional
    isLicensedProfessional: z.boolean().optional(),
    professionalLicenseTypes: z.array(z.string()).optional(),
    licenseStates: z.array(z.string()).optional(),
    isBusinessOwner: z.boolean().optional(),
    businessTypes: z.array(z.string()).optional(),
    // Education
    isStudent: z.boolean().optional(),
    verifiedEducationLevel: z.string().optional(),
    verifiedSchools: z.array(z.string()).optional(),
    // Employment
    isEmployed: z.boolean().optional(),
    verifiedIndustries: z.array(z.string()).optional(),
    // Shopping
    shopsAt: z.array(z.string()).optional(),
    storeMemberships: z.array(z.string()).optional(),
    // Financial
    hasBankAccount: z.boolean().optional(),
    verifiedBanks: z.array(z.string()).optional(),
    hasInsurance: z.boolean().optional(),
    insuranceTypes: z.array(z.string()).optional(),
    // Property
    isPropertyOwner: z.boolean().optional(),
  }),
  documentHashes: z.array(z.string()).optional(),
  verificationScore: z.number().int().min(0).max(100).optional(),
});

// ============ Query Param Schemas ============

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const pollsQuerySchema = z.object({
  status: z.enum(["draft", "active", "closed", "distributed", "cancelled"]).optional(),
  mine: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const discoverQuerySchema = z.object({
  isVeteran: z.coerce.boolean().optional(),
  isRegisteredVoter: z.coerce.boolean().optional(),
  state: z.string().length(2).optional(),
  age: z.coerce.number().int().positive().optional(),
  occupation: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============ Validation Middleware Factory ============

type Env = { Variables: AppVariables };

/**
 * Create a validation middleware for request body
 */
export function validateBody<T extends z.ZodSchema>(schema: T): MiddlewareHandler<Env> {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return c.json(
          {
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: result.error.flatten().fieldErrors,
          },
          400
        );
      }

      // Attach validated data to context
      c.set("validatedBody", result.data as z.infer<T>);
      return next();
    } catch {
      return c.json(
        {
          error: "Invalid JSON body",
          code: "INVALID_JSON",
        },
        400
      );
    }
  };
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T extends z.ZodSchema>(schema: T): MiddlewareHandler<Env> {
  return async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      return c.json(
        {
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: result.error.flatten().fieldErrors,
        },
        400
      );
    }

    c.set("validatedQuery", result.data as z.infer<T>);
    return next();
  };
}

// ============ Type Exports ============

export type NonceRequest = z.infer<typeof nonceRequestSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
export type CreatePollRequest = z.infer<typeof createPollSchema>;
export type FundPollRequest = z.infer<typeof fundPollSchema>;
export type SubmitResponseRequest = z.infer<typeof submitResponseSchema>;
export type MatchRequest = z.infer<typeof matchRequestSchema>;
export type SyncAttestationsRequest = z.infer<typeof syncAttestationsSchema>;
export type PollsQuery = z.infer<typeof pollsQuerySchema>;
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
