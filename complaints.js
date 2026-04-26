// ============================================================
//  backend/routes/complaints.js
//  All complaint-related API endpoints
// ============================================================
const express  = require('express');
const router   = express.Router();
const { getDb }          = require('../firebase-admin');
const { verifyTokenAndRole, requireRole } = require('../middleware/auth');
const {
  sendComplaintSubmittedEmail,
  sendStatusUpdateEmail,
  sendNewComplaintAdminEmail,
} = require('../email');

const ROLE_RANK = {
  student: 0, teacher: 1, hod: 2, principal: 3, director: 4, admin: 99
};

// ── POST /api/complaints
// Submit a new complaint
// Anyone logged in can submit
router.post('/', verifyTokenAndRole, async (req, res) => {
  try {
    const db   = getDb();
    const user = req.profile;
    const body = req.body;

    // Validate required fields
    const required = ['title', 'description', 'category', 'department'];
    for (const f of required) {
      if (!body[f]?.trim()) {
        return res.status(400).json({ error: `Missing required field: ${f}` });
      }
    }

    // Build complaint document
    const complaint = {
      title:           body.title.trim(),
      description:     body.description.trim(),
      category:        body.category,
      department:      body.department,
      priority:        body.priority || 'medium',
      incidentDate:    body.incidentDate || null,
      againstUid:      body.againstUid  || null,
      againstName:     body.againstName || null,
      againstCid:      body.againstCid  || null,
      againstRole:     body.againstRole || 'teacher',
      submittedByUid:  req.user.uid,
      submittedByName: user.displayName,
      submittedBy:     user.collegeId,
      submittedEmail:  user.email,
      status:          'pending',
      resolution:      '',
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };

    // Save to Firestore
    const ref = await db.collection('complaints').add(complaint);
    const complaintId = ref.id;

    console.log(`✅ New complaint: ${complaintId} by ${user.email}`);

    // ── Send email notifications (async, don't wait) ─────────
    // 1. Confirm to student
    sendComplaintSubmittedEmail({
      to:             user.email,
      studentName:    user.displayName,
      complaintId,
      complaintTitle: complaint.title,
      category:       complaint.category,
      department:     complaint.department,
    }).catch(e => console.error('Email error (student confirm):', e.message));

    // 2. Alert all admins
    db.collection('admins').get().then(snap => {
      snap.docs.forEach(doc => {
        sendNewComplaintAdminEmail({
          to:           doc.id,
          complaintId,
          complaintTitle: complaint.title,
          category:       complaint.category,
          department:     complaint.department,
          againstName:    complaint.againstName,
          againstRole:    complaint.againstRole,
          priority:       complaint.priority,
        }).catch(e => console.error('Email error (admin alert):', e.message));
      });
    });

    return res.status(201).json({ success: true, complaintId, message: 'Complaint submitted successfully.' });
  } catch (err) {
    console.error('POST /complaints error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints
// Get complaints based on viewer's role
router.get('/', verifyTokenAndRole, async (req, res) => {
  try {
    const db      = getDb();
    const profile = req.profile;
    let snapshot;

    if (profile.role === 'admin') {
      // Admin sees everything
      snapshot = await db.collection('complaints')
        .orderBy('createdAt', 'desc').get();

    } else if (profile.role === 'student') {
      // Student sees only their own
      snapshot = await db.collection('complaints')
        .where('submittedByUid', '==', req.user.uid)
        .orderBy('createdAt', 'desc').get();

    } else if (profile.role === 'teacher') {
      // Teacher sees complaints filed against them (identity stripped below)
      snapshot = await db.collection('complaints')
        .where('againstUid', '==', req.user.uid)
        .orderBy('createdAt', 'desc').get();

    } else {
      // HOD, Principal, Director — see complaints where their rank > accusedRole rank
      snapshot = await db.collection('complaints')
        .orderBy('createdAt', 'desc').get();
    }

    const viewerRank = ROLE_RANK[profile.role] ?? 0;

    const complaints = snapshot.docs
      .map(doc => {
        const data    = doc.data();
        const accRank = ROLE_RANK[data.againstRole] ?? 1;

        // Determine if this viewer can see complainant identity
        const canSeeId = profile.role === 'admin'
          ? true
          : profile.role === 'student'
          ? data.submittedByUid === req.user.uid    // student sees their own
          : viewerRank > accRank;                   // higher rank sees identity

        // If HOD/Principal/Director — only include complaints they outrank
        if (['hod','principal','director'].includes(profile.role)) {
          if (viewerRank <= accRank) return null;   // skip, not their authority
        }

        return {
          id: doc.id,
          ...data,
          // Strip identity if viewer can't see it
          submittedByName: canSeeId ? data.submittedByName : '🔒 Protected',
          submittedBy:     canSeeId ? data.submittedBy     : '🔒 Protected',
          submittedEmail:  canSeeId ? data.submittedEmail  : null,
          _canSeeIdentity: canSeeId,
        };
      })
      .filter(Boolean);   // remove nulls

    return res.json({ complaints, count: complaints.length });
  } catch (err) {
    console.error('GET /complaints error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints/track/:id  (Public — no auth needed)
// Track a complaint by ID without logging in
router.get('/track/:id', async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('complaints').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Complaint not found' });

    const data = snap.data();

    // Public endpoint — NEVER return identity fields
    return res.json({
      id:          snap.id,
      title:       data.title,
      category:    data.category,
      department:  data.department,
      againstName: data.againstName,
      againstRole: data.againstRole,
      status:      data.status,
      resolution:  data.resolution,
      priority:    data.priority,
      createdAt:   data.createdAt,
      updatedAt:   data.updatedAt,
      // Identity NEVER exposed in public endpoint
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints/:id
// Get a single complaint by ID
router.get('/:id', verifyTokenAndRole, async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('complaints').doc(req.params.id).get();

    if (!snap.exists) return res.status(404).json({ error: 'Complaint not found' });

    const data        = snap.data();
    const profile     = req.profile;
    const viewerRank  = ROLE_RANK[profile.role] ?? 0;
    const accRank     = ROLE_RANK[data.againstRole] ?? 1;

    // Access check
    const isOwn      = data.submittedByUid === req.user.uid;
    const isAccused   = data.againstUid    === req.user.uid;
    const isAdmin     = profile.role === 'admin';
    const outranks    = viewerRank > accRank;

    if (!isOwn && !isAccused && !isAdmin && !outranks) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const canSeeId = isAdmin || isOwn || outranks;

    return res.json({
      id: snap.id,
      ...data,
      submittedByName: canSeeId ? data.submittedByName : '🔒 Protected',
      submittedBy:     canSeeId ? data.submittedBy     : '🔒 Protected',
      submittedEmail:  canSeeId ? data.submittedEmail  : null,
      _canSeeIdentity: canSeeId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/complaints/:id/status
// Update complaint status — only authorized roles
router.patch('/:id/status', verifyTokenAndRole, async (req, res) => {
  try {
    const db          = getDb();
    const snap        = await db.collection('complaints').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Complaint not found' });

    const data        = snap.data();
    const profile     = req.profile;
    const viewerRank  = ROLE_RANK[profile.role] ?? 0;
    const accRank     = ROLE_RANK[data.againstRole] ?? 1;

    // Only admin or higher-rank can update
    if (profile.role !== 'admin' && viewerRank <= accRank) {
      return res.status(403).json({ error: 'You do not have authority to update this complaint.' });
    }

    const { status, resolution } = req.body;
    const validStatuses = ['pending','in-progress','resolved','rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const oldStatus = data.status;

    await db.collection('complaints').doc(req.params.id).update({
      status,
      resolution:  resolution || data.resolution || '',
      updatedAt:   new Date().toISOString(),
      updatedBy:   req.user.uid,
      updatedByName: profile.displayName,
    });

    // Send status update email to student (async)
    if (data.submittedEmail && oldStatus !== status) {
      sendStatusUpdateEmail({
        to:             data.submittedEmail,
        studentName:    data.submittedByName,
        complaintId:    req.params.id,
        complaintTitle: data.title,
        oldStatus,
        newStatus:      status,
        resolution,
      }).catch(e => console.error('Email error (status update):', e.message));
    }

    return res.json({ success: true, message: `Status updated to "${status}"` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints/track/:id  (Public — no auth needed)
// Track a complaint by ID without logging in
router.get('/track/:id', async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('complaints').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Complaint not found' });

    const data = snap.data();

    // Public endpoint — NEVER return identity fields
    return res.json({
      id:          snap.id,
      title:       data.title,
      category:    data.category,
      department:  data.department,
      againstName: data.againstName,
      againstRole: data.againstRole,
      status:      data.status,
      resolution:  data.resolution,
      priority:    data.priority,
      createdAt:   data.createdAt,
      updatedAt:   data.updatedAt,
      // Identity NEVER exposed in public endpoint
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/complaints/:id  (Admin only)
router.delete('/:id', verifyTokenAndRole, requireRole('admin'), async (req, res) => {
  try {
    await getDb().collection('complaints').doc(req.params.id).delete();
    return res.json({ success: true, message: 'Complaint deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
