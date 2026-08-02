/* =============================================================
   PhysioLaunch BLR — Application Logic
   GitHub Repo: indianquant/physioInfo
   ============================================================= */

const REPO_OWNER = 'indianquant';
const REPO_NAME  = 'physioInfo';
const FILE_PATH  = 'data.json';

// ─── Checklist Data ─────────────────────────────────────────
const DEFAULT_CHECKLIST = [
  { id: 1, text: 'Complete BPT/MPT degree and mandatory 6-month internship', done: false },
  { id: 2, text: 'Register with Karnataka State Physiotherapy Council', done: false },
  { id: 3, text: 'Identify ground-floor / elevator-access premises in target BLR locality', done: false },
  { id: 4, text: 'Register clinic under KPME Act (Karnataka Private Medical Establishments)', done: false },
  { id: 5, text: 'Obtain BBMP Trade License and Biomedical Waste Management (BMWM) authorization', done: false },
  { id: 6, text: 'Get Fire Safety NOC from Karnataka Fire and Emergency Services', done: false },
  { id: 7, text: 'Procure core equipment: TENS, IFT, Ultrasound, Traction, Rehab gear', done: false },
  { id: 8, text: 'Set up Google My Business profile and collect initial patient reviews', done: false },
];

// ─── App State ───────────────────────────────────────────────
const state = {
  token: localStorage.getItem('gh_pat') || '',
  checklist: loadLocalChecklist(),
};

function loadLocalChecklist() {
  try {
    const saved = localStorage.getItem('physio_checklist');
    return saved ? JSON.parse(saved) : DEFAULT_CHECKLIST.map(i => ({ ...i }));
  } catch { return DEFAULT_CHECKLIST.map(i => ({ ...i })); }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  calculateROI();
  renderChecklist();
  // Try loading from GitHub (no token needed — public raw URL)
  loadRemoteData();
  // Scroll spy for nav active states
  setupScrollSpy();
});

// ─── NAVIGATION ──────────────────────────────────────────────
function navClick(el) {
  event.preventDefault();

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  el.classList.add('active');

  // Show the right section
  const target = el.getAttribute('href').replace('#', '');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(target);
  if (sec) sec.classList.add('active');

  // Scroll content area to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupScrollSpy() {
  // Update nav based on hash if someone links directly
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const link = document.querySelector(`.nav-link[href="#${hash}"]`);
    if (link) navClick(link);
  }
}

// ─── ROI CALCULATOR ──────────────────────────────────────────
function calculateROI() {
  const locality    = document.getElementById('calcLocality')?.value || 'standard';
  const beds        = parseInt(document.getElementById('calcBeds')?.value) || 3;
  const equipTier   = document.getElementById('calcEquip')?.value || 'standard';
  const fee         = parseFloat(document.getElementById('calcFee')?.value) || 700;
  const patientsDay = parseFloat(document.getElementById('calcPatients')?.value) || 8;

  // Locality params
  const locality_data = {
    premium:  { rent: 65000, depositMonths: 8  },
    standard: { rent: 38000, depositMonths: 6  },
    budget:   { rent: 24000, depositMonths: 5  },
  };
  const { rent, depositMonths } = locality_data[locality];

  // Equipment cost
  const equip_cost = { basic: 250000, standard: 450000, advanced: 1000000 };
  const equipCost = equip_cost[equipTier];

  // Upfront total
  const deposit    = rent * depositMonths;
  const interiors  = 150000 + beds * 25000;
  const licensing  = 50000;
  const buffer     = rent * 4;                  // 4-month working capital
  const upfront    = deposit + equipCost + interiors + licensing + buffer;

  // Monthly
  const revenue    = fee * patientsDay * 25;    // 25 working days
  const expenses   = rent + 12000 + 25000;      // rent + utilities + 1 junior staff
  const profit     = revenue - expenses;

  // Payback
  let payback = 'Operating at a loss';
  if (profit > 0) {
    const months = Math.ceil(upfront / profit);
    payback = `~${months} months (${(months / 12).toFixed(1)} yrs)`;
  }

  // Render
  set('resUpfront',  `₹${fmt(upfront)}`);
  set('resRevenue',  `₹${fmt(revenue)}/mo`);
  set('resExpenses', `₹${fmt(expenses)}/mo`);
  set('resPayback',  payback);

  const profitEl = document.getElementById('resProfit');
  if (profitEl) {
    profitEl.textContent = profit >= 0 ? `₹${fmt(profit)}/mo` : `−₹${fmt(Math.abs(profit))}/mo`;
    profitEl.className   = 'result-val ' + (profit >= 0 ? 'result-pos' : 'result-neg');
  }
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-IN');
}

// ─── CHECKLIST ───────────────────────────────────────────────
function renderChecklist() {
  const container = document.getElementById('checklistContainer');
  if (!container) return;

  container.innerHTML = '';
  let done = 0;

  state.checklist.forEach(item => {
    if (item.done) done++;

    const div = document.createElement('div');
    div.className = 'checklist-item' + (item.done ? ' done' : '');
    div.onclick = () => toggleItem(item.id);

    div.innerHTML = `
      <div class="check-box">${item.done ? '✓' : ''}</div>
      <div class="check-text">${item.text}</div>
    `;
    container.appendChild(div);
  });

  // Progress
  const total = state.checklist.length;
  const pct   = Math.round((done / total) * 100);
  const fill  = document.getElementById('progressFill');
  if (fill) fill.style.width = pct + '%';
  set('checkProgress', `${done} of ${total} completed`);
}

function toggleItem(id) {
  state.checklist = state.checklist.map(i =>
    i.id === id ? { ...i, done: !i.done } : i
  );
  persistChecklist();
  renderChecklist();
}

function persistChecklist() {
  localStorage.setItem('physio_checklist', JSON.stringify(state.checklist));
  if (state.token) syncToGitHub();
}

// ─── GITHUB DATA PERSISTENCE ─────────────────────────────────
async function loadRemoteData() {
  try {
    const url  = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) return;

    const data = await resp.json();
    if (data?.checklist && Array.isArray(data.checklist)) {
      state.checklist = data.checklist;
      localStorage.setItem('physio_checklist', JSON.stringify(state.checklist));
      renderChecklist();
    }
  } catch (err) {
    console.info('Could not reach GitHub raw data — using local state.', err);
  }
}

async function syncToGitHub() {
  if (!state.token) return;
  try {
    // Get current SHA
    const headResp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${state.token}` } }
    );
    let sha = '';
    if (headResp.ok) sha = (await headResp.json()).sha;

    const content = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      checklist: state.checklist,
    }, null, 2);

    const putResp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      {
        method:  'PUT',
        headers: {
          Authorization:  `token ${state.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Update checklist [PhysioLaunch BLR]',
          content: btoa(unescape(encodeURIComponent(content))),
          sha,
        }),
      }
    );
    if (!putResp.ok) console.warn('GitHub sync failed:', await putResp.text());
  } catch (err) {
    console.warn('GitHub sync error:', err);
  }
}

// ─── TOKEN MODAL ─────────────────────────────────────────────
function openTokenModal() {
  document.getElementById('tokenInput').value = state.token;
  document.getElementById('tokenModal').classList.add('active');
}

function closeTokenModal() {
  document.getElementById('tokenModal').classList.remove('active');
}

function saveToken() {
  const t = document.getElementById('tokenInput').value.trim();
  state.token = t;
  localStorage.setItem('gh_pat', t);
  closeTokenModal();
  if (t) syncToGitHub();
}
