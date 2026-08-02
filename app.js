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
  ],
  clinicDatabase: [],
  filteredClinics: [],
  currentPage: 1,
  pageSize: 10
};

// Helper: Safe UTF-8 to Base64 encoding for GitHub API (prevents btoa crash)
function utf8_to_b64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window.btoa(binString);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  updateTokenUI();
  calculateROI();
  loadData();
  loadClinicDatabase();
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

// Load Clinic Database JSON
async function loadClinicDatabase() {
  try {
    const res = await fetch('bengaluru_physio_clinics.json');
    if (res.ok) {
      appState.clinicDatabase = await res.json();
      filterClinicDatabase();
    }
  } catch (err) {
    console.warn('Could not load bengaluru_physio_clinics.json', err);
  }
}

function filterClinicDatabase() {
  const locFilter = document.getElementById('dbLocalityFilter')?.value || 'ALL';
  const sortFilter = document.getElementById('dbSortFilter')?.value || 'reviews-desc';
  const searchInput = (document.getElementById('dbSearchInput')?.value || '').toLowerCase().trim();

  let list = [...appState.clinicDatabase];

  // Filter Locality
  if (locFilter !== 'ALL') {
    list = list.filter(c => c.locality.toLowerCase().includes(locFilter.toLowerCase()));
  }

  // Filter Search Input
  if (searchInput) {
    list = list.filter(c => 
      c.name.toLowerCase().includes(searchInput) || 
      c.locality.toLowerCase().includes(searchInput) || 
      c.address.toLowerCase().includes(searchInput) ||
      (c.specialization && c.specialization.toLowerCase().includes(searchInput))
    );
  }

  // Sort
  list.sort((a, b) => {
    const aRev = typeof a.reviews === 'number' ? a.reviews : -1;
    const bRev = typeof b.reviews === 'number' ? b.reviews : -1;
    const aRat = typeof a.rating === 'number' ? a.rating : -1;
    const bRat = typeof b.rating === 'number' ? b.rating : -1;
    const aMps = typeof a.mps_score === 'number' ? a.mps_score : -1;
    const bMps = typeof b.mps_score === 'number' ? b.mps_score : -1;

    if (sortFilter === 'reviews-desc') return bRev - aRev;
    if (sortFilter === 'rating-desc') return bRat - aRat;
    if (sortFilter === 'mps-desc') return bMps - aMps;
    return 0;
  });

  appState.filteredClinics = list;
  appState.currentPage = 1;
  renderClinicDatabase();
}

function renderClinicDatabase() {
  const tbody = document.getElementById('clinicTableBody');
  const recordCountBadge = document.getElementById('recordCountText');
  const pageNumbersText = document.getElementById('pageNumbersText');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');

  if (!tbody) return;

  const totalRecords = appState.filteredClinics.length;
  const pageSizeVal = appState.pageSize;

  let pageSlice = appState.filteredClinics;
  let totalPages = 1;

  if (pageSizeVal !== 'ALL') {
    const size = parseInt(pageSizeVal) || 10;
    totalPages = Math.ceil(totalRecords / size) || 1;
    if (appState.currentPage > totalPages) appState.currentPage = totalPages;
    
    const startIdx = (appState.currentPage - 1) * size;
    const endIdx = startIdx + size;
    pageSlice = appState.filteredClinics.slice(startIdx, endIdx);

    const showingStart = totalRecords === 0 ? 0 : startIdx + 1;
    const showingEnd = Math.min(endIdx, totalRecords);
    if (recordCountBadge) {
      recordCountBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Showing <strong>${showingStart} – ${showingEnd}</strong> of <strong>${totalRecords}</strong> total clinics (Fetched ${appState.clinicDatabase.length})`;
    }
  } else {
    if (recordCountBadge) {
      recordCountBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Showing all <strong>${totalRecords}</strong> clinics (Fetched ${appState.clinicDatabase.length})`;
    }
  }

  if (pageNumbersText) {
    pageNumbersText.innerText = `Page ${appState.currentPage} of ${totalPages}`;
  }

  if (btnPrev) btnPrev.disabled = appState.currentPage <= 1;
  if (btnNext) btnNext.disabled = appState.currentPage >= totalPages || pageSizeVal === 'ALL';

  tbody.innerHTML = '';

  if (pageSlice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 20px;">No clinics matching filter criteria.</td></tr>`;
    return;
  }

  pageSlice.forEach(c => {
    const tr = document.createElement('tr');
    
    const ratingDisplay = (typeof c.rating === 'number') 
      ? `<i class="fa-solid fa-star text-warning"></i> <strong>${c.rating}</strong> (${c.reviews} revs)` 
      : `N/A`;

    const feeDisplay = c.fee_range || 'N/A';
    const praiseDisplay = (c.top_praise && c.top_praise !== 'N/A') ? `✔ ${c.top_praise}` : `N/A`;
    const sentimentDisplay = (c.sentiment_pct && c.sentiment_pct !== 'N/A') ? `${c.sentiment_pct} positive` : `N/A`;

    tr.innerHTML = `
      <td>
        <strong>${c.name}</strong>
        <br><small class="text-accent" style="font-weight:600;"><i class="fa-solid fa-stethoscope"></i> ${c.specialization || 'N/A'}</small>
        <br><small class="text-muted">${c.address}</small>
      </td>
      <td><span class="chip chip-blue">${c.locality}</span></td>
      <td><span class="mark" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">${feeDisplay}</span></td>
      <td>
        ${ratingDisplay}
        <br><small class="text-muted">${sentimentDisplay}</small>
      </td>
      <td>
        <div style="font-size: 0.8rem; line-height: 1.3;">
          <span class="text-muted">${praiseDisplay}</span>
        </div>
      </td>
      <td><span class="mark">${c.mps_score || 'N/A'}</span></td>
      <td>
        <a href="${c.google_maps_url}" target="_blank" class="btn btn-token" style="padding: 4px 8px; font-size: 0.75rem;">
          <i class="fa-solid fa-map-pin"></i> Map
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function changePage(delta) {
  appState.currentPage += delta;
  renderClinicDatabase();
}

function changePageSize() {
  const sizeVal = document.getElementById('dbPageSize').value;
  appState.pageSize = sizeVal;
  appState.currentPage = 1;
  renderClinicDatabase();
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
    statusElem.className = isError ? 'sync-status text-accent' : 'sync-status text-accent';
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
