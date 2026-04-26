// ============================================================
//  pages/landing.js  —  Home / Landing Page
// ============================================================
import { STATE } from '../app.js';

export function render() {
  const el = document.getElementById('page-landing');
  el.innerHTML = `
    <section class="hero">
      <div class="hero-bg-grid"></div>
      <div class="hero-content">
        <div class="college-chip">
          <span>🎓</span>
          A.C. Patil College of Engineering, Kharghar
        </div>
        <h1>Speak Up.<br/>Stay <em>Anonymous.</em><br/>Be Heard.</h1>
        <p>A secure, verified digital platform where students raise genuine concerns without fear of retaliation. Every complaint is encrypted, identity-shielded, and resolved transparently.</p>
        <div class="hero-cta">
          <button class="btn btn-fire" onclick="window.goTo('login')">📝 Submit a Complaint</button>
          <button class="btn btn-ghost-light" onclick="window.goTo('track')">🔍 Track My Complaint</button>
        </div>
        <div class="hero-stats">
          <div class="hstat"><span class="hval">100%</span><span class="hlbl">Anonymous from Teachers</span></div>
          <div class="hstat-div"></div>
          <div class="hstat"><span class="hval">Real-time</span><span class="hlbl">Status Tracking</span></div>
          <div class="hstat-div"></div>
          <div class="hstat"><span class="hval">Verified</span><span class="hlbl">Gmail Login</span></div>
        </div>
      </div>
    </section>

    <section class="roles-section">
      <div class="section-label">Login or Sign Up as</div>
      <div class="role-grid">
        ${[
          { icon:'🎒', title:'Student', color:'#1a3c6e', light:'#e8f0fe',
            desc:'Submit anonymous complaints, track status with your complaint ID. Teachers cannot see who filed against them.',
            perks:['Identity hidden from accused teacher','Unique complaint tracking ID','Real-time status updates'] },
          { icon:'👨‍🏫', title:'Teacher / Staff', color:'#1b5e20', light:'#e8f5e9',
            desc:'View complaints in your department. Respond to escalated issues. Student names are never shown to you.',
            perks:['See complaints against you','Provide official response','Cannot see student identity'] },
          { icon:'🏛️', title:'HOD / Principal', color:'#4a148c', light:'#f3e5f5',
            desc:'Full departmental oversight with student identity visible for verification and anti-fake-complaint protection.',
            perks:['See full student identity','Verify complaint authenticity','Escalate or resolve directly'] },
          { icon:'⚙️', title:'Admin', color:'#b71c1c', light:'#ffebee',
            desc:'Complete system control — manage users, complaints, departments, analytics and send official communications.',
            perks:['All complaints + identities','User & department management','Analytics & email notifications'] },
        ].map(r => `
          <div class="role-card" onclick="window.goTo('login')" style="--rc:#${r.color.replace('#','')}; --rl:${r.light};">
            <div class="role-icon-wrap" style="background:${r.light};">${r.icon}</div>
            <h3>${r.title}</h3>
            <p>${r.desc}</p>
            <ul class="role-perks">
              ${r.perks.map(p => `<li><span>✓</span>${p}</li>`).join('')}
            </ul>
            <div class="role-cta">Login as ${r.title} →</div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="how-section">
      <div class="how-inner">
        <div class="section-label" style="text-align:center;">How it works</div>
        <h2 class="section-h2">Your Identity is <span class="text-fire">Always Protected</span></h2>
        <div class="how-grid">
          ${[
            ['🔐','Shield Layer','The accused teacher <strong>can never</strong> see your name or student ID in any view.'],
            ['✅','Verified Accounts','Login via your Google account for identity verification, then set your own site password.'],
            ['👁️','Authority Only','Only HOD, Principal & Admin can see your identity — to prevent fake complaints.'],
            ['📬','Email Alerts','Real email notifications when your complaint status changes.'],
            ['🔑','Complaint ID','Get a private ID to track your complaint anonymously, even without logging in.'],
            ['📊','Transparent','Resolution is always visible to you. Nothing gets buried.'],
          ].map(([icon, title, desc]) => `
            <div class="how-card">
              <div class="how-icon">${icon}</div>
              <div class="how-title">${title}</div>
              <div class="how-desc">${desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="footer-logo">📬</span>
          <span>Digital Complaint Box</span>
        </div>
        <div class="footer-info">
          A.C. Patil College of Engineering, Kharghar, Navi Mumbai – 410210 &nbsp;|&nbsp;
          Mini Project &copy; 2024, Computer Engineering Dept.
        </div>
      </div>
    </footer>
  `;
}
