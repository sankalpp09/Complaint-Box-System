// ============================================================
//  backend/firebase-admin.js
//  Initializes Firebase Admin SDK
//  Used by the backend to securely access Firestore
//  with full admin privileges (bypasses security rules)
// ============================================================
const admin = require('firebase-admin');

let firebaseApp;

function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  // Build the service account from environment variables
  // (More secure than storing the entire JSON file)
  const serviceAccount = {
    type:                        'service_account',
    project_id:                  process.env.FIREBASE_PROJECT_ID,
    client_email:                process.env.FIREBASE_CLIENT_EMAIL,
    private_key:                 process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId:  process.env.FIREBASE_PROJECT_ID,
  });

  console.log('✅ Firebase Admin SDK initialized');
  return firebaseApp;
}

function getDb() {
  getFirebaseAdmin();
  return admin.firestore();
}

function getAuth() {
  getFirebaseAdmin();
  return admin.auth();
}

module.exports = { getDb, getAuth, admin };
