import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/**
 * Get the database connection string from environment
 * Throws if DATABASE_URL is not set
 */
function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Get your connection string from Neon dashboard: https://neon.tech"
    );
  }
  return connectionString;
}

/**
 * Postgres client using postgres-js driver
 * Configured for Neon's serverless environment
 */
const client = postgres(getConnectionString(), {
  // Neon recommended settings for serverless
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  ssl: "require", // Neon requires SSL
});

/**
 * Drizzle ORM instance with full schema for type-safe queries
 *
 * Usage:
 * ```typescript
 * import { db } from './db';
 * import { users } from './db/schema';
 *
 * // Query with relations
 * const user = await db.query.users.findFirst({
 *   where: eq(users.walletAddress, '0x...'),
 *   with: { agentProfile: true }
 * });
 *
 * // Insert
 * const newUser = await db.insert(users).values({
 *   walletAddress: '0x...'
 * }).returning();
 * ```
 */
export const db = drizzle(client, { schema });

/**
 * Export the raw postgres client for advanced use cases
 * (transactions, raw SQL, etc.)
 */
export { client as pgClient };

/**
 * Type for the Drizzle database instance
 */
export type Database = typeof db;
