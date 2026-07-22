// Server-only Firebase Admin init. On Firebase App Hosting the runtime
// service account provides Application Default Credentials; locally, run
// `gcloud auth application-default login` (or set GOOGLE_APPLICATION_CREDENTIALS).
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "my-hair-explorer-prod";

const adminApp =
  getApps()[0] ||
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });

export const adminDb = getFirestore(adminApp);
