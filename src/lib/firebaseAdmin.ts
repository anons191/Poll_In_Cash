import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

let adminApp: App;

if (getApps().length === 0) {
  // Try to load from JSON file first (for local development)
  // Then fall back to environment variables (for production/Vercel)
  let serviceAccount;
  
  try {
    // Look for Firebase service account JSON file in project root
    // Pattern: *-firebase-adminsdk-*.json
    const files = readdirSync(process.cwd());
    const jsonFile = files.find((file: string) =>
      file.includes("firebase-adminsdk") && file.endsWith(".json")
    );
    
    if (jsonFile) {
      // Load from JSON file
      const filePath = join(process.cwd(), jsonFile);
      const serviceAccountJson = JSON.parse(
        readFileSync(filePath, "utf8")
      );
      serviceAccount = {
        projectId: serviceAccountJson.project_id,
        clientEmail: serviceAccountJson.client_email,
        privateKey: serviceAccountJson.private_key,
      };
      console.log(`Firebase Admin initialized from JSON file: ${jsonFile}`);
    } else {
      throw new Error("No JSON file found, using env vars");
    }
  } catch {
    // Fall back to environment variables
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };
    
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error(
        "Firebase Admin initialization failed: Missing required credentials. " +
        "Either provide a service account JSON file or set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
      );
    }
    console.log("Firebase Admin initialized from environment variables");
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.projectId}.appspot.com`,
  });
} else {
  adminApp = getApps()[0];
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);

/**
 * Verify Firestore connection is working
 * Useful for diagnosing database setup issues
 */
export async function verifyFirestoreConnection(): Promise<boolean> {
  try {
    await adminDb.collection("_healthcheck").limit(1).get();
    console.log("✓ Firestore connection verified");
    return true;
  } catch (error) {
    console.error("✗ Firestore connection failed:", error);
    return false;
  }
}

export default adminApp;
