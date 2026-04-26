╔══════════════════════════════════════════════════════════════╗
║        📬 DIGITAL COMPLAINT BOX                             ║
║        A.C. Patil College of Engineering, Kharghar          ║
║        Full Stack: Express + Firebase + Vite                ║
╚══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROJECT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  digital-complaint-box/
  ├── package.json              ← Root scripts (run both servers)
  ├── README.md                 ← This file
  │
  ├── backend/                  ← Node.js + Express server
  │   ├── server.js             ← Main server file (entry point)
  │   ├── firebase-admin.js     ← Firebase Admin SDK setup
  │   ├── email.js              ← Email notification service
  │   ├── package.json          ← Backend dependencies
  │   ├── .env.example          ← Copy this to .env and fill in values
  │   ├── middleware/
  │   │   └── auth.js           ← Firebase token verification
  │   └── routes/
  │       ├── complaints.js     ← Complaint CRUD + status + tracking
  │       ├── users.js          ← User management
  │       └── admin.js          ← Admin stats + admin management
  │
  └── frontend/                 ← Vite + Vanilla JS
      ├── index.html            ← Single page app shell
      ├── package.json          ← Frontend dependencies
      ├── vite.config.js        ← Build config (proxies /api to backend)
      └── src/
          ├── main.js           ← Entry point
          ├── app.js            ← Router, state, Firebase helpers
          ├── api.js            ← Frontend → Backend API calls
          ├── firebase/
          │   ├── config.js     ← ⭐ YOUR FIREBASE CONFIG HERE
          │   └── init.js       ← Firebase initialization
          ├── styles/main.css   ← All styles
          └── pages/
              ├── landing.js
              ├── login.js
              ├── complete-profile.js
              ├── student-dashboard.js
              ├── teacher-dashboard.js
              ├── authority-dashboard.js
              ├── admin-dashboard.js
              ├── submit-complaint.js
              └── track.js


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STEP 1 — FIREBASE SETUP (10 minutes, do this FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://console.firebase.google.com
2. Click "Add project" → name: digital-complaint-box → Create
3. Register Web App:
   - Click </> icon → App nickname: DCB Web → Register
   - COPY the firebaseConfig object shown
   - Open frontend/src/firebase/config.js
   - Paste your values replacing the placeholders

4. Enable Authentication:
   - Firebase Console → Authentication → Get started
   - Enable "Google" → add support email → Save
   - Enable "Email/Password" → Save

5. Create Firestore Database:
   - Firebase Console → Firestore Database → Create database
   - Choose "Start in test mode" → Region: asia-south1 → Enable

6. Paste Firestore Security Rules:
   - Firestore → Rules tab → paste this, click Publish:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function viewerRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function roleRank(role) {
      return role == 'admin' ? 99 : role == 'director' ? 4 :
             role == 'principal' ? 3 : role == 'hod' ? 2 :
             role == 'teacher' ? 1 : 0;
    }
    match /users/{userId} {
      allow read:   if request.auth != null;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId || viewerRole() == 'admin';
      allow delete: if viewerRole() == 'admin';
    }
    match /complaints/{id} {
      allow read: if request.auth != null && (
        viewerRole() == 'admin' ||
        resource.data.submittedByUid == request.auth.uid ||
        resource.data.againstUid == request.auth.uid ||
        roleRank(viewerRole()) > roleRank(resource.data.againstRole)
      );
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        viewerRole() == 'admin' ||
        roleRank(viewerRole()) > roleRank(resource.data.againstRole)
      );
      allow delete: if viewerRole() == 'admin';
    }
    match /admins/{email} {
      allow read:  if request.auth != null;
      allow write: if viewerRole() == 'admin';
    }
  }
}

7. Seed your Admin email in Firestore:
   - Firestore → Data → Start collection
   - Collection ID: admins
   - Document ID: sankalpbhosle009@gmail.com
   - Field: addedAt → string → 2024-01-01 → Save


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STEP 2 — FIREBASE ADMIN SDK (for the backend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Firebase Console → Project Settings (gear icon) → Service accounts
2. Click "Generate new private key" → Download the JSON file
3. Open backend/.env.example → copy it to backend/.env
4. Open the downloaded JSON and copy these values into .env:
   - project_id          → FIREBASE_PROJECT_ID
   - client_email        → FIREBASE_CLIENT_EMAIL
   - private_key         → FIREBASE_PRIVATE_KEY (keep the quotes)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STEP 3 — EMAIL SETUP (for notifications)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The backend sends real emails using your Gmail.
You need an "App Password" (NOT your real Gmail password):

1. Go to https://myaccount.google.com/security
2. Make sure 2-Step Verification is ON
3. Search "App passwords" → Select Mail → Generate
4. Copy the 16-character password shown
5. Paste it into backend/.env as EMAIL_PASS


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STEP 4 — INSTALL DEPENDENCIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open terminal in the ROOT folder (where this README is):

  cd backend   && npm install
  cd ../frontend && npm install


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STEP 5 — RUN THE PROJECT (open 2 terminals)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Terminal 1 — Backend:
  cd backend
  npm run dev
  → Runs at http://localhost:5000

Terminal 2 — Frontend:
  cd frontend
  npm run dev
  → Runs at http://localhost:5173

Open http://localhost:5173 in your browser. Done! 🎉


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 HOW TO LOGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRST TIME:
  1. Click Login / Sign Up → Sign Up tab
  2. Click "Sign Up with Google" → select your Gmail
  3. Fill in your college details (role, ID, department)
  4. Set your SITE PASSWORD (not your Gmail password!)
  5. Done — you're logged in

RETURNING USERS (2 options):
  Option A: Click "Continue with Google" → instant login
  Option B: Enter your Gmail + the site password you set

FORGOT PASSWORD:
  Click "Forgot site password?" on the login page
  → Get a reset link in your Gmail inbox


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 IDENTITY PROTECTION HIERARCHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Complaint against → Who sees student identity?
  ─────────────────────────────────────────────
  Teacher           → HOD, Principal, Director, Admin
  HOD               → Principal, Director, Admin
  Principal         → Director, Admin
  Director          → Admin only

  Enforced in BOTH:
  ✅ Backend (server.js strips identity before sending to client)
  ✅ Frontend (canSeeIdentity() function)
  ✅ Firestore rules (database-level protection)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 API ENDPOINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GET    /api/health                  Health check (public)
  POST   /api/complaints              Submit complaint
  GET    /api/complaints              List complaints (role-filtered)
  GET    /api/complaints/:id          Get single complaint
  PATCH  /api/complaints/:id/status   Update status (sends email)
  GET    /api/complaints/track/:id    Public complaint tracker
  DELETE /api/complaints/:id          Delete (admin only)
  GET    /api/users/me                My profile
  GET    /api/users/teachers          Teacher list for dropdown
  GET    /api/users                   All users (admin only)
  PATCH  /api/users/:uid/role         Change role (admin only)
  GET    /api/admin/stats             Dashboard stats (admin only)
  GET    /api/admin/admins            List admins
  POST   /api/admin/admins            Add admin
  DELETE /api/admin/admins/:email     Remove admin


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TECH STACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Backend:   Node.js, Express.js, Firebase Admin SDK, Nodemailer
  Frontend:  HTML5, CSS3, Vanilla JavaScript ES6 Modules
  Database:  Firebase Firestore (NoSQL, real-time)
  Auth:      Firebase Authentication (Google + Email/Password)
  Email:     Gmail SMTP via Nodemailer
  Build:     Vite 5
  Security:  Helmet, CORS, Rate Limiting, JWT via Firebase


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMMON ERRORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  White screen on load
  → Check frontend/src/firebase/config.js — fill in your values

  "Permission denied" from Firestore
  → Paste the security rules from Step 1 into Firestore → Rules

  Backend says "Firebase Admin error"
  → Check backend/.env — make sure FIREBASE_PRIVATE_KEY has quotes

  "Cannot POST /api/complaints"
  → Make sure backend is running (npm run dev in backend folder)

  Email not sending
  → Use App Password not real Gmail password
  → Make sure 2-Step Verification is ON in your Google Account

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Made by Computer Engineering Mini Project Team
 A.C. Patil College of Engineering, Kharghar, Navi Mumbai
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
