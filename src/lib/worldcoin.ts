export type WorldIDProof = {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  credential_type: "orb" | "phone";
  action: string;
  signal?: string;
};

export async function verifyWorldID(proof: WorldIDProof): Promise<{ success: boolean }> {
  const res = await fetch("https://developer.worldcoin.org/api/v1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WLD_API_KEY}`,
    },
    body: JSON.stringify(proof),
  });

  if (!res.ok) {
    throw new Error("World ID verification failed");
  }

  const data = await res.json();
  if (!data?.success) {
    throw new Error("Invalid World ID proof");
  }

  return data;
}
