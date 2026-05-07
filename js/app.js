// ============================================================
// VSS UPS FIELD APP — app.js
// Firebase compat mode (loaded via script tags)
// ============================================================

// ── State ──────────────────────────────────────────────────
let allDealers   = [];
let filteredDealers = [];
let activeDealer = null;
let activeFilter = "all";
let searchQuery  = "";
let zohoAccessToken = null;
let lastSyncTime = null;
let syncInProgress = false;

// ── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  setMonthBadge();
  setupFilterChips();
  bindSearch();
  setupModalCloseOnOverlay();
  await loadFromFirebase();          // instant load from Firebase
  syncFromZoho();                   // background Zoho → Firebase
});

// ── Month Badge ─────────────────────────────────────────────
function setMonthBadge() {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const n = new Date();
  document.getElementById("monthBadge").textContent = `${m[n.getMonth()]} ${n.getFullYear()}`;
}

// ── Firebase: Read All Dealers ─────────────────────────────
async function loadFromFirebase() {
  const loadEl  = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");
  const list    = document.getElementById("dealerList");

  loadEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  list.querySelectorAll(".dealer-card, .empty-state").forEach(e => e.remove());

  try {
    const snap = await window.FB.db
      .collection(CONFIG.FIRESTORE_COLLECTION)
      .orderBy("name")
      .get();

    allDealers = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Update stats
    document.getElementById("totalDealers").textContent = allDealers.length;
    const totalVisits = allDealers.reduce((sum, d) => sum + (d.dealer_meets ? d.dealer_meets.length : 0), 0);
    document.getElementById("totalVisits").textContent = totalVisits;

    // Last sync time
    const sorted = [...allDealers].sort((a, b) => {
      const ta = a.last_synced ? a.last_synced.toMillis ? a.last_synced.toMillis() : 0 : 0;
      const tb = b.last_synced ? b.last_synced.toMillis ? b.last_synced.toMillis() : 0 : 0;
      return tb - ta;
    });
    if (sorted[0] && sorted[0].last_synced) {
      const d = sorted[0].last_synced.toDate ? sorted[0].last_synced.toDate() : new Date(sorted[0].last_synced);
      lastSyncTime = d;
      document.getElementById("lastSync").textContent = formatTimeAgo(d);
    } else {
      document.getElementById("lastSync").textContent = "—";
    }

    applyFilters();
  } catch (err) {
    console.error("Firebase load error:", err);
    errorEl.classList.remove("hidden");
  } finally {
    loadEl.classList.add("hidden");
  }
}

// ── Zoho: Get Access Token ──────────────────────────────────
async function getZohoToken() {
  try {
    const resp = await fetch(CONFIG.ZOHO.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     CONFIG.ZOHO.client_id,
        client_secret: CONFIG.ZOHO.client_secret,
        refresh_token: CONFIG.ZOHO.refresh_token,
      })
    });
    if (!resp.ok) throw new Error("Token failed: " + resp.status);
    const data = await resp.json();
    return data.access_token;
  } catch (err) {
    console.error("Token error:", err);
    return null;
  }
}

// ── Zoho: Fetch All UPS Records ────────────────────────────
async function fetchZohoUPSRecords(token) {
  const records = [];
  let page = 1;
  let moreRecords = true;

  while (moreRecords) {
    const resp = await fetch(
      `${CONFIG.ZOHO.api_base}/${CONFIG.ZOHO.module}?per_page=100&page=${page}`,
      { headers: { "Authorization": `Zoho-oauthtoken ${token}` } }
    );
    if (resp.status === 204) break;
    if (!resp.ok) break;
    const data = await resp.json();
    if (data.data) {
      records.push(...data.data);
    }
    moreRecords = data.info && data.info.more_records === true;
    page++;
    if (page > 10) break; // safety
  }
  return records;
}

// ── Zoho: Map Zoho record → Firestore doc ──────────────────
function mapZohoToFirestore(record) {
  const f = record;
  return {
    id:                   String(f.id || record.id || ""),
    name:                 f.Name || "",
    phone:                f.Phone || "",
    email:                f.Email || "",
    dealer_code:          f.Dealer_Code || "",
    dealer_type:          f.Dealer_Type || "",
    city:                 f.Address_of_the_dealer_City || "",
    state:                f.Address_of_the_dealer_State_Province || "",
    address:              f.Address_of_the_dealer || "",
    total_lifetime_value: f.Total_Lifetime_Value || null,
    last_order_date:      f.Last_Order_Date || null,
    last_order_value:     f.Last_Order_Value || null,
    total_visits:         f.Total_visits || 0,
    next_followup:        f.Next_Follow_up_date_and_time || null,
    owner_email:          f.Owner_email || "",
    // dealer_meets is the subform — stored as array
    dealer_meets:         f.Dealer_meets || [],
    last_synced:          firebase.firestore.FieldValue.serverTimestamp(),
    source:               "zoho_crm",
  };
}

// ── Firebase: Write All Zoho Records ───────────────────────
async function syncFromZoho() {
  if (syncInProgress) return;
  syncInProgress = true;

  const badge = document.getElementById("syncBadge");
  badge.classList.add("syncing");
  badge.textContent = "↻";

  try {
    zohoAccessToken = await getZohoToken();
    if (!zohoAccessToken) throw new Error("No Zoho token");

    const zohoRecords = await fetchZohoUPSRecords(zohoAccessToken);
    console.log(`Zoho fetched ${zohoRecords.length} records`);

    // Write each record to Firebase
    const batch = window.FB.db.batch();
    for (const record of zohoRecords) {
      if (!record.id) continue;
      const docRef = window.FB.db
        .collection(CONFIG.FIRESTORE_COLLECTION)
        .doc(String(record.id));
      const data = mapZohoToFirestore(record);
      batch.set(docRef, data, { merge: true });
    }
    await batch.commit();
    console.log(`Firebase synced ${zohoRecords.length} records`);

    // Update UI
    lastSyncTime = new Date();
    document.getElementById("lastSync").textContent = "Just now";
    badge.classList.remove("syncing");
    badge.textContent = "●";

    // Reload from Firebase to reflect any changes
    await loadFromFirebase();

  } catch (err) {
    console.error("Zoho→Firebase sync error:", err);
    badge.classList.add("error");
    badge.textContent = "✕";
    setTimeout(() => {
      badge.classList.remove("error");
      badge.textContent = "●";
    }, 3000);
  } finally {
    syncInProgress = false;
  }
}

// ── Filter Chips ───────────────────────────────────────────
function setupFilterChips() {
  document.querySelectorAll("#filterBar .chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filterBar .chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.type;
      applyFilters();
    });
  });
}

// ── Search ─────────────────────────────────────────────────
function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });
}

// ── Apply Filters ──────────────────────────────────────────
function applyFilters() {
  filteredDealers = allDealers.filter(d => {
    const matchType   = activeFilter === "all" || d.dealer_type === activeFilter;
    const matchSearch = !searchQuery || [
      d.name, d.city, d.state, d.dealer_code, d.phone
    ].some(v => (v || "").toLowerCase().includes(searchQuery));
    return matchType && matchSearch;
  });
  renderDealers();
}

// ── Render Dealer Cards ────────────────────────────────────
function renderDealers() {
  const list = document.getElementById("dealerList");
  list.querySelectorAll(".dealer-card, .empty-state").forEach(e => e.remove());

  if (!filteredDealers.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = searchQuery
      ? `<p>No matches for "<strong>${esc(searchQuery)}</strong>"</p>`
      : "<p>No dealers found.</p>";
    list.appendChild(empty);
    return;
  }

  filteredDealers.forEach((d, i) => {
    const card = document.createElement("div");
    card.className = "dealer-card";
    card.style.animationDelay = `${i * 30}ms`;

    const address = [d.city, d.state].filter(Boolean).join(", ");
    const visits = d.dealer_meets ? d.dealer_meets.length : 0;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${esc(d.name || "—")}</div>
        ${d.dealer_code ? `<span class="card-code">${esc(d.dealer_code)}</span>` : ""}
      </div>
      <div class="card-meta">
        ${d.phone       ? `<span class="card-meta-item">📞 ${esc(d.phone)}</span>` : ""}
        ${address       ? `<span class="card-meta-item">📍 ${esc(address)}</span>` : ""}
      </div>
      <div class="card-bottom">
        <span class="card-visits"><span>${visits}</span> visit${visits !== 1 ? "s" : ""}</span>
        <span class="card-arrow">›</span>
      </div>
    `;
    card.addEventListener("click", () => openModal(d));
    list.appendChild(card);
  });
}

// ── Modal: Open ────────────────────────────────────────────
function openModal(d) {
  activeDealer = d;

  document.getElementById("modalDealerName").textContent = d.name || "—";
  document.getElementById("modalPhone").textContent      = d.phone || "—";
  document.getElementById("modalCode").textContent       = d.dealer_code || "—";
  document.getElementById("modalType").textContent        = d.dealer_type || "—";
  document.getElementById("modalLTV").textContent         = d.total_lifetime_value
    ? `Rs. ${Number(d.total_lifetime_value).toLocaleString("en-IN")}`
    : "—";

  const addr = [d.address, d.city, d.state].filter(Boolean).join(", ");
  document.getElementById("modalAddress").textContent   = addr || "—";

  // Visit summary
  const meets = d.dealer_meets || [];
  document.getElementById("modalTotalVisits").textContent = meets.length;

  if (meets.length > 0) {
    const last = meets[meets.length - 1];
    document.getElementById("modalLastVisit").textContent  = last.Visit_Date
      ? formatDate(last.Visit_Date)
      : "—";
  } else {
    document.getElementById("modalLastVisit").textContent = "—";
  }

  document.getElementById("modalNextFollowup").textContent = d.next_followup
    ? formatDate(d.next_followup)
    : "—";

  // Recent visits list
  const visitsEl = document.getElementById("visitsList");
  visitsEl.innerHTML = "";

  if (meets.length === 0) {
    visitsEl.innerHTML = '<p class="no-visits">No visits recorded yet</p>';
  } else {
    // Show last 5 visits
    const recent = meets.slice(-5).reverse();
    recent.forEach(m => {
      const item = document.createElement("div");
      item.className = "visit-item";
      item.innerHTML = `
        <span class="visit-date">${m.Visit_Date ? formatDate(m.Visit_Date) : "—"}</span>
        <span class="visit-stage">${esc(m.Stage || "Visit")}</span>
        ${m.Notes ? `<span class="visit-notes">"${esc(m.Notes)}"</span>` : ""}
        ${m.Submitted_By ? `<span class="visit-employee">By ${esc(m.Submitted_By)}</span>` : ""}
      `;
      visitsEl.appendChild(item);
    });
  }

  // Sync info
  const syncEl = document.getElementById("modalSyncInfo");
  if (d.last_synced) {
    const d2 = d.last_synced.toDate ? d.last_synced.toDate() : new Date(d.last_synced);
    syncEl.textContent = `Last synced: ${formatTimeAgo(d2)}`;
  } else {
    syncEl.textContent = "";
  }

  // Enable form button
  document.getElementById("btnOpenForm").disabled = false;

  document.getElementById("detailModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// ── Modal: Close ───────────────────────────────────────────
function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.style.overflow = "";
  activeDealer = null;
}

function setupModalCloseOnOverlay() {
  document.getElementById("detailModal").addEventListener("click", e => {
    if (e.target.id === "detailModal") closeModal();
  });
}

// ── Open Google Form (pre-filled) ──────────────────────────
function openGoogleForm() {
  if (!activeDealer) return;

  const cfg = CONFIG.GOOGLE_FORM;
  if (cfg.base_url.includes("FormID") || cfg.base_url.includes("SfFormID")) {
    alert("Please update js/config.js with your actual Google Form URL and entry IDs!");
    return;
  }

  const params = new URLSearchParams({ usp: "pp_url" });
  params.set(cfg.entry_name,  encodeURIComponent(activeDealer.name || ""));
  params.set(cfg.entry_id,    activeDealer.id || "");
  params.set(cfg.entry_phone, activeDealer.phone || "");

  const url = `${cfg.base_url}?${params.toString()}`;
  window.open(url, "_blank");
}

// ── Utilities ──────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function formatTimeAgo(date) {
  if (!date) return "—";
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)  return "Just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return formatDate(date);
}
