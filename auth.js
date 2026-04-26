// ============================================================
//  backend/middleware/auth.js
//  Verifies Firebase ID tokens sent from the frontend.
//  Every protected API route uses this middleware.
//
//  How it works:
//  1. Frontend sends Authorization: Bearer <firebaseIdToken>
//  2. This middleware verifies the token with Firebase Admin
//  3. Attaches decoded user info to req.user
//  4. If token is invalid/missing → 401 Unauthorized
// ============================================================
const { getAuth } = require('../firebase-admin');

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.user = decoded;   // { uid, email, name, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
}

// Middleware that also fetches the user's role from Firestore
async function verifyTokenAndRole(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const { getDb } = require('../firebase-admin');
    const decoded  = await getAuth().verifyIdToken(idToken);
    const userSnap = await getDb().collection('users').doc(decoded.uid).get();

    if (!userSnap.exists) {
  console.log("User not found in DB:", decoded.uid, decoded.email);
  return res.status(403).json({ error: 'User profile not found' });
}
    req.user    = decoded;
    req.profile = userSnap.data();   // includes role, collegeId, department, etc.
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized — ' + err.message });
  }
}

// Role guard: only allow specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(403).json({ error: 'Profile not loaded — use verifyTokenAndRole' });
    }
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        error: `Access denied — requires role: ${roles.join(' or ')}`,
        yourRole: req.profile.role,
      });
    }
    next();
  };
}

module.exports = { verifyToken, verifyTokenAndRole, requireRole };
