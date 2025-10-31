"use client";

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  type Timestamp 
} from "firebase/firestore";
import { db } from "./firebase";

export interface VerificationRecord {
  poll_id: string;
  wallet: string;
  nullifier_hash: string;
  action: string;
  verified_at: Timestamp;
  created_at: Timestamp;
}

/**
 * Store a verification record in Firestore
 */
export async function storeVerification(data: {
  pollId: string;
  wallet: string;
  nullifierHash: string;
  action: string;
}): Promise<string> {
  const verificationsRef = collection(db, "verifications");
  
  const verificationData = {
    poll_id: data.pollId,
    wallet: data.wallet,
    nullifier_hash: data.nullifierHash,
    action: data.action,
    verified_at: serverTimestamp(),
    created_at: serverTimestamp(),
  };
  
  const docRef = await addDoc(verificationsRef, verificationData);
  return docRef.id;
}

/**
 * Check if a nullifier hash has already been used for a poll
 */
export async function checkVerificationExists(
  pollId: string,
  nullifierHash: string
): Promise<boolean> {
  const verificationsRef = collection(db, "verifications");
  const q = query(
    verificationsRef,
    where("poll_id", "==", pollId),
    where("nullifier_hash", "==", nullifierHash)
  );
  
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

/**
 * Get all verifications for a specific poll
 */
export async function getPollVerifications(pollId: string): Promise<(VerificationRecord & { id: string })[]> {
  const verificationsRef = collection(db, "verifications");
  const q = query(verificationsRef, where("poll_id", "==", pollId));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as VerificationRecord & { id: string }));
}

/**
 * Check if a wallet has already verified for a poll
 */
export async function hasWalletVerified(
  pollId: string,
  wallet: string
): Promise<boolean> {
  const verificationsRef = collection(db, "verifications");
  const q = query(
    verificationsRef,
    where("poll_id", "==", pollId),
    where("wallet", "==", wallet.toLowerCase())
  );
  
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

