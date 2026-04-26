// ============================================================
//  backend/server.js  —  Main Express Server
//  Digital Complaint Box — A.C. Patil College of Engineering
//
//  Start with:  node server.js   (or: npm run dev)
//  Runs on:     http://localhost:5000
// ============================================================
require('dotenv').config();                   // Load .env variables

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── Security Middleware ──────────────────────────────────────
app.use(helmet());                            // Sets security HTTP headers

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
// Prevents abuse — max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      100,
  message:  { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for complaint submission — max 5 per 10 minutes
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      5,
  message:  { error: 'Too many complaints submitted. Please wait before submitting again.' },
});
app.use('/api/complaints', submitLimiter);

// ── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    server:    'Digital Complaint Box API',
    college:   'A.C. Patil College of Engineering',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/admin',      require('./routes/admin'));

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    📬 Digital Complaint Box — Backend Server     ║');
  console.log('║    A.C. Patil College of Engineering             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✅ Server running at  http://localhost:${PORT}`);
  console.log(`  📋 Health check:      http://localhost:${PORT}/api/health`);
  console.log(`  🌐 Frontend URL:      ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`  🔧 Environment:       ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('  API Routes:');
  console.log('  POST   /api/complaints          — Submit complaint');
  console.log('  GET    /api/complaints          — List complaints (role-filtered)');
  console.log('  GET    /api/complaints/:id      — Get single complaint');
  console.log('  PATCH  /api/complaints/:id/status — Update status');
  console.log('  GET    /api/complaints/track/:id   — Public tracker');
  console.log('  GET    /api/users/me            — My profile');
  console.log('  GET    /api/users/teachers      — Teacher list');
  console.log('  GET    /api/admin/stats         — Dashboard stats');
  console.log('  GET    /api/admin/admins        — List admins');
  console.log('  POST   /api/admin/admins        — Add admin');
  console.log('');
});
