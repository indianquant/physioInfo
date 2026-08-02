/* ==========================================================================
   PhysioLaunch BLR — Application Logic & GitHub Persistence API
   ========================================================================== */

const REPO_OWNER = 'indianquant';
const REPO_NAME = 'physioInfo';
const FILE_PATH = 'data.json';

// Global State
let appState = {
  token: localStorage.getItem('gh_pat_token') || '',
  checklist: [
    { id: 1, text: "Complete BPT/MPT Degree & Mandatory 6-Month Internship", completed: true },
    { id: 2, text: "Register with Karnataka State Physiotherapy Council", completed: false },
    { id: 3, text: "Secure Ground Floor / Elevator-Equipped Premises in BLR", completed: false },
    { id: 4, text: "Register Clinic under KPME Act (Karnataka Medical Establishments)", completed: false },
    { id: 5, text: "Obtain BBMP Trade License & BMWM Waste Agreement", completed: false },
    { id: 6, text: "Procure Essential Modalities (TENS, IFT, Ultrasound, Rehab Gear)", completed: false },
    { id: 7, text: "Setup & Verify Google My Business Profile (Direct-to-Consumer Local SEO)", completed: false },
    { id: 8, text: "Secure 6-Month Working Capital Cushion for Rent & Payroll", completed: false }
  ]
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  updateTokenUI();
  calculateROI();
  loadData();
});

// Navigation / Tab Switching
function switchTab(sectionId, element) {
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  if (element) {
    element.classList.add('active');
  }
}

// Interactive ROI Calculator Logic
function calculateROI() {
  const locality = document.getElementById('calcLocality').value;
  const beds = parseInt(document.getElementById('calcBeds').value) || 1;
  const equipTier = document.getElementById('calcEquip').value;
  const fee = parseFloat(document.getElementById('calcFee').value) || 500;
  const patientsPerDay = parseFloat(document.getElementById('calcPatients').value) || 5;

  // Rent & Security Deposit Norms in BLR
  let rent = 35000;
  let depositMonths = 6;
  if (locality === 'premium') { rent = 60000; depositMonths = 8; }
  else if (locality === 'budget') { rent = 22000; depositMonths = 5; }

  const upfrontDeposit = rent * depositMonths;

  // Equipment Cost
  let equipCost = 450000;
  if (equipTier === 'basic') equipCost = 250000;
  else if (equipTier === 'advanced') equipCost = 1000000;

  // Interiors & Licensing
  const interiorCost = 150000 + (beds * 30000);
  const licensingCost = 50000;
  const workingCapitalBuffer = rent * 4;

  const totalUpfront = upfrontDeposit + equipCost + interiorCost + licensingCost + workingCapitalBuffer;

  // Monthly Financials (Assuming 25 Working Days per Month)
  const grossMonthlyRevenue = fee * patientsPerDay * 25;
  const fixedExpenses = rent + 12000 + (beds * 5000); // Rent + Utilities + Consumables
  const netMonthlyProfit = grossMonthlyRevenue - fixedExpenses;

  // Payback Period
  let paybackMonths = "N/A (Operating at Loss)";
  if (netMonthlyProfit > 0) {
    const months = Math.ceil(totalUpfront / netMonthlyProfit);
    paybackMonths = `${months} Months (${(months / 12).toFixed(1)} Years)`;
  }

  // Update UI Metrics
  document.getElementById('resUpfront').innerText = `₹${totalUpfront.toLocaleString('en-IN')}`;
  document.getElementById('resRevenue').innerText = `₹${grossMonthlyRevenue.toLocaleString('en-IN')}/mo`;
  document.getElementById('resExpenses').innerText = `₹${fixedExpenses.toLocaleString('en-IN')}/mo`;
  
  const profitElem = document.getElementById('resProfit');
  profitElem.innerText = `₹${netMonthlyProfit.toLocaleString('en-IN')}/mo`;
  if (netMonthlyProfit >= 0) {
    profitElem.className = 'res-value text-accent';
  } else {
    profitElem.className = 'res-value text-danger';
  }

  document.getElementById('resPayback').innerText = paybackMonths;
}

// Render Checklist
function renderChecklist() {
  const container = document.getElementById('checklistContainer');
  if (!container) return;

  container.innerHTML = '';
  let completedCount = 0;

  appState.checklist.forEach(item => {
    if (item.completed) completedCount++;

    const div = document.createElement('div');
    div.className = `checklist-item ${item.completed ? 'done' : ''}`;
    div.onclick = () => toggleChecklistItem(item.id);

    div.innerHTML = `
      <div class="checkbox"><i class="fa-solid fa-check"></i></div>
      <div class="item-text">${item.text}</div>
    `;

    container.appendChild(div);
  });

  const progressElem = document.getElementById('checkProgress');
  if (progressElem) {
    progressElem.innerText = `${completedCount} of ${appState.checklist.length} completed`;
  }
}

// Toggle Checklist Item
function toggleChecklistItem(id) {
  appState.checklist = appState.checklist.map(item => {
    if (item.id === id) {
      return { ...item, completed: !item.completed };
    }
    return item;
  });

  renderChecklist();
  saveData();
}

// Modal Token Management
function openTokenModal() {
  document.getElementById('tokenInput').value = appState.token;
  document.getElementById('tokenModal').classList.add('active');
}

function closeTokenModal() {
  document.getElementById('tokenModal').classList.remove('active');
}

function saveToken() {
  const token = document.getElementById('tokenInput').value.trim();
  appState.token = token;
  localStorage.setItem('gh_pat_token', token);
  updateTokenUI();
  closeTokenModal();
  saveData();
}

function updateTokenUI() {
  const btnText = document.getElementById('tokenBtnText');
  if (btnText) {
    if (appState.token) {
      btnText.innerText = 'Token Active ✓';
    } else {
      btnText.innerText = 'Set Sync Token';
    }
  }
}

// Data Persistence (GitHub REST API Read & Write)
async function loadData() {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?v=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.checklist) {
        appState.checklist = data.checklist;
      }
    }
  } catch (err) {
    console.warn('Could not fetch data.json from GitHub, using default local state.', err);
  } finally {
    renderChecklist();
  }
}

async function saveData() {
  localStorage.setItem('physio_checklist_state', JSON.stringify(appState.checklist));

  if (!appState.token) {
    return;
  }

  try {
    const getFileRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      headers: { 'Authorization': `token ${appState.token}` }
    });

    let sha = '';
    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      sha = fileData.sha;
    }

    const payload = {
      message: 'Update checklist state via PhysioLaunch BLR Web App',
      content: btoa(JSON.stringify({
        lastUpdated: new Date().toISOString(),
        checklist: appState.checklist
      }, null, 2)),
      sha: sha || undefined
    };

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${appState.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Error saving to GitHub API:', err);
  }
}
