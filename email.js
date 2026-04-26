// ============================================================
//  backend/email.js
//  Email Notification Service using Nodemailer + Gmail
//  Sends emails to students when their complaint status changes
//  and to admins when a new complaint is submitted
// ============================================================
const nodemailer = require('nodemailer');

// Create transporter (Gmail SMTP)
let transporter;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,   // App Password (not real Gmail password)
    },
  });
  return transporter;
}

// ── Email Templates ──────────────────────────────────────────

function baseTemplate(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f9; margin:0; padding:20px; }
        .wrap { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); }
        .header { background:linear-gradient(135deg,#0f2a5e,#1a4498); padding:28px 32px; }
        .header h1 { color:#fff; margin:0; font-size:1.4rem; }
        .header p { color:rgba(255,255,255,.7); margin:4px 0 0; font-size:.87rem; }
        .body { padding:28px 32px; }
        .body p { color:#333; line-height:1.65; font-size:.95rem; }
        .detail-box { background:#f0f4f9; border-radius:8px; padding:16px 20px; margin:18px 0; }
        .detail-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #dde4ef; font-size:.88rem; }
        .detail-row:last-child { border-bottom:none; }
        .detail-label { color:#64748b; font-weight:600; }
        .detail-value { color:#1a2233; font-weight:500; text-align:right; max-width:60%; }
        .status-badge { display:inline-block; padding:5px 14px; border-radius:20px; font-weight:700; font-size:.85rem; }
        .status-pending    { background:#fff3cd; color:#856404; }
        .status-in-progress{ background:#cfe2ff; color:#084298; }
        .status-resolved   { background:#d1e7dd; color:#0f5132; }
        .status-rejected   { background:#f8d7da; color:#842029; }
        .btn { display:inline-block; background:#d93025; color:#fff; padding:12px 26px; border-radius:8px; text-decoration:none; font-weight:700; font-size:.93rem; margin-top:16px; }
        .footer { background:#f8faff; padding:18px 32px; border-top:1px solid #dde4ef; font-size:.78rem; color:#999; }
        .college { font-weight:700; color:#0f2a5e; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <h1>📬 Digital Complaint Box</h1>
          <p>A.C. Patil College of Engineering, Kharghar</p>
        </div>
        <div class="body">${content}</div>
        <div class="footer">
          This is an automated notification from the <span class="college">Digital Complaint Box</span> system.<br/>
          A.C. Patil College of Engineering, Kharghar, Navi Mumbai – 410210.<br/>
          Do not reply to this email.
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email 1: Sent to student when they submit a complaint
async function sendComplaintSubmittedEmail({ to, studentName, complaintId, complaintTitle, category, department }) {
  const html = baseTemplate(`
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>Your complaint has been <strong>successfully submitted</strong> to the Digital Complaint Box system.
       Your identity is protected and will not be shown to the person you complained about.</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value" style="font-family:monospace;color:#0f2a5e;">${complaintId}</span></div>
      <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaintTitle}</span></div>
      <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${category}</span></div>
      <div class="detail-row"><span class="detail-label">Department</span><span class="detail-value">${department}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge status-pending">⏳ Pending Review</span></span></div>
    </div>
    <p>📌 <strong>Save your Complaint ID</strong> — you can use it to track your complaint anytime without logging in.</p>
    <p>You will receive an email when the status of your complaint is updated.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">Track My Complaint →</a>
  `);

  return getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[DCB] Complaint Submitted — ${complaintId}`,
    html,
  });
}

// Email 2: Sent to student when status changes
async function sendStatusUpdateEmail({ to, studentName, complaintId, complaintTitle, oldStatus, newStatus, resolution }) {
  const statusClass = {
    pending:      'status-pending',
    'in-progress':'status-in-progress',
    resolved:     'status-resolved',
    rejected:     'status-rejected',
  }[newStatus] || 'status-pending';

  const statusLabel = {
    pending:      '⏳ Pending',
    'in-progress':'🔄 In Progress',
    resolved:     '✅ Resolved',
    rejected:     '❌ Rejected',
  }[newStatus] || newStatus;

  const html = baseTemplate(`
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>The status of your complaint has been <strong>updated</strong> by the administration.</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value" style="font-family:monospace;color:#0f2a5e;">${complaintId}</span></div>
      <div class="detail-row"><span class="detail-label">Complaint</span><span class="detail-value">${complaintTitle}</span></div>
      <div class="detail-row"><span class="detail-label">New Status</span><span class="detail-value"><span class="status-badge ${statusClass}">${statusLabel}</span></span></div>
      ${resolution ? `<div class="detail-row"><span class="detail-label">Resolution</span><span class="detail-value">${resolution}</span></div>` : ''}
    </div>
    ${newStatus === 'resolved'
      ? `<p>✅ Your complaint has been <strong>resolved</strong>. We hope this has been addressed satisfactorily.</p>`
      : newStatus === 'rejected'
      ? `<p>❌ Your complaint has been marked as <strong>rejected</strong>. If you believe this is incorrect, please resubmit with more details or contact the administration directly.</p>`
      : `<p>Your complaint is now being actively reviewed by the administration.</p>`
    }
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">View Complaint Status →</a>
  `);

  return getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[DCB] Complaint Status Update — ${newStatus.toUpperCase()} — ${complaintId}`,
    html,
  });
}

// Email 3: Sent to admin when a new complaint arrives
async function sendNewComplaintAdminEmail({ to, complaintId, complaintTitle, category, department, againstName, againstRole, priority }) {
  const html = baseTemplate(`
    <p>A <strong>new complaint</strong> has been submitted and requires your attention.</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value" style="font-family:monospace;color:#0f2a5e;">${complaintId}</span></div>
      <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${complaintTitle}</span></div>
      <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${category}</span></div>
      <div class="detail-row"><span class="detail-label">Department</span><span class="detail-value">${department}</span></div>
      ${againstName ? `<div class="detail-row"><span class="detail-label">Against</span><span class="detail-value">${againstName} (${againstRole || ''})</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${priority || 'Medium'}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge status-pending">⏳ Pending Review</span></span></div>
    </div>
    <p>Please login to the admin dashboard to review and act on this complaint.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">Open Admin Dashboard →</a>
  `);

  return getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[DCB] New Complaint Received — ${priority?.toUpperCase() || 'MEDIUM'} Priority`,
    html,
  });
}

module.exports = {
  sendComplaintSubmittedEmail,
  sendStatusUpdateEmail,
  sendNewComplaintAdminEmail,
};
