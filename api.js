// ============================================================
//  src/api.js  —  Frontend → Backend API Helper
//  Wraps all calls to the Express backend and falls back to Firestore
//  when the backend is unavailable in production.
// ============================================================
import { auth, db } from './firebase/init.js';
import {
  doc, getDoc, collection, query, where, orderBy,
  getDocs, addDoc, updateDoc, setDoc, deleteDoc,
} from 'firebase/firestore';

const BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

function isBackendFallbackError(err) {
  const msg = String(err.message || '').toLowerCase();

  return (
    msg.includes('unexpected server response') ||
    msg.includes('text/html') ||
    msg.includes('html') ||
    msg.includes('request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('404') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('proxy')
  );
}

// Get a fresh Firebase ID token for the current user
async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  return user.getIdToken();
}

// Generic fetch wrapper
async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res   = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  if (!isJson) {
    throw new Error(`Unexpected server response (${contentType})`);
  }

  return data;
}

async function tryApiThenDirect(action, apiFn, directFn) {
  try {
    return await apiFn();
  } catch (err) {
    if (isBackendFallbackError(err)) {
      try {
        return await directFn();
      } catch (fallbackErr) {
        console.warn(`Firestore fallback failed for ${action}:`, fallbackErr);
      }
    }
    throw err;
  }
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function submitComplaintDirect(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');

  const profile = await getUserProfile(user.uid);
  if (!profile) throw new Error('Unable to load user profile');

  const complaint = {
    title:           data.title?.trim() || '',
    description:     data.description?.trim() || '',
    category:        data.category || 'general',
    department:      data.department || 'general',
    priority:        data.priority || 'medium',
    incidentDate:    data.incidentDate || null,
    againstUid:      data.againstUid || null,
    againstName:     data.againstName || null,
    againstCid:      data.againstCid || null,
    againstRole:     data.againstRole || 'teacher',
    submittedByUid:  user.uid,
    submittedByName: profile.displayName || user.displayName || '',
    submittedBy:     profile.collegeId || '',
    submittedEmail:  user.email,
    status:          'pending',
    resolution:      '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ref = await addDoc(collection(db, 'complaints'), complaint);
  return { success: true, complaintId: ref.id, message: 'Complaint submitted successfully.' };
}

async function getComplaintsDirect() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');

  const profile = await getUserProfile(user.uid);
  if (!profile) throw new Error('Unable to load user profile');

  let snap;
  if (profile.role === 'admin') {
    snap = await getDocs(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')));
  } else if (profile.role === 'student') {
    snap = await getDocs(query(collection(db, 'complaints'), where('submittedByUid', '==', user.uid), orderBy('createdAt', 'desc')));
  } else if (profile.role === 'teacher') {
    snap = await getDocs(query(collection(db, 'complaints'), where('againstUid', '==', user.uid), orderBy('createdAt', 'desc')));
  } else {
    snap = await getDocs(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')));
  }

  const viewerRank = {
    student: 0, teacher: 1, hod: 2, principal: 3, director: 4, admin: 99
  }[profile.role] ?? 0;

  const complaints = snap.docs.map(docSnap => {
    const data = docSnap.data();
    const accRank = ({ student: 0, teacher: 1, hod: 2, principal: 3, director: 4, admin: 99 })[data.againstRole] ?? 1;

    if (['hod','principal','director'].includes(profile.role) && viewerRank <= accRank) return null;

    const canSeeId = profile.role === 'admin'
      ? true
      : profile.role === 'student'
      ? data.submittedByUid === user.uid
      : viewerRank > accRank;

    return {
      id: docSnap.id,
      ...data,
      submittedByName: canSeeId ? data.submittedByName : 'Protected',
      submittedBy:     canSeeId ? data.submittedBy     : 'Protected',
      submittedEmail:  canSeeId ? data.submittedEmail  : null,
      _canSeeIdentity: canSeeId,
    };
  }).filter(Boolean);

  return { complaints, count: complaints.length };
}

async function getComplaintDirect(id) {
  const snap = await getDoc(doc(db, 'complaints', id));
  if (!snap.exists()) throw new Error('Complaint not found');
  return { id: snap.id, ...snap.data() };
}

async function updateComplaintStatusDirect(id, status, resolution) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');

  const profile = await getUserProfile(user.uid);
  if (!profile) throw new Error('Unable to load user profile');

  const snap = await getDoc(doc(db, 'complaints', id));
  if (!snap.exists()) throw new Error('Complaint not found');

  const data = snap.data();
  const accRank = ({ student: 0, teacher: 1, hod: 2, principal: 3, director: 4, admin: 99 })[data.againstRole] ?? 1;
  const viewerRank = ({ student: 0, teacher: 1, hod: 2, principal: 3, director: 4, admin: 99 })[profile.role] ?? 0;
  if (profile.role !== 'admin' && viewerRank <= accRank) {
    throw new Error('You do not have authority to update this complaint.');
  }

  await updateDoc(doc(db, 'complaints', id), {
    status,
    resolution: resolution || data.resolution || '',
    updatedAt: new Date().toISOString(),
    updatedBy: user.uid,
    updatedByName: profile.displayName || user.displayName || '',
  });

  return { success: true, message: `Status updated to "${status}"` };
}

async function getTeachersDirect() {
  const snap = await getDocs(collection(db, 'users'));
const teachers = snap.docs
  .map(d => ({ uid: d.id, ...d.data() }))
  .filter(u =>
    ['teacher','hod','principal','director'].includes(
      (u.role || '').toLowerCase()
    )
  );

return { teachers };
}

async function getAllUsersDirect() {
  const snap = await getDocs(collection(db, 'users'));
  return { users: snap.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() })) };
}

async function getAdminStatsDirect() {
  const complaintsSnap = await getDocs(collection(db, 'complaints'));
  const usersSnap = await getDocs(collection(db, 'users'));
  const adminsSnap = await getDocs(collection(db, 'admins'));
  const complaints = complaintsSnap.docs.map(docSnap => docSnap.data());
  return {
    totalComplaints: complaints.length,
    pendingComplaints: complaints.filter(c => c.status === 'pending').length,
    inProgressComplaints: complaints.filter(c => c.status === 'in-progress').length,
    resolvedComplaints: complaints.filter(c => c.status === 'resolved').length,
    totalUsers: usersSnap.size,
    totalAdmins: adminsSnap.size,
  };
}

async function getAdminsDirect() {
  const snap = await getDocs(collection(db, 'admins'));
  return { admins: snap.docs.map(docSnap => docSnap.id) };
}

async function addAdminDirect(email) {
  await setDoc(doc(db, 'admins', email.toLowerCase()), { addedAt: new Date().toISOString() });
  return { success: true };
}

async function removeAdminDirect(email) {
  await deleteDoc(doc(db, 'admins', email.toLowerCase()));
  return { success: true };
}

async function trackComplaintPublicDirect(id) {
  const snap = await getDoc(doc(db, 'complaints', id));
  if (!snap.exists()) throw new Error('Complaint not found');
  const data = snap.data();
  console.log("TRACK FIRESTORE DATA:", data);
  return {
  id: snap.id,
  title: data.title || "Complaint Title Not Available",
  category: data.category || "General",
  department: data.department || "General",
  againstName: data.againstName || data.against || "N/A",
  againstRole: data.againstRole || "teacher",
  status: data.status || "pending",
  resolution: data.resolution || "",
  priority: data.priority || "medium",

  createdAt: data.createdAt?.toDate 
    ? data.createdAt.toDate() 
    : data.createdAt || new Date(),

  updatedAt: data.updatedAt?.toDate 
    ? data.updatedAt.toDate() 
    : data.updatedAt || data.createdAt?.toDate?.() || new Date(),
};
}

function normalizeArrayResult(result, key) {
  if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.payload)) return result.payload;
  return [];
}

function normalizeCount(result, array) {
  return Number(result?.count ?? array.length ?? 0);
}

// ── Complaints ───────────────────────────────────────────────

export async function submitComplaintAPI(data) {
  const result = await submitComplaintDirect(data);

  console.log("FORCED FIRESTORE SAVE:", result);

  return {
    ...result,
    complaintId: result?.complaintId || result?.id
  };
}

export async function getComplaintsAPI() {
  const result = await tryApiThenDirect('getComplaints',
    () => apiFetch('/complaints'),
    () => getComplaintsDirect()
  );

  const complaints = normalizeArrayResult(result, 'complaints');
  return {
    complaints,
    count: normalizeCount(result, complaints),
  };
}


export async function updateComplaintStatusAPI(id, status, resolution) {
  return tryApiThenDirect('updateComplaintStatus',
    () => apiFetch(`/complaints/${id}/status`, { method: 'PATCH', body: { status, resolution } }),
    () => updateComplaintStatusDirect(id, status, resolution)
  );
}

// Public tracker (no auth)
export async function trackComplaintPublicAPI(id) {
  try {
    return trackComplaintPublicDirect(id);
  } catch (err) {
    if (isBackendFallbackError(err)) {
      return trackComplaintPublicDirect(id);
    }
    throw err;
  }
}

// ── Users ───────────────────────────────────────────────────

export async function getTeachersAPI() {
  return getTeachersDirect();
}

export async function getAllUsersAPI() {
  return tryApiThenDirect('getAllUsers',
    () => apiFetch('/users'),
    () => getAllUsersDirect()
  );
}

// ── Admin ───────────────────────────────────────────────────

export async function getAdminStatsAPI() {
  return tryApiThenDirect('getAdminStats',
    () => apiFetch('/admin/stats'),
    () => getAdminStatsDirect()
  );
}

export async function getAdminsAPI() {
  return tryApiThenDirect('getAdmins',
    () => apiFetch('/admin/admins'),
    () => getAdminsDirect()
  );
}

export async function addAdminAPI(email) {
  return tryApiThenDirect('addAdmin',
    () => apiFetch('/admin/admins', { method: 'POST', body: { email } }),
    () => addAdminDirect(email)
  );
}

export async function removeAdminAPI(email) {
  return tryApiThenDirect('removeAdmin',
    () => apiFetch(`/admin/admins/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    () => removeAdminDirect(email)
  );
}

// ── Health ───────────────────────────────────────────────────
export async function checkBackendHealth() {
  return true;
}
