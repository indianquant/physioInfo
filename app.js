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

// Helper: Escape HTML to prevent XSS and ReferenceErrors
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

// Mobile Navigation Sidebar Drawer Toggle
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

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

  // Close mobile sidebar drawer if open
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }

  if (updateHash) {
    const cleanHash = sectionId.replace('section-', '');
    window.history.pushState(null, '', `#${cleanHash}`);
  }

  if (sectionId === 'section-radius') {
    setTimeout(() => {
      initNeopolisMap();
      if (neopolisMap) neopolisMap.invalidateSize();
      filterNeopolisRadius();
    }, 150);
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
      filterNeopolisRadius();
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

    const feeDisplay = c.fee_range || 'N/A (Contact Clinic)';
    const praiseDisplay = (c.top_praise && c.top_praise !== 'N/A') ? `✔ ${c.top_praise}` : `N/A`;
    const sentimentDisplay = (c.sentiment_pct && c.sentiment_pct !== 'N/A') ? `${c.sentiment_pct} positive` : `N/A`;

    const phoneDisplay = (c.phone && c.phone !== 'N/A') 
      ? `<br><a href="tel:${c.phone}" class="btn-tel" style="font-size: 0.75rem; color: #34d399; text-decoration: none; margin-top: 3px; display: inline-block;"><i class="fa-solid fa-phone"></i> ${c.phone}</a>` 
      : ``;

    const websiteDisplay = (c.website && c.website !== 'N/A') 
      ? `<br><a href="${c.website}" target="_blank" style="font-size: 0.75rem; color: #60a5fa; text-decoration: underline; margin-top: 3px; display: inline-block;"><i class="fa-solid fa-globe"></i> ${c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 22)}...</a>` 
      : ``;

    const hoursDisplay = (c.opening_hours && c.opening_hours !== 'N/A')
      ? `<br><small class="text-muted" style="font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> ${c.opening_hours}</small>`
      : ``;

    tr.innerHTML = `
      <td>
        <strong>${c.name}</strong>
        <br><small class="text-accent" style="font-weight:600;"><i class="fa-solid fa-stethoscope"></i> ${c.specialization || 'N/A'}</small>
        <br><small class="text-muted">${c.address}</small>
        ${hoursDisplay}
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
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <a href="${c.google_maps_url}" target="_blank" class="btn btn-token" style="padding: 4px 8px; font-size: 0.75rem;">
            <i class="fa-solid fa-map-pin"></i> Map
          </a>
          ${phoneDisplay}
          ${websiteDisplay}
        </div>
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
// ─── ROI Calculator: Real Rental & Equipment Data (mid-2026) ─────────────────
const CALC_RENT_DATA = {
  panathur_internal: { rent: 30000, deposit: 6, label: 'Panathur Internal Road' },
  panathur_main:     { rent: 42000, deposit: 6, label: 'Panathur Main / ORR' },
  bellandur:         { rent: 35000, deposit: 6, label: 'Bellandur' },
  sarjapur:          { rent: 28000, deposit: 5, label: 'Sarjapur Road Internal' },
  whitefield:        { rent: 39000, deposit: 6, label: 'Whitefield / ITPL' },
  premium:           { rent: 70000, deposit: 8, label: 'Prime Hub (HSR/Indiranagar)' }
};

const CALC_EQUIP_DATA = {
  basic:    { cost: 180000,  label: 'Basic (Combo+Hydrocollator+Traction+Tables+Bands)' },
  medium:   { cost: 450000,  label: 'Medium (IFT+US+SWD+Motorized Traction+LLLT)' },
  advanced: { cost: 1200000, label: 'Advanced (Class IV Laser+EMG/NMES+CPM+Full Suite)' }
};

const CALC_TIER_INTERIORS = {
  compact:  { interior: 125000, bays: 2 },
  standard: { interior: 275000, bays: 4 },
  sports:   { interior: 750000, bays: 6 }
};

function loadCalcPreset(tier) {
  document.querySelectorAll('.calc-preset-btn').forEach(b => b.classList.remove('active-preset'));
  event.currentTarget.classList.add('active-preset');

  const presets = {
    compact: {
      locality: 'panathur_internal', clinicTier: 'compact',
      equip: 'basic', fee: 700, patients: 12, staff: '0'
    },
    standard: {
      locality: 'whitefield', clinicTier: 'standard',
      equip: 'medium', fee: 800, patients: 20, staff: '1'
    },
    sports: {
      locality: 'whitefield', clinicTier: 'sports',
      equip: 'advanced', fee: 1000, patients: 35, staff: '2'
    }
  };

  const p = presets[tier];
  if (!p) return;

  const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
  setVal('calcLocality', p.locality);
  setVal('calcClinicTier', p.clinicTier);
  setVal('calcEquip', p.equip);
  setVal('calcFee', p.fee);
  setVal('calcPatients', p.patients);
  setVal('calcStaff', p.staff);
  calculateROI();
}

function calculateROI() {
  const locality    = document.getElementById('calcLocality')?.value || 'whitefield';
  const clinicTier  = document.getElementById('calcClinicTier')?.value || 'standard';
  const equipTier   = document.getElementById('calcEquip')?.value || 'medium';
  const fee         = parseFloat(document.getElementById('calcFee')?.value) || 800;
  const patientsDay = parseFloat(document.getElementById('calcPatients')?.value) || 15;
  const staffCount  = parseInt(document.getElementById('calcStaff')?.value) || 1;

  const rentInfo    = CALC_RENT_DATA[locality]    || CALC_RENT_DATA.whitefield;
  const equipInfo   = CALC_EQUIP_DATA[equipTier]  || CALC_EQUIP_DATA.medium;
  const tierInfo    = CALC_TIER_INTERIORS[clinicTier] || CALC_TIER_INTERIORS.standard;

  // Scale rent by clinic tier (larger spaces cost more)
  const tierRentMultiplier = { compact: 0.7, standard: 1.0, sports: 1.65 };
  const rent = Math.round(rentInfo.rent * (tierRentMultiplier[clinicTier] || 1.0));

  const deposit       = rent * rentInfo.deposit;
  const equipCost     = equipInfo.cost;
  const interiorCost  = tierInfo.interior;
  const licensingCost = clinicTier === 'compact' ? 40000 : clinicTier === 'standard' ? 65000 : 115000;
  const workingCap    = rent * 5; // 5-month buffer

  const totalUpfront  = deposit + equipCost + interiorCost + licensingCost + workingCap;

  // Monthly revenue & costs
  const grossRevenue  = fee * patientsDay * 25;
  const staffCost     = staffCount * 15000;
  const utilities     = 5000 + (tierInfo.bays * 3000);
  const fixedExpenses = rent + staffCost + utilities;
  const netProfit     = grossRevenue - fixedExpenses;
  const margin        = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : 0;

  let payback = 'Operating at Loss';
  if (netProfit > 0) {
    const m = Math.ceil(totalUpfront / netProfit);
    payback = `${m} months (${(m/12).toFixed(1)} yrs)`;
  }

  const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');

  const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
  set('resDeposit',   fmt(deposit));
  set('resEquipCost', fmt(equipCost));
  set('resInterior',  fmt(interiorCost));
  set('resLegal',     fmt(licensingCost + workingCap));
  set('resUpfront',   fmt(totalUpfront));
  set('resRevenue',   fmt(grossRevenue) + '/mo');
  set('resExpenses',  fmt(fixedExpenses) + '/mo');
  set('resPayback',   payback);
  set('resMargin',    margin + '%');

  const profitElem = document.getElementById('resProfit');
  if (profitElem) {
    profitElem.innerText = fmt(netProfit) + '/mo';
    profitElem.className = 'res-value ' + (netProfit >= 0 ? 'text-accent' : 'text-danger');
  }
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

/* ==========================================================================
   Sobha Neopolis Proximity Map & Distance Matrix Logic (Leaflet.js)
   ========================================================================== */

let neopolisMap = null;
let neopolisMarkers = [];
let neopolisCircle = null;

const SOBHA_NEOPOLIS_COORDS = [12.9348, 77.7128]; // Panathur Main Road

function initNeopolisMap() {
  const mapContainer = document.getElementById('neopolisMap');
  if (!mapContainer || typeof L === 'undefined') return;

  if (neopolisMap) {
    neopolisMap.invalidateSize();
    filterNeopolisRadius();
    return;
  }

  neopolisMap = L.map('neopolisMap').setView(SOBHA_NEOPOLIS_COORDS, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(neopolisMap);

  const homeIcon = L.divIcon({
    className: 'home-marker-pin',
    html: '<div style="background-color: #ef4444; color: white; border-radius: 20px; padding: 6px 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 0 15px rgba(239, 68, 68, 0.9); font-size: 12px; white-space: nowrap;"><i class="fa-solid fa-house"></i> HOME</div>',
    iconSize: [100, 32],
    iconAnchor: [50, 16]
  });

  L.marker(SOBHA_NEOPOLIS_COORDS, { icon: homeIcon }).addTo(neopolisMap)
    .bindPopup('<b>Home Anchor Base (Sobha Neopolis)</b><br>Panathur Main Road, East Bengaluru<br>Lat: 12.9348° N, Lng: 77.7128° E');

  filterNeopolisRadius();
}

function recenterNeopolisMap() {
  if (neopolisMap) {
    neopolisMap.setView(SOBHA_NEOPOLIS_COORDS, 13);
  }
}

function filterNeopolisRadius() {
  if (!appState.clinicDatabase || appState.clinicDatabase.length === 0) return;

  const select = document.getElementById('radiusFilterSelect');
  const maxRadius = select ? select.value : '5';

  let filtered = appState.clinicDatabase.filter(c => {
    const dist = c.distance_km !== undefined ? c.distance_km : 999;
    if (maxRadius === 'ALL') return true;
    return dist <= parseFloat(maxRadius);
  });

  filtered.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));

  renderNeopolisMapAndTable(filtered, maxRadius);
}

function renderNeopolisMapAndTable(clinics, radiusVal) {
  const tbody = document.getElementById('radiusTableBody');
  const summaryBadge = document.getElementById('radiusRecordSummary');

  if (summaryBadge) {
    const label = radiusVal === 'ALL' ? 'All Bengaluru' : `< ${radiusVal} km`;
    summaryBadge.innerHTML = `<i class="fa-solid fa-house"></i> Showing <strong>${clinics.length}</strong> standalone physio clinics within <strong>${label}</strong> of Home`;
  }

  if (tbody) {
    if (clinics.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No clinics found within this distance radius.</td></tr>`;
    } else {
      tbody.innerHTML = clinics.map((c, idx) => `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td>
            <div class="clinic-name-cell">
              <strong>${escapeHtml(c.name)}</strong>
              <span class="clinic-sub-spec">${escapeHtml(c.specialization || 'Physiotherapy & Rehab')}</span>
            </div>
          </td>
          <td><span class="locality-badge"><i class="fa-solid fa-location-arrow"></i> ${escapeHtml(c.locality)}</span></td>
          <td>
            <span class="distance-badge ${c.distance_km <= 2 ? 'dist-near' : c.distance_km <= 5 ? 'dist-mid' : 'dist-far'}">
              <i class="fa-solid fa-route"></i> ${c.distance_km} km
            </span>
          </td>
          <td>
            <div class="rating-box">
              <span class="star-rating"><i class="fa-solid fa-star"></i> ${c.rating || 'N/A'}</span>
              <span class="review-count">(${c.reviews || 0} reviews)</span>
            </div>
          </td>
          <td>
            <a href="${c.google_maps_url}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="fa-solid fa-map-location-dot"></i> View Pin
            </a>
          </td>
        </tr>
      `).join('');
    }
  }

  if (neopolisMap) {
    neopolisMarkers.forEach(m => neopolisMap.removeLayer(m));
    neopolisMarkers = [];
    if (neopolisCircle) neopolisMap.removeLayer(neopolisCircle);

    if (radiusVal !== 'ALL') {
      const radiusMeters = parseFloat(radiusVal) * 1000;
      neopolisCircle = L.circle(SOBHA_NEOPOLIS_COORDS, {
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.12,
        radius: radiusMeters
      }).addTo(neopolisMap);
    }

    clinics.forEach(c => {
      if (c.lat && c.lng) {
        const marker = L.marker([c.lat, c.lng]).addTo(neopolisMap);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; color: #1e293b;">
            <strong style="font-size: 14px; color: #0f172a;">${escapeHtml(c.name)}</strong><br>
            <span style="color: #64748b;">${escapeHtml(c.locality)} • <strong style="color: #6366f1;">${c.distance_km} km from Home</strong></span><br>
            <div style="margin-top: 5px;">
              <span style="color: #f59e0b; font-weight: bold;">★ ${c.rating}</span> (${c.reviews} reviews)<br>
              <a href="${c.google_maps_url}" target="_blank" style="color: #6366f1; font-weight: bold; display: inline-block; margin-top: 6px; text-decoration: underline;">Open Google Maps Pin →</a>
            </div>
          </div>
        `);
        neopolisMarkers.push(marker);
      }
    });
  }
}

/* ==========================================================================
   In-Browser AI Research Assistant Chatbot (Scoped Knowledge RAG)
   ========================================================================== */

function toggleAIChat() {
  const win = document.getElementById('chatWindow');
  if (win) {
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
      document.getElementById('chatInput')?.focus();
    }
  }
}

function clearAIChat() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = `
      <div class="chat-msg bot">
        <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-content">
          <p>Chat cleared! How can I assist your Bengaluru clinic research today?</p>
        </div>
      </div>
    `;
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter') {
    submitAIChat();
  }
}

function sendSuggestedQuery(text) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    submitAIChat();
  }
}

function appendChatMessage(role, textHtml) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  
  const icon = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
  
  msgDiv.innerHTML = `
    <div class="msg-avatar">${icon}</div>
    <div class="msg-content">${textHtml}</div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function submitAIChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  appendChatMessage('user', `<p>${escapeHtml(query)}</p>`);
  input.value = '';

  // ── Mansi Suggestion Mode: /suggest <content> ──────────────────────────────
  // Any visitor can prefix their message with /suggest to submit a content
  // suggestion. It is saved to suggestions.json in the GitHub repo via API.
  const suggestMatch = query.match(/^\/suggest\s+(.+)/is);
  if (suggestMatch) {
    const suggestion = suggestMatch[1].trim();
    appendChatMessage('bot', `
      <p>📝 <strong>Suggestion received!</strong> Saving to the repository...</p>
      <p style="font-size:0.8rem; color: var(--text-muted);">Your suggestion: <em>${escapeHtml(suggestion)}</em></p>
    `);
    submitSuggestionToGitHub(suggestion);
    return;
  }

  const container = document.getElementById('chatMessages');
  const tempBotId = 'bot-thinking-' + Date.now();
  const tempDiv = document.createElement('div');
  tempDiv.className = 'chat-msg bot';
  tempDiv.id = tempBotId;
  tempDiv.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="msg-content"><p><i class="fa-solid fa-circle-notch fa-spin text-accent"></i> Searching site scope & 568 clinic database...</p></div>
  `;
  container.appendChild(tempDiv);
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    document.getElementById(tempBotId)?.remove();
    const botAnswer = generateScopedAIResponse(query);
    appendChatMessage('bot', botAnswer);
  }, 400);
}

// ── Mansi Remote Suggestion System ────────────────────────────────────────────
// Submits a suggestion to GitHub via the API, which stores it in suggestions.json
// The site reads this file on load and displays community suggestions.
async function submitSuggestionToGitHub(suggestionText) {
  const token = appState.token || localStorage.getItem('gh_pat_token');
  const author = document.getElementById('suggestionAuthor')?.value?.trim() || 'Anonymous';

  if (!token) {
    appendChatMessage('bot', `
      <p>⚠️ <strong>No GitHub token set.</strong> Please set your sync token via the <strong>"Set Sync Token"</strong> button to enable remote suggestions.</p>
      <p style="font-size:0.8rem; color: var(--text-muted);">Your suggestion has been noted locally. Ask the site owner to add it manually.</p>
    `);
    // Still show it locally
    addLocalSuggestionDisplay(author, suggestionText);
    return;
  }

  try {
    // 1. Fetch existing suggestions.json (to get SHA for update)
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    let existingSuggestions = [];
    let fileSHA = null;

    const getResp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/suggestions.json`, { headers });
    if (getResp.ok) {
      const data = await getResp.json();
      fileSHA = data.sha;
      existingSuggestions = JSON.parse(atob(data.content.replace(/\n/g, '')));
    }

    // 2. Append new suggestion
    const newEntry = {
      id: Date.now(),
      author: author,
      text: suggestionText,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    existingSuggestions.push(newEntry);

    // 3. Commit back to GitHub
    const body = {
      message: `💡 New suggestion from ${author}: ${suggestionText.slice(0, 60)}`,
      content: utf8_to_b64(JSON.stringify(existingSuggestions, null, 2)),
      ...(fileSHA ? { sha: fileSHA } : {})
    };

    const putResp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/suggestions.json`, {
      method: 'PUT', headers, body: JSON.stringify(body)
    });

    if (putResp.ok) {
      appendChatMessage('bot', `
        <p>✅ <strong>Suggestion saved!</strong> It has been committed to the repository.</p>
        <p style="font-size:0.8rem; color: var(--text-muted);">🔄 The site will reflect approved suggestions on next page load. Suggestion ID: <code>${newEntry.id}</code></p>
        <p style="font-size:0.8rem;">📋 <strong>${author}</strong> suggested: <em>${escapeHtml(suggestionText)}</em></p>
      `);
      addLocalSuggestionDisplay(author, suggestionText);
    } else {
      throw new Error('GitHub API returned ' + putResp.status);
    }
  } catch(err) {
    appendChatMessage('bot', `
      <p>❌ <strong>Could not save remotely</strong>: ${err.message}</p>
      <p style="font-size:0.8rem; color: var(--text-muted);">Tip: Ensure your GitHub token has <code>public_repo</code> or <code>contents:write</code> scope.</p>
    `);
  }
}

function addLocalSuggestionDisplay(author, text) {
  let box = document.getElementById('suggestionsFeed');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'suggestion-item';
  el.innerHTML = `
    <span class="sug-author"><i class="fa-solid fa-user-pen"></i> ${escapeHtml(author)}</span>
    <span class="sug-text">${escapeHtml(text)}</span>
    <span class="sug-ts">${new Date().toLocaleString('en-IN')}</span>
  `;
  box.prepend(el);
  box.style.display = 'block';
}

// Load existing suggestions from GitHub on page load
async function loadSuggestionsFromGitHub() {
  try {
    const resp = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/suggestions.json?t=${Date.now()}`);
    if (!resp.ok) return;
    const suggestions = await resp.json();
    const feed = document.getElementById('suggestionsFeed');
    if (!feed || !suggestions.length) return;

    suggestions.slice(-5).reverse().forEach(s => {
      const el = document.createElement('div');
      el.className = 'suggestion-item';
      el.innerHTML = `
        <span class="sug-author"><i class="fa-solid fa-user-pen"></i> ${escapeHtml(s.author || 'Anonymous')}</span>
        <span class="sug-text">${escapeHtml(s.text)}</span>
        <span class="sug-ts">${new Date(s.timestamp).toLocaleDateString('en-IN')}</span>
      `;
      feed.appendChild(el);
    });
    feed.style.display = 'flex';
  } catch(e) { /* No suggestions file yet — that's fine */ }
}

function generateScopedAIResponse(q) {
  const queryLower = q.toLowerCase();

  // 1. Closest clinics / Panathur / Sobha Neopolis queries
  if (queryLower.includes('neopolis') || queryLower.includes('home') || queryLower.includes('panathur') || queryLower.includes('close') || queryLower.includes('near')) {
    const sorted = [...appState.clinicDatabase].sort((a,b) => (a.distance_km || 0) - (b.distance_km || 0)).slice(0, 4);
    let listHtml = sorted.map(c => `
      <li style="margin-bottom: 6px;">
        <strong>${escapeHtml(c.name)}</strong> (${c.distance_km} km from Home)<br>
        <span style="color: #f59e0b;">★ ${c.rating}</span> (${c.reviews} reviews) • <em>${escapeHtml(c.locality)}</em>
      </li>
    `).join('');

    return `
      <p>📍 <strong>Clinics Nearest to Home (Sobha Neopolis, Panathur):</strong></p>
      <ul style="padding-left: 16px; margin: 8px 0;">${listHtml}</ul>
      <p>👉 View full proximity map on the <a href="#radius" onclick="switchTab('section-radius', null)" style="color: #60a5fa; text-decoration: underline;">Home Proximity Tab</a>.</p>
    `;
  }

  // 2. KPME Act / Setup / Legal queries
  if (queryLower.includes('kpme') || queryLower.includes('legal') || queryLower.includes('license') || queryLower.includes('setup') || queryLower.includes('bbmp') || queryLower.includes('bmwm')) {
    return `
      <p>📋 <strong>KPME Act & Legal Registration Checklist (Bengaluru):</strong></p>
      <ol style="padding-left: 16px; margin: 8px 0; font-size: 0.82rem;">
        <li><strong>KPME Registration</strong>: Mandatory registration with District Health Officer (DHO) under Karnataka Private Medical Establishments Act.</li>
        <li><strong>BBMP Trade License</strong>: Annual health/trade license from Bruhat Bengaluru Mahanagara Palike.</li>
        <li><strong>BMWM Agreement</strong>: Bio-Medical Waste Management agreement with authorized vendor (e.g. Maridi Eco Industries).</li>
        <li><strong>KSPC Registration</strong>: Doctor BPT/MPT registration with Karnataka State Physiotherapy Council.</li>
      </ol>
      <p>👉 Details & links on the <a href="#setup" onclick="switchTab('section-setup', null)" style="color: #60a5fa; text-decoration: underline;">Setup & Legal Tab</a>.</p>
    `;
  }

  // 3. Rent / Budget / Cost queries
  if (queryLower.includes('cost') || queryLower.includes('rent') || queryLower.includes('budget') || queryLower.includes('deposit') || queryLower.includes('money') || queryLower.includes('investment')) {
    return `
      <p>💰 <strong>Bengaluru Commercial Budget Breakdown:</strong></p>
      <ul style="padding-left: 16px; margin: 8px 0; font-size: 0.82rem;">
        <li><strong>Monthly Rent</strong>: ₹35,000 – ₹70,000 / month (Panathur / Kadubeesanahalli ground floor).</li>
        <li><strong>Security Deposit</strong>: 6 – 10 Months Advance (₹2.5L – ₹5.0L upfront).</li>
        <li><strong>Interiors & Gear</strong>: ₹2.0L – ₹4.5L (TENS, IFT, Ultrasound, Treatment couches).</li>
      </ul>
      <p>👉 Customize your figures on the <a href="#calculator" onclick="switchTab('section-calculator', null)" style="color: #60a5fa; text-decoration: underline;">Startup ROI Calculator</a>.</p>
    `;
  }

  // 4. Failure reasons / Challenges queries
  if (queryLower.includes('fail') || queryLower.includes('risk') || queryLower.includes('challenge') || queryLower.includes('mistake') || queryLower.includes('pitfall')) {
    return `
      <p>⚠️ <strong>Top 3 Reasons Physio Clinics Fail in Bengaluru:</strong></p>
      <ol style="padding-left: 16px; margin: 8px 0; font-size: 0.82rem;">
        <li><strong>Excessive Rental Deposit Drain</strong>: Locking ₹5L+ in 10-month deposits before establishing patient cashflow.</li>
        <li><strong>Over-reliance on Physician Referrals</strong>: Failing to build direct Google Local SEO & community presence in gated townships.</li>
        <li><strong>Traffic Bottleneck Accessibility</strong>: Locating past railway underpasses (e.g. Panathur bottleneck) that deter patients during peak hours.</li>
      </ol>
      <p>👉 Read cited case studies on the <a href="#failure" onclick="switchTab('section-failure', null)" style="color: #60a5fa; text-decoration: underline;">Failure Patterns Tab</a>.</p>
    `;
  }

  // 5. Keyword search across dataset
  const matches = appState.clinicDatabase.filter(c => 
    c.name.toLowerCase().includes(queryLower) || 
    c.locality.toLowerCase().includes(queryLower) ||
    c.specialization.toLowerCase().includes(queryLower)
  ).slice(0, 3);

  if (matches.length > 0) {
    let matchHtml = matches.map(c => `
      <li style="margin-bottom: 6px;">
        <strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.locality)})<br>
        Rating: <span style="color: #f59e0b;">★ ${c.rating}</span> (${c.reviews} reviews) • Distance: ${c.distance_km} km
      </li>
    `).join('');

    return `
      <p>🔍 <strong>Found matching clinics in dataset:</strong></p>
      <ul style="padding-left: 16px; margin: 8px 0;">${matchHtml}</ul>
      <p>👉 Explore all 568 clinics on the <a href="#database" onclick="switchTab('section-database', null)" style="color: #60a5fa; text-decoration: underline;">Live Database Explorer</a>.</p>
    `;
  }

  // Default fallback answer
  return `
    <p>🤖 I analyzed your query within the <strong>PhysioInfo BLR Website Scope</strong>.</p>
    <p>You can research:</p>
    <ul style="padding-left: 16px; margin: 6px 0; font-size: 0.82rem;">
      <li><strong>Legal Setup</strong>: KPME Act, BBMP Trade License, BMWM waste disposal.</li>
      <li><strong>Financials</strong>: Rental deposits (6-10 mo), Equipment budget, Payback period.</li>
      <li><strong>Location Proximity</strong>: 568 clinics mapped relative to <strong>Home (Sobha Neopolis)</strong>.</li>
    </ul>
    <p>Try asking: <em>"What are the nearest clinics to Home?"</em> or <em>"How much is the rent deposit in Panathur?"</em></p>
  `;
}
/* ==========================================================================
   Equipment & Instruments Price Catalogue — Data & Rendering
   ========================================================================== */

const EQUIPMENT_CATALOGUE = [
  // ─── BASIC TIER ─────────────────────────────────────────────────────────────
  {
    tier: 'basic',
    category: 'Heat Therapy',
    name: 'Hydrocollator (Moist Heat Unit)',
    icon: 'fa-fire-flame-curved',
    description: 'Stainless steel tank with thermostatic control that heats silica-gel hot packs in water. Essential for muscle spasm, arthritis, cervical & lumbar treatment. Available as 4-pack (portable) or 8-pack (clinical grade). Moist heat penetrates 2–3 cm deeper than dry heat.',
    price_min: 7000,
    price_max: 35000,
    unit: 'unit',
    tags: ['Cervical', 'Lumbar', 'Spasm Relief', 'Day 1 Essential'],
    pros: ['Deep moist heat penetration', 'No electricity during treatment', 'Reusable packs last 5+ years'],
    indiamart_link: 'https://www.indiamart.com/proddetail/hydrocollator-22052832588.html'
  },
  {
    tier: 'basic',
    category: 'Heat Therapy',
    name: 'Paraffin Wax Bath',
    icon: 'fa-hand-sparkles',
    description: 'Electric thermostatically-controlled wax melting unit for dipping hands, wrists, and feet. Ideal for rheumatoid arthritis, stiff joints, and post-fracture rehabilitation. Provides sustained moist heat at 48–52°C.',
    price_min: 3000,
    price_max: 12000,
    unit: 'unit',
    tags: ['Hand Therapy', 'Arthritis', 'Wrist Rehab'],
    pros: ['Uniform heat distribution', 'Low running cost', 'Relaxing for patients'],
    indiamart_link: 'https://www.indiamart.com/proddetail/paraffin-wax-bath.html'
  },
  {
    tier: 'basic',
    category: 'Electrotherapy',
    name: 'TENS Machine (Transcutaneous Electrical Nerve Stimulation)',
    icon: 'fa-bolt',
    description: '2-channel or 4-channel electrical stimulator delivering low-voltage pulses for pain relief. Works on Gate Control Theory — blocks pain signals via large nerve fibre stimulation. Analog units are most cost-effective; digital units offer pre-programmed protocols.',
    price_min: 2000,
    price_max: 10000,
    unit: 'unit',
    tags: ['Pain Relief', 'Nerve Stimulation', 'Day 1 Essential', 'Cervical', 'Lumbar'],
    pros: ['Zero side effects', 'Immediate patient relief', 'Highly portable options available'],
    indiamart_link: 'https://www.indiamart.com/proddetail/tens-machine.html'
  },
  {
    tier: 'basic',
    category: 'Electrotherapy',
    name: 'Muscle Stimulator (MS / EMS)',
    icon: 'fa-person-running',
    description: 'Electrical muscle stimulator for denervated muscle re-education, post-surgery strengthening, and prevention of muscle atrophy. Often bundled with TENS in combo units. Essential for post-ortho and post-stroke patients.',
    price_min: 3000,
    price_max: 15000,
    unit: 'unit',
    tags: ['Muscle Re-education', 'Post-Surgery', 'Atrophy Prevention'],
    pros: ['Prevents disuse atrophy', 'Adjunct to exercise therapy', 'Wide waveform variety'],
    indiamart_link: 'https://www.indiamart.com/proddetail/muscle-stimulator.html'
  },
  {
    tier: 'basic',
    category: 'Electrotherapy',
    name: 'Combo Therapy Unit (TENS + IFT + US + MS)',
    icon: 'fa-plug-circle-bolt',
    description: 'All-in-one 4-in-1 or 5-in-1 electrotherapy machine combining TENS, Interferential Therapy (IFT), Ultrasound (1 MHz), and Muscle Stimulation in a single compact unit. Best value for Day 1 clinic setup — saves space and budget.',
    price_min: 6000,
    price_max: 25000,
    unit: 'unit',
    tags: ['Best Value', 'Day 1 Essential', 'All-in-One', 'Space Saver'],
    pros: ['4 modalities in 1 device', 'Pre-programmed protocols', 'Smallest footprint per modality'],
    indiamart_link: 'https://www.indiamart.com/proddetail/combo-therapy-unit.html'
  },
  {
    tier: 'basic',
    category: 'Traction',
    name: 'Cervical Traction Unit (Manual / Pneumatic)',
    icon: 'fa-person-dots-from-line',
    description: 'Mechanical or pneumatic traction device specifically for cervical spine decompression. Relieves disc herniation, cervical spondylosis, and radiculopathy. Manual units use a halter + pulley system; pneumatic units inflate an air collar to achieve measured distraction force.',
    price_min: 10000,
    price_max: 25000,
    unit: 'unit',
    tags: ['Cervical', 'Spondylosis', 'Disc Herniation', 'Radiculopathy'],
    pros: ['Non-surgical disc decompression', 'Adjustable force settings', 'Quick patient setup'],
    indiamart_link: 'https://www.indiamart.com/proddetail/cervical-traction.html'
  },
  {
    tier: 'basic',
    category: 'Furniture',
    name: 'Treatment Table / Couch (Manual Fold)',
    icon: 'fa-bed',
    description: 'Standard padded treatment plinth with adjustable backrest (manual fold mechanism). Used for all patient assessments and hands-on physiotherapy. Available in fixed-height or adjustable-height versions with Leatherette upholstery.',
    price_min: 9500,
    price_max: 30000,
    unit: 'table',
    tags: ['Furniture', 'Day 1 Essential', 'Patient Plinth'],
    pros: ['Adjustable backrest', 'Easy to clean Leatherette', 'Stable for mobilisation techniques'],
    indiamart_link: 'https://www.indiamart.com/proddetail/physiotherapy-table.html'
  },
  {
    tier: 'basic',
    category: 'Exercise & Rehab',
    name: 'Exercise Resistance Bands Set (Theraband)',
    icon: 'fa-circle-nodes',
    description: 'Latex progressive resistance bands in 5–7 resistance levels (Yellow to Black). Used for strengthening, stretching, and proprioceptive training. Standard across all rehab protocols for shoulder, knee, ankle, and post-surgical recovery.',
    price_min: 500,
    price_max: 3000,
    unit: 'set',
    tags: ['Exercise', 'Strengthening', 'Low Cost', 'Day 1 Essential'],
    pros: ['Extremely portable', 'Graded resistance levels', 'Used in 90% of rehab protocols'],
    indiamart_link: 'https://www.indiamart.com/proddetail/theraband-resistance-band.html'
  },
  {
    tier: 'basic',
    category: 'Exercise & Rehab',
    name: 'Parallel Bars (Walking Rehabilitation)',
    icon: 'fa-ruler-horizontal',
    description: 'Height-adjustable stainless steel parallel bars for gait training in post-surgical, post-stroke, and elderly patients. Standard length is 3 metres with rubber non-slip flooring. Essential for any outpatient physiotherapy setup.',
    price_min: 8000,
    price_max: 22000,
    unit: 'unit',
    tags: ['Gait Training', 'Post-Stroke', 'Post-Surgery', 'Day 1 Essential'],
    pros: ['Height adjustable', 'Bilateral support for balance training', 'Durable stainless steel'],
    indiamart_link: 'https://www.indiamart.com/proddetail/parallel-bars.html'
  },

  // ─── MEDIUM TIER ────────────────────────────────────────────────────────────
  {
    tier: 'medium',
    category: 'Electrotherapy',
    name: 'IFT Machine — Interferential Therapy (Standalone)',
    icon: 'fa-wave-square',
    description: 'Generates medium-frequency (4000 Hz) alternating currents that interfere within the tissue to produce a low-frequency beat for deep pain relief and muscle stimulation. Reaches 5–6 cm deep — far deeper than TENS. Standalone IFT units offer higher precision than combo models.',
    price_min: 10000,
    price_max: 85000,
    unit: 'unit',
    tags: ['Deep Pain Relief', 'Sports Injury', 'Knee', 'Shoulder', 'Lumbar'],
    pros: ['Deeper tissue penetration than TENS', 'Excellent for chronic pain', 'Comfortable for patients'],
    indiamart_link: 'https://www.indiamart.com/proddetail/ift-machine.html'
  },
  {
    tier: 'medium',
    category: 'Ultrasound',
    name: 'Therapeutic Ultrasound Machine (1 MHz & 3 MHz)',
    icon: 'fa-satellite-dish',
    description: 'Generates high-frequency sound waves (1 MHz for deep tissue, 3 MHz for superficial). Produces thermal & non-thermal (cavitation) effects for soft tissue healing, tendinopathy, calcification, and scar tissue remodelling. Dual frequency units are preferred clinically.',
    price_min: 6000,
    price_max: 35000,
    unit: 'unit',
    tags: ['Soft Tissue Healing', 'Tendinopathy', 'Scar Tissue', 'Calcification'],
    pros: ['Accelerates tissue healing', 'Dual 1 MHz + 3 MHz for versatility', 'Low consumable cost'],
    indiamart_link: 'https://www.indiamart.com/proddetail/ultrasound-therapy.html'
  },
  {
    tier: 'medium',
    category: 'Traction',
    name: 'Lumbar Traction Unit (Digital / Computerized)',
    icon: 'fa-arrows-left-right-to-line',
    description: 'Motorized digital lumbar traction with LCD display, programmable static and intermittent traction modes, and precise force control up to 100 kg. Used for lumbar disc herniation, spondylolisthesis, and lumbar nerve root compression. Often mounted on a treatment table.',
    price_min: 20000,
    price_max: 80000,
    unit: 'unit',
    tags: ['Lumbar', 'Disc Herniation', 'Spondylolisthesis', 'Digital Control'],
    pros: ['Precise force control (grams accuracy)', 'Static & intermittent modes', 'LCD patient monitoring'],
    indiamart_link: 'https://www.indiamart.com/proddetail/lumbar-traction.html'
  },
  {
    tier: 'medium',
    category: 'Shortwave & Microwave',
    name: 'Shortwave Diathermy (SWD) — 300W / 500W',
    icon: 'fa-radiation',
    description: 'High-frequency electromagnetic energy (27.12 MHz) producing deep tissue heating up to 5 cm. Used for joint conditions, muscle spasms, sinusitis, pelvic inflammatory disease. Available in continuous (thermal) and pulsed (non-thermal/athermal) modes. 500W units preferred for clinical depth.',
    price_min: 17500,
    price_max: 90000,
    unit: 'unit',
    tags: ['Deep Heating', 'Joint Conditions', 'Pelvic', 'Sinusitis', 'Chronic Pain'],
    pros: ['Deepest thermal penetration (5 cm)', 'Both thermal & non-thermal modes', 'Covers large areas'],
    indiamart_link: 'https://www.indiamart.com/proddetail/shortwave-diathermy.html'
  },
  {
    tier: 'medium',
    category: 'Traction',
    name: 'Cervical + Lumbar Motorized Traction Combo',
    icon: 'fa-arrows-up-down',
    description: 'Combined digital traction system handling both cervical and lumbar spine in one unit. Includes interchangeable patient harness systems, programmable time cycles (5–60 min), force display, and emergency stop. Ideal for spondylosis-heavy patient profiles near IT corridor (desk workers).',
    price_min: 45000,
    price_max: 1,
    price_max_text: '₹1.2L',
    unit: 'unit',
    tags: ['Cervical + Lumbar', 'IT Professionals', 'Combined Unit', 'Programmable'],
    pros: ['Single unit for both spinal regions', 'Programmable timer & force', 'High ROI for desk-worker demographics'],
    indiamart_link: 'https://www.indiamart.com/proddetail/cervical-lumbar-traction.html'
  },
  {
    tier: 'medium',
    category: 'Exercise & Rehab',
    name: 'Exercise Cycle (Motorized / Pedal Exerciser)',
    icon: 'fa-person-biking',
    description: 'Motorized or semi-motorized lower limb cycle ergometer for knee, hip, and stroke rehabilitation. Passive (motor-driven) and active-assisted modes. Essential for joint ROM improvement, post-knee replacement, and cardiac physiotherapy. Desk-style pedal variants for upper limb rehab too.',
    price_min: 5000,
    price_max: 40000,
    unit: 'unit',
    tags: ['Knee Rehab', 'Post-TKR', 'Stroke Rehab', 'ROM Improvement'],
    pros: ['Passive & active-assisted modes', 'ROM & RPM display', 'Low impact for elderly patients'],
    indiamart_link: 'https://www.indiamart.com/proddetail/exercise-cycle.html'
  },
  {
    tier: 'medium',
    category: 'Exercise & Rehab',
    name: 'Balance Board / Wobble Board Set',
    icon: 'fa-yin-yang',
    description: 'Proprioceptive training equipment including wobble boards, rocker boards, and balance pods. Used for ankle, knee, and hip stabilisation post-sprain, post-fracture, or ACL reconstruction. BOSU balls and inflatable discs are popular in sports rehab setups.',
    price_min: 2000,
    price_max: 15000,
    unit: 'set',
    tags: ['Balance', 'Proprioception', 'Ankle Sprain', 'Sports Rehab', 'ACL'],
    pros: ['Low cost, high patient engagement', 'Graded difficulty levels', 'Dual use strength + balance'],
    indiamart_link: 'https://www.indiamart.com/proddetail/balance-board.html'
  },
  {
    tier: 'medium',
    category: 'Exercise & Rehab',
    name: 'Dumbbell & Weight Set (Clinic Grade)',
    icon: 'fa-dumbbell',
    description: 'Rubber-coated hex dumbbells (0.5 kg to 10 kg) for upper extremity strengthening, grip training, and progressive resistance exercise in elderly and post-surgical patients. Wall-mounted rack with full range strongly recommended over individual sets for space efficiency.',
    price_min: 3000,
    price_max: 20000,
    unit: 'set',
    tags: ['Strengthening', 'Upper Limb', 'Elderly', 'Post-Surgery'],
    pros: ['Durable rubber coating', 'Hex design prevents rolling', 'Covers all patient strength levels'],
    indiamart_link: 'https://www.indiamart.com/proddetail/dumbbell-set.html'
  },
  {
    tier: 'medium',
    category: 'Furniture',
    name: 'Hi-Low Motorized Treatment Table',
    icon: 'fa-table',
    description: 'Electrically height-adjustable treatment plinth with foot-control pedal. Adjusts from 45 cm to 90 cm height. Essential for treating elderly, obese, or post-surgical patients who cannot step up to fixed-height tables. High-quality foam padding with waterproof Leatherette.',
    price_min: 25000,
    price_max: 75000,
    unit: 'table',
    tags: ['Furniture', 'Elderly-Friendly', 'Electric Adjust', 'Premium'],
    pros: ['Foot-pedal height control', 'Safer patient transfers', 'Professional clinic image'],
    indiamart_link: 'https://www.indiamart.com/proddetail/hi-low-treatment-table.html'
  },

  // ─── ADVANCED TIER ──────────────────────────────────────────────────────────
  {
    tier: 'advanced',
    category: 'Laser Therapy',
    name: 'Class IV Laser Therapy System (High Power)',
    icon: 'fa-laser',
    description: 'High-power (5W–10W) Class IV therapeutic laser for deep tissue photobiomodulation. Effective for chronic pain, wound healing, nerve regeneration, and sports injury recovery. Wavelengths of 810 nm & 980 nm penetrate to 5–7 cm depth. Often used for knee OA, plantar fasciitis, and disc injuries.',
    price_min: 150000,
    price_max: 350000,
    unit: 'unit',
    tags: ['Advanced', 'Chronic Pain', 'Sports Rehab', 'Photobiomodulation', 'Premium'],
    pros: ['Fastest healing modality', 'Highly differentiated service offering', 'Premium fee justification'],
    indiamart_link: 'https://www.indiamart.com/proddetail/laser-therapy.html'
  },
  {
    tier: 'advanced',
    category: 'Electrotherapy',
    name: 'EMG Biofeedback System with NMES',
    icon: 'fa-brain',
    description: "Surface electromyography (sEMG) biofeedback with integrated neuromuscular electrical stimulation (NMES). Reads real-time muscle activity and provides visual/audio feedback to patients. Used in stroke rehabilitation, Bell's palsy, and urinary incontinence treatment. Combines FES and EMG-triggered stimulation.",
    price_min: 50000,
    price_max: 350000,
    unit: 'unit',
    tags: ['Stroke Rehab', 'Bells Palsy', 'Neurology', 'Biofeedback', 'NMES'],
    pros: ['Objective muscle activity measurement', 'Motivating real-time feedback for patients', 'Opens neurological rehab referrals'],
    indiamart_link: 'https://www.indiamart.com/proddetail/emg-biofeedback.html'
  },
  {
    tier: 'advanced',
    category: 'Laser Therapy',
    name: 'Low Level Laser Therapy (LLLT / Cold Laser)',
    icon: 'fa-wand-magic-sparkles',
    description: 'Low intensity laser (5–50 mW) for superficial wound healing, acupuncture point stimulation, and trigger point therapy. Unlike Class IV, it produces no thermal effect — purely photochemical. Used for oral mucositis, lymphoedema, and nerve repair.',
    price_min: 15000,
    price_max: 80000,
    unit: 'unit',
    tags: ['Cold Laser', 'Wound Healing', 'Lymphoedema', 'Acupuncture Points'],
    pros: ['No thermal risk', 'Precise treatment area', 'Opens wound-care & lymphatic protocols'],
    indiamart_link: 'https://www.indiamart.com/proddetail/lllt-laser.html'
  },
  {
    tier: 'advanced',
    category: 'Hydrotherapy',
    name: 'Hydrotherapy Pool / Aquatic Therapy Tub',
    icon: 'fa-water',
    description: 'Fiberglass or stainless steel therapeutic pool (1.5–2.5 m × 3–5 m) with underwater jets, heated water (33–36°C), and non-slip entry stairs. Water buoyancy reduces weight bearing by 90% (at neck level). Ideal for orthopaedic, neurological, and elderly patient rehab.',
    price_min: 200000,
    price_max: 800000,
    unit: 'unit',
    tags: ['Aquatic Therapy', 'Neurological', 'Elderly', 'Weight-Bearing', 'Premium'],
    pros: ['Weight offloading in water', 'Unique service differentiator in market', 'High patient demand in BLR'],
    indiamart_link: 'https://www.indiamart.com/proddetail/hydrotherapy-pool.html'
  },
  {
    tier: 'advanced',
    category: 'CPM & Robotics',
    name: 'CPM Machine — Continuous Passive Motion (Knee)',
    icon: 'fa-gear',
    description: 'Motorized continuous passive motion device for post-operative knee rehabilitation (TKR, ACL repair, cartilage procedures). Automatically cycles the knee through a set arc of motion (0°–120°) for hours. Dramatically reduces post-surgical stiffness and speeds discharge.',
    price_min: 14000,
    price_max: 90000,
    unit: 'unit',
    tags: ['Post-TKR', 'Post-ACL', 'Knee Surgery', 'CPM', 'Post-Op'],
    pros: ['Accelerates post-surgical recovery', 'Passive - no patient effort needed', 'Strong referral driver from orthopaedic surgeons'],
    indiamart_link: 'https://www.indiamart.com/proddetail/cpm-machine-knee.html'
  },
  {
    tier: 'advanced',
    category: 'CPM & Robotics',
    name: 'Robotic Gait Trainer / Exoskeleton Rehab System',
    icon: 'fa-robot',
    description: 'Motorized exoskeleton or end-effector gait training system for stroke, spinal cord injury, and neurological rehabilitation. Systems like Lokomat-style trainers provide repetitive, task-specific gait training with body-weight support up to 75 kg. Advanced units provide real-time kinetic & kinematic biofeedback.',
    price_min: 280000,
    price_max: 2000000,
    price_max_text: '₹20L+',
    unit: 'unit',
    tags: ['Stroke Rehab', 'SCI', 'Neurological', 'Gait Training', 'Exoskeleton', 'Premium'],
    pros: ['Highest patient outcomes for stroke gait', 'Unique service in Bengaluru standalone clinics', 'Insurance-covered for neurological indications'],
    indiamart_link: 'https://www.indiamart.com/proddetail/robotic-gait-trainer.html'
  },
  {
    tier: 'advanced',
    category: 'Exercise & Rehab',
    name: 'Isokinetic Dynamometer (Cybex / Biodex Style)',
    icon: 'fa-chart-column',
    description: 'Computer-controlled machine for objective muscle strength testing and isokinetic training at fixed angular velocities. Used for sports injury assessment, pre/post ACL surgery evaluation, and medico-legal strength documentation. Outputs torque curves, peak torque, and bilateral deficit ratios.',
    price_min: 500000,
    price_max: 2000000,
    price_max_text: '₹20L+',
    unit: 'unit',
    tags: ['Sports Rehab', 'Strength Testing', 'Isokinetic', 'ACL', 'Sports Medicine'],
    pros: ['Gold standard for strength testing', 'Attracts sports medicine referrals', 'Medico-legal documentation value'],
    indiamart_link: 'https://www.indiamart.com/proddetail/isokinetic-dynamometer.html'
  }
];

function renderEquipmentGrid(filterTier = 'all') {
  const grid = document.getElementById('equipmentGrid');
  if (!grid) return;

  const filtered = filterTier === 'all' 
    ? EQUIPMENT_CATALOGUE 
    : EQUIPMENT_CATALOGUE.filter(e => e.tier === filterTier);

  const tierColors = { basic: '#34d399', medium: '#60a5fa', advanced: '#f59e0b' };
  const tierLabels = { basic: 'Basic', medium: 'Medium', advanced: 'Advanced' };

  grid.innerHTML = filtered.map(eq => {
    const color = tierColors[eq.tier];
    const label = tierLabels[eq.tier];
    const minFmt = eq.price_min >= 100000 ? `₹${(eq.price_min/100000).toFixed(1)}L` : `₹${eq.price_min.toLocaleString('en-IN')}`;
    const maxFmt = eq.price_max_text ? eq.price_max_text : (eq.price_max >= 100000 ? `₹${(eq.price_max/100000).toFixed(1)}L` : `₹${eq.price_max.toLocaleString('en-IN')}`);
    const priceRange = `${minFmt} – ${maxFmt}`;

    const tagsHtml = eq.tags.map(t => `<span class="equip-tag">${t}</span>`).join('');
    const prosHtml = eq.pros.map(p => `<li>${p}</li>`).join('');

    return `
      <div class="equip-card" data-tier="${eq.tier}">
        <div class="equip-card-header" style="border-left: 4px solid ${color};">
          <div class="equip-icon-wrap" style="background: rgba(${color === '#34d399' ? '16,185,129' : color === '#60a5fa' ? '96,165,250' : '245,158,11'}, 0.15); color: ${color};">
            <i class="fa-solid ${eq.icon}"></i>
          </div>
          <div class="equip-title-group">
            <span class="equip-tier-badge" style="background: rgba(${color === '#34d399' ? '16,185,129' : color === '#60a5fa' ? '96,165,250' : '245,158,11'}, 0.15); color: ${color}; border: 1px solid ${color}40;">${label}</span>
            <span class="equip-category">${eq.category}</span>
          </div>
        </div>
        <h3 class="equip-name">${eq.name}</h3>
        <p class="equip-desc">${eq.description}</p>
        <div class="equip-tags">${tagsHtml}</div>
        <div class="equip-pros">
          <div class="equip-pros-title"><i class="fa-solid fa-check-circle" style="color: #34d399;"></i> Key Clinical Benefits</div>
          <ul>${prosHtml}</ul>
        </div>
        <div class="equip-footer">
          <div class="equip-price-block">
            <div class="equip-price-label">Price Range (ex-GST)</div>
            <div class="equip-price" style="color: ${color};">${priceRange}</div>
          </div>
          <a href="${eq.indiamart_link}" target="_blank" class="equip-buy-btn" style="border-color: ${color}; color: ${color};">
            <i class="fa-solid fa-cart-shopping"></i> IndiaMART
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function filterEquipTier(tier, btn) {
  document.querySelectorAll('.equip-tier-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderEquipmentGrid(tier);
}

// Initialize equipment grid on load
document.addEventListener('DOMContentLoaded', () => {
  renderEquipmentGrid('all');
});

/* ==========================================================================
   Budget & Costs Tier Filter
   ========================================================================== */
function filterCostsTier(tier, btn) {
  document.querySelectorAll('.costs-tier-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const views = {
    all:      ['costsTableAll'],
    basic:    ['costsCardBasic'],
    medium:   ['costsCardMedium'],
    advanced: ['costsCardAdvanced']
  };

  ['costsTableAll','costsCardBasic','costsCardMedium','costsCardAdvanced'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  (views[tier] || views.all).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });
}
