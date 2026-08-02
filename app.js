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

// Helper: Safe UTF-8 to Base64 encoding for GitHub API (prevents btoa crash)
function utf8_to_b64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window.btoa(binString);
}

// Helper: Safe Base64 to UTF-8 decoding
function b64_to_utf8(str) {
  const binString = window.atob(str);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
  return new TextDecoder().decode(bytes);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  updateTokenUI();
  calculateROI();
  loadData();
  handleHashNavigation();
});

// Handle URL Hash Navigation & Deep Linking
function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) {
    const fullId = 'section-' + hash;
    if (document.getElementById(fullId)) {
      switchTab(fullId, null, false);
      return;
    }
  }
  switchTab('section-overview', null, false);
}

window.addEventListener('hashchange', () => {
  handleHashNavigation();
});

// Navigation / Tab Switching with URL Hash Update
function switchTab(sectionId, element, updateHash = true) {
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  if (element) {
    element.classList.add('active');
  } else {
    // Find matching nav button by sectionId
    const matchBtn = document.querySelector(`.nav-item[onclick*="${sectionId}"]`);
    if (matchBtn) matchBtn.classList.add('active');
  }

  if (updateHash) {
    const cleanHash = sectionId.replace('section-', '');
    window.history.pushState(null, '', `#${cleanHash}`);
  }
}

// Copy Direct Link to Clipboard
function copySectionLink(hashName) {
  const fullUrl = `${window.location.origin}${window.location.pathname}#${hashName}`;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showStatusMessage(`Copied direct link: #${hashName} ✓`);
  }).catch(() => {
    showStatusMessage(`Direct link: #${hashName}`);
  });
}

// Interactive ROI Calculator Logic
function calculateROI() {
  const locality = document.getElementById('calcLocality').value;
  const beds = parseInt(document.getElementById('calcBeds').value) || 1;
  const equipTier = document.getElementById('calcEquip').value;
  const fee = parseFloat(document.getElementById('calcFee').value) || 750;
  const patientsPerDay = parseFloat(document.getElementById('calcPatients').value) || 8;

  let rent = 35000;
  let depositMonths = 6;
  if (locality === 'panathur') { rent = 40000; depositMonths = 6; }
  else if (locality === 'premium') { rent = 60000; depositMonths = 8; }
  else if (locality === 'budget') { rent = 22000; depositMonths = 5; }

  const upfrontDeposit = rent * depositMonths;

  let equipCost = 450000;
  if (equipTier === 'basic') equipCost = 250000;
  else if (equipTier === 'advanced') equipCost = 1000000;

  const interiorCost = 150000 + (beds * 30000);
  const licensingCost = 50000;
  const workingCapitalBuffer = rent * 4;

  const totalUpfront = upfrontDeposit + equipCost + interiorCost + licensingCost + workingCapitalBuffer;
  const grossMonthlyRevenue = fee * patientsPerDay * 25;
  const fixedExpenses = rent + 12000 + (beds * 5000);
  const netMonthlyProfit = grossMonthlyRevenue - fixedExpenses;

  let paybackMonths = "N/A (Operating at Loss)";
  if (netMonthlyProfit > 0) {
    const months = Math.ceil(totalUpfront / netMonthlyProfit);
    paybackMonths = `${months} Months (${(months / 12).toFixed(1)} Years)`;
  }

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

    div.innerHTML = `
      <div class="checkbox" onclick="toggleChecklistItem(${item.id})">
        <i class="fa-solid fa-check"></i>
      </div>
      <div class="item-text" onclick="toggleChecklistItem(${item.id})">${item.text}</div>
      <button class="btn-delete" title="Cut / Delete Task" onclick="deleteChecklistItem(event, ${item.id})">
        <i class="fa-solid fa-trash-can"></i>
      </button>
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

// Delete ("Cut") Checklist Item
function deleteChecklistItem(event, id) {
  event.stopPropagation();
  appState.checklist = appState.checklist.filter(item => item.id !== id);
  renderChecklist();
  saveData();
}

// Add New Checklist Item
function addChecklistItem() {
  const input = document.getElementById('newTaskInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const newItem = {
    id: Date.now(),
    text: text,
    completed: false
  };

  appState.checklist.push(newItem);
  input.value = '';
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

function showStatusMessage(msg, isError = false) {
  const statusElem = document.getElementById('syncStatus');
  if (statusElem) {
    statusElem.innerText = msg;
    statusElem.className = isError ? 'sync-status text-danger' : 'sync-status text-accent';
    setTimeout(() => {
      statusElem.innerText = '';
    }, 4000);
  }
}

// Data Persistence (GitHub REST API Read & Write)
async function loadData() {
  const localSaved = localStorage.getItem('physio_checklist_state');
  if (localSaved) {
    try {
      appState.checklist = JSON.parse(localSaved);
      renderChecklist();
    } catch (e) {}
  }

  try {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?v=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.checklist)) {
        appState.checklist = data.checklist;
        localStorage.setItem('physio_checklist_state', JSON.stringify(appState.checklist));
        renderChecklist();
      }
    }
  } catch (err) {
    console.warn('Using local state.', err);
  }
}

async function saveData() {
  localStorage.setItem('physio_checklist_state', JSON.stringify(appState.checklist));

  if (!appState.token) {
    showStatusMessage('Saved locally ✓');
    return;
  }

  showStatusMessage('Syncing to GitHub...');

  try {
    const getFileRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      headers: { 
        'Authorization': `Bearer ${appState.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = '';
    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      sha = fileData.sha;
    }

    const payloadStr = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      checklist: appState.checklist
    }, null, 2);

    const payload = {
      message: 'Update checklist state via PhysioLaunch BLR Web App',
      content: utf8_to_b64(payloadStr),
      sha: sha || undefined
    };

    const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${appState.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (putRes.ok) {
      showStatusMessage('Synced to GitHub ✓');
    } else {
      showStatusMessage('GitHub sync failed', true);
    }
  } catch (err) {
    showStatusMessage('Saved locally ✓');
  }
}
