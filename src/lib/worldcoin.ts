export type WorldIDProof = {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  credential_type: "orb" | "phone";
  action: string;
  signal?: string;
};

/**
 * Verify World ID proof with Worldcoin API (server-side)
 * This should only be called from API routes, not client-side
 */
export async function verifyWorldID(proof: WorldIDProof): Promise<{ success: boolean }> {
  const apiKey = process.env.WLD_API_KEY;
  
  if (!apiKey) {
    throw new Error("WLD_API_KEY not configured");
  }

  const res = await fetch("https://developer.worldcoin.org/api/v1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(proof),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "World ID verification failed");
  }

  const data = await res.json();
  if (!data?.success) {
    throw new Error("Invalid World ID proof");
  }

  return data;
}
