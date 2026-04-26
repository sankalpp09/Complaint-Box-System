// ============================================================
//  backend/routes/users.js
//  User management API endpoints
// ============================================================
const express = require('express');
const router  = express.Router();
const { getDb, getAuth }     = require('../firebase-admin');
const { verifyTokenAndRole,
        requireRole }        = require('../middleware/auth');

// ── GET /api/users/me
// Get current user's profile
router.get('/me', verifyTokenAndRole, (req, res) => {
  res.json({ user: req.profile });
});

// ── GET /api/users/teachers
// Get all teachers/hod/principal/director (for complaint form dropdown)
router.get('/teachers', verifyTokenAndRole, async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('users')
      .where('role', 'in', ['teacher','hod','principal','director'])
      .get();

    const teachers = snap.docs.map(doc => ({
      uid:         doc.id,
      displayName: doc.data().displayName,
      collegeId:   doc.data().collegeId,
      department:  doc.data().department,
      subject:     doc.data().subject || '',
      role:        doc.data().role,
    }));

    res.json({ teachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users  (Admin only)
// Get all users
router.get('/', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('users').get();
    const users = snap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      // Don't expose private key fields
    }));
    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/users/:uid/role  (Admin only)
// Change a user's role
router.patch('/:uid/role', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['student','teacher','hod','principal','director','admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await getDb().collection('users').doc(req.params.uid).update({ role });
    res.json({ success: true, message: `Role updated to "${role}"` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/users/:uid  (Admin only)
// Delete a user account
router.delete('/:uid', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.uid === req.user.uid) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    await getDb().collection('users').doc(req.params.uid).delete();
    await getAuth().deleteUser(req.params.uid).catch(() => {}); // also delete from Firebase Auth
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
