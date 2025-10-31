/**
 * Firebase Functions for Poll in Cash
 * HTTP endpoints, Firestore triggers, and scheduled functions
 */

import * as functions from "firebase-functions";
import { insightWebhook } from "./agents/insightWebhook";

// Export Insight webhook handler
export { insightWebhook };

// Additional functions will be added here:
// - Receipt intake agent
// - Dataset builder agent
// - Oracle signer agent
// - Matching agent
