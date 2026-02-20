import { defineConfig } from "drizzle-kit";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
  // Path to schema file
  schema: "./src/db/schema.ts",

  // Output directory for migrations
  out: "./drizzle",

  // Database dialect
  dialect: "postgresql",

  // Database connection
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  // Enable verbose logging during migrations
  verbose: true,

  // Enable strict mode for safer migrations
  strict: true,
});
