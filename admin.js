// ============================================================
//  backend/routes/admin.js
//  Admin-only API endpoints
// ============================================================
const express = require('express');
const router  = express.Router();
const { getDb }              = require('../firebase-admin');
const { verifyTokenAndRole,
        requireRole }        = require('../middleware/auth');

// ── GET /api/admin/stats
// Dashboard stats for admin
router.get('/stats', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();

    const [usersSnap, complaintsSnap, adminsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('complaints').get(),
      db.collection('admins').get(),
    ]);

    const complaints = complaintsSnap.docs.map(d => d.data());
    const byStatus   = { pending: 0, 'in-progress': 0, resolved: 0, rejected: 0 };
    const byCat      = {};
    const byDept     = {};
    complaints.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCat[c.category]  = (byCat[c.category]  || 0) + 1;
      byDept[c.department] = (byDept[c.department] || 0) + 1;
    });

    const byRole = {};
    usersSnap.docs.forEach(d => {
      const r = d.data().role;
      byRole[r] = (byRole[r] || 0) + 1;
    });

    res.json({
      totalUsers:      usersSnap.size,
      totalComplaints: complaintsSnap.size,
      totalAdmins:     adminsSnap.size,
      byStatus,
      byCat,
      byDept,
      byRole,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/admins
// List all admin emails
router.get('/admins', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const snap   = await getDb().collection('admins').get();
    const admins = snap.docs.map(d => ({ email: d.id, ...d.data() }));
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/admins
// Add a new admin email
router.post('/admins', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    await getDb().collection('admins').doc(normalizedEmail).set({
      addedBy: req.user.email,
      addedAt: new Date().toISOString(),
    });
    // Also update their user profile role if they already signed up
    const userSnap = await getDb().collection('users')
      .where('email', '==', normalizedEmail).limit(1).get();
    if (!userSnap.empty) {
      await userSnap.docs[0].ref.update({ role: 'admin' });
    }
    res.json({ success: true, message: `${normalizedEmail} added as admin.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/admins/:email
// Remove an admin
router.delete('/admins/:email', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    if (email === req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot remove yourself as admin.' });
    }
    await getDb().collection('admins').doc(email).delete();
    res.json({ success: true, message: `${email} removed from admins.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
