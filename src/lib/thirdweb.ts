"use client";

import { createThirdwebClient } from "thirdweb";
import { base, baseSepolia } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Default to Base Sepolia for testing, allow override via env var
export const chain =
  process.env.NEXT_PUBLIC_CHAIN === "base" ? base : baseSepolia;
