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
