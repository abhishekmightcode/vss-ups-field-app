// ============================================================
// VSS UPS FIELD APP — app.js (v2)
// Features: Send Location | Submit Info (web form) | Upload Photo (Google Form)
// ============================================================

// ── State ──────────────────────────────────────────────────
let allDealers       = [];
let filteredDealers  = [];
let activeDealer     = null;
let activeFilter     = "all";
let searchQuery      = "";
let syncInProgress   = false;
let lastSyncTime     = null;
let userLocation     = null;         // cached geolocation
let locationPermitted = false;

// ── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  setMonthBadge();
  setupFilterChips();
  bindSearch();
  setupModalCloseOnOverlay();
  setupLocationPermission();
  await loadFromFirebase();
  syncFromZoho();
});

// ── Month Badge ─────────────────────────────────────────────
function setMonthBadge() {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const d = new Date();
  document.getElementById("monthBadge").textContent = `${m[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Location: Request Permission + Cache ────────────────────
function setupLocationPermission() {
  if (!navigator.geolocation) {
    document.getElementById("locationStatus")?.remove();
    return;
  }
  // Status indicator already in UI; request silently on load
  navigator.permissions?.query({ name: "geolocation" }).then(result => {
    if (result.state === "granted") {
      locationPermitted = true;
      cacheUserLocation();
    }
  }).catch(() => {});
}

function cacheUserLocation() {
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
      locationPermitted = true;
    },
    err => {
      locationPermitted = false;
      userLocation = null;
    }
  );
}

// ── Firebase: Load All Dealers ─────────────────────────────
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

    allDealers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    document.getElementById("totalDealers").textContent = allDealers.length;
    const totalVisits = allDealers.reduce((sum, d) => sum + (d.visit_count || 0), 0);
    document.getElementById("totalVisits").textContent = totalVisits;

    const sorted = [...allDealers].sort((a, b) => {
      const ta = a.last_synced ? (a.last_synced.toMillis ? a.last_synced.toMillis() : new Date(a.last_synced).getTime()) : 0;
      const tb = b.last_synced ? (b.last_synced.toMillis ? b.last_synced.toMillis() : new Date(b.last_synced).getTime()) : 0;
      return tb - ta;
    });
    if (sorted[0]?.last_synced) {
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
  let page = 1, moreRecords = true;

  while (moreRecords) {
    const resp = await fetch(
      `${CONFIG.ZOHO.api_base}/${CONFIG.ZOHO.module}?per_page=200&page=${page}&fields=ALL`,
      { headers: { "Authorization": `Zoho-oauthtoken ${token}` } }
    );
    if (resp.status === 204 || resp.status === 401) break;
    if (!resp.ok) break;
    const data = await resp.json();
    if (data.data) records.push(...data.data);
    moreRecords = data.info?.more_records === true;
    page++;
    if (page > 20) break; // safety cap
  }
  return records;
}

// ── Zoho: Update a single UPS record ───────────────────────
async function zohoUpdateRecord(token, recordId, fields) {
  const resp = await fetch(`${CONFIG.ZOHO.api_base}/${CONFIG.ZOHO.module}/${recordId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: [fields] })
  });
  const result = await resp.json();
  if (resp.ok && result.data?.[0]?.status === "success") {
    return { ok: true };
  } else {
    return { ok: false, error: result };
  }
}

// ── Zoho: Create Dealer Meets entry ─────────────────────────
async function zohoCreateDealerMeet(token, recordId, fields) {
  const resp = await fetch(`${CONFIG.ZOHO.api_base}/${CONFIG.ZOHO.module}/${recordId}/Dealer_meets`, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: [fields] })
  });
  const result = await resp.json();
  return { ok: resp.ok || resp.status === 201, result };
}

// ── Zoho: Increment Total_visits ────────────────────────────
async function zohoIncrementVisits(token, recordId, currentCount) {
  return zohoUpdateRecord(token, recordId, {
    Total_visits: (parseInt(currentCount) || 0) + 1
  });
}

// ── Map Zoho record → Firestore doc ─────────────────────────
function mapZohoToFirestore(record) {
  const f = record;
  return {
    id:                   String(f.id || ""),
    name:                 f.Name || "",
    phone:                f.Phone || "",
    email:                f.Email || "",
    dealer_code:          f.Dealer_code || "",
    dealer_type:          f.Dealer_Type || "",
    city:                 f.Address_of_the_dealer_City || "",
    state:                f.Address_of_the_dealer_State_Province || "",
    address:              f.Address_of_the_dealer || "",
    total_lifetime_value: f.Total_Lifetime_Value || null,
    last_order_date:      f.Last_Order_Date || null,
    last_order_value:     f.Last_Order_Value || null,
    visit_count:          f.Total_visits || 0,
    last_visit_date:      f.Last_Visit_Date || null,
    next_followup:        f.Next_Follow_up_date_and_time || null,
    follow_up_date_time:  f.Follow_up_date_and_time || null,
    follow_up_notes:      f.Follow_up_notes || "",
    existing_battery_stock:  f.Existing_Battery_stock || "",
    existing_ups_stock:      f.Existing_UPS_stock || "",
    existing_high_kv_ups_stock: f.Existing_High_KV_UPS_stock || "",
    approx_value_in_outlet:  f.Approx_value_in_outlet || "",
    credit_value_with_dealer: f.Credit_value_with_dealer || "",
    lat:                 f.Address_of_the_dealer_Coordinates_Latitude || null,
    lng:                 f.Address_of_the_dealer_Coordinates_Longitude || null,
    location_synced:     !!(f.Address_of_the_dealer_Coordinates_Latitude),
    owner_email:          f.Owner_email || "",
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
    const token = await getZohoToken();
    if (!token) throw new Error("No Zoho token");

    const zohoRecords = await fetchZohoUPSRecords(token);
    console.log(`Zoho fetched ${zohoRecords.length} records`);

    const batch = window.FB.db.batch();
    for (const record of zohoRecords) {
      if (!record.id) continue;
      const code = record.Dealer_Code;
      const docId = (code && String(code).trim()) ? String(code) : String(record.id);
      const docRef = window.FB.db.collection(CONFIG.FIRESTORE_COLLECTION).doc(docId);
      const data = mapZohoToFirestore(record);
      if (code) data.dealer_code = String(code);
      batch.set(docRef, data, { merge: true });
    }
    await batch.commit();
    console.log(`Firebase synced ${zohoRecords.length} records`);

    lastSyncTime = new Date();
    document.getElementById("lastSync").textContent = "Just now";
    badge.classList.remove("syncing");
    badge.textContent = "●";
    await loadFromFirebase();

  } catch (err) {
    console.error("Zoho→Firebase sync error:", err);
    badge.classList.add("error");
    badge.textContent = "✕";
    setTimeout(() => { badge.classList.remove("error"); badge.textContent = "●"; }, 3000);
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
    const matchSearch = !searchQuery || [d.name, d.city, d.state, d.dealer_code, d.code, d.phone]
      .some(v => (v || "").toLowerCase().includes(searchQuery));
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
    const visits  = d.visit_count || 0;
    const code    = d.code || d.dealer_code || "";
    const locSynced = d.location_synced;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${esc(d.name || "—")}</div>
        ${code ? `<span class="card-code">${esc(code)}</span>` : ""}
      </div>
      <div class="card-meta">
        ${d.phone    ? `<span class="card-meta-item">📞 ${esc(d.phone)}</span>` : ""}
        ${address    ? `<span class="card-meta-item">📍 ${esc(address)}</span>` : ""}
        ${locSynced ? `<span class="card-meta-item location-synced">📍 Location synced</span>` : ""}
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
  document.getElementById("modalCode").textContent        = (d.code || d.dealer_code || "—");
  document.getElementById("modalType").textContent        = d.dealer_type || "—";
  document.getElementById("modalLTV").textContent         = d.total_lifetime_value
    ? `Rs. ${Number(d.total_lifetime_value).toLocaleString("en-IN")}`
    : "—";

  const addr = [d.address, d.city, d.state].filter(Boolean).join(", ");
  document.getElementById("modalAddress").textContent = addr || "—";

  document.getElementById("modalTotalVisits").textContent  = d.visit_count || 0;
  document.getElementById("modalLastVisit").textContent   = d.last_visit_date ? formatDate(d.last_visit_date) : "—";
  document.getElementById("modalNextFollowup").textContent = d.follow_up_date_time ? formatDate(d.follow_up_date_time) : "—";

  // Location status in modal
  const locStatus = document.getElementById("modalLocationStatus");
  if (d.lat && d.lng) {
    locStatus.textContent = `${parseFloat(d.lat).toFixed(4)}, ${parseFloat(d.lng).toFixed(4)}`;
    locStatus.classList.add("synced");
  } else {
    locStatus.textContent = "Not yet sent";
    locStatus.classList.remove("synced");
  }

  // Recent visits (from dealer_meets sub-form array in Firebase)
  const visitsEl = document.getElementById("visitsList");
  visitsEl.innerHTML = "";
  const meets = d.dealer_meets || [];
  if (meets.length === 0) {
    visitsEl.innerHTML = '<p class="no-visits">No visits recorded yet</p>';
  } else {
    const recent = meets.slice(-5).reverse();
    recent.forEach(m => {
      const item = document.createElement("div");
      item.className = "visit-item";
      item.innerHTML = `
        <span class="visit-date">${m.Visit_Date ? formatDate(m.Visit_Date) : "—"}</span>
        <span class="visit-stage">${esc(m.Visit_Notes || m.Competition_In_Use || "Visit")}</span>
        ${m.Image_URL ? `<span class="visit-photo-badge">📷 Photo</span>` : ""}
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

  // Enable buttons
  document.getElementById("btnSendLocation").disabled  = false;
  document.getElementById("btnSubmitInfo").disabled    = false;
  document.getElementById("btnUploadPhoto").disabled    = !CONFIG.GOOGLE_FORM.enabled;

  document.getElementById("detailModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// ── Modal: Close ───────────────────────────────────────────
function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.style.overflow = "";
  activeDealer = null;
  closeInfoForm();
  closeLocationForm();
}

function setupModalCloseOnOverlay() {
  document.getElementById("detailModal").addEventListener("click", e => {
    if (e.target.id === "detailModal") closeModal();
  });
}

// ─────────────────────────────────────────────────────────────
// BUTTON 1: SEND LOCATION
// ─────────────────────────────────────────────────────────────
async function sendLocation() {
  if (!activeDealer) return;
  const btn = document.getElementById("btnSendLocation");
  btn.disabled = true;
  btn.textContent = "Getting location...";

  // Try cached location first
  let pos;
  if (userLocation) {
    pos = userLocation;
  } else {
    try {
      pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      pos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      showToast("📍 Could not get location. Please enable GPS.", "error");
      btn.disabled = false;
      btn.textContent = "📍 Send Location";
      return;
    }
  }

  btn.textContent = "Sending to Zoho...";

  try {
    const token = await getZohoToken();
    if (!token) throw new Error("No Zoho token");

    const result = await zohoUpdateRecord(token, activeDealer.id, {
      Address_of_the_dealer_Coordinates_Latitude:  String(pos.lat),
      Address_of_the_dealer_Coordinates_Longitude: String(pos.lng)
    });

    if (result.ok) {
      // Update Firebase locally too
      await window.FB.db.collection(CONFIG.FIRESTORE_COLLECTION).doc(activeDealer.dealer_code || activeDealer.id).update({
        lat: pos.lat,
        lng: pos.lng,
        location_synced: true
      });
      showToast("📍 Location synced to Zoho CRM ✓");
      document.getElementById("modalLocationStatus").textContent = `${parseFloat(pos.lat).toFixed(4)}, ${parseFloat(pos.lng).toFixed(4)}`;
      document.getElementById("modalLocationStatus").classList.add("synced");
      // Refresh the card
      const card = document.querySelector(`.dealer-card[data-id="${activeDealer.dealer_code}"]`);
      if (card) {
        const meta = card.querySelector(".card-meta");
        if (meta && !meta.innerHTML.includes("Location synced")) {
          const locItem = document.createElement("span");
          locItem.className = "card-meta-item location-synced";
          locItem.textContent = "📍 Location synced";
          meta.appendChild(locItem);
        }
      }
    } else {
      showToast("Failed to update Zoho: " + JSON.stringify(result.error), "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "📍 Send Location";
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON 2: SUBMIT INFO (in-app web form)
// ─────────────────────────────────────────────────────────────
function openInfoForm() {
  if (!activeDealer) return;
  const modal = document.getElementById("infoFormModal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Pre-fill known values
  document.getElementById("formRecordId").value   = activeDealer.id || "";
  document.getElementById("formDealerCode").value  = activeDealer.dealer_code || activeDealer.code || "";
  document.getElementById("formPhone").value       = activeDealer.phone || "";
  document.getElementById("formDealerName").textContent = activeDealer.name || "";
  document.getElementById("formDealerType").value = activeDealer.dealer_type || "";

  // Reset form fields
  document.getElementById("formBatteryStock").value     = activeDealer.existing_battery_stock || "";
  document.getElementById("formUpsStock").value         = activeDealer.existing_ups_stock || "";
  document.getElementById("formHighKvUpsStock").value   = activeDealer.existing_high_kv_ups_stock || "";
  document.getElementById("formApproxValue").value      = activeDealer.approx_value_in_outlet || "";
  document.getElementById("formCreditValue").value      = activeDealer.credit_value_with_dealer || "";
  document.getElementById("formFollowUpDate").value    = "";
  document.getElementById("formFollowUpNotes").value   = activeDealer.follow_up_notes || "";
  document.getElementById("formVisitNotes").value      = "";
  document.getElementById("formCompetitionInUse").value= "";
  document.getElementById("formNextFollowUpType").value= "";
}

function closeInfoForm() {
  document.getElementById("infoFormModal").classList.add("hidden");
  document.body.style.overflow = "";
}

async function submitInfoForm() {
  if (!activeDealer) return;
  const btn = document.getElementById("btnFormSubmit");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const fields = {
    Dealer_Type:               document.getElementById("formDealerType").value,
    Existing_Battery_stock:    document.getElementById("formBatteryStock").value,
    Existing_UPS_stock:         document.getElementById("formUpsStock").value,
    Existing_High_KV_UPS_stock: document.getElementById("formHighKvUpsStock").value,
    Approx_value_in_outlet:     document.getElementById("formApproxValue").value,
    Credit_value_with_dealer:   document.getElementById("formCreditValue").value,
    Follow_up_date_and_time:    document.getElementById("formFollowUpDate").value
      ? new Date(document.getElementById("formFollowUpDate").value).toISOString()
      : null,
    Follow_up_notes:           document.getElementById("formFollowUpNotes").value,
  };

  const dealerMeetFields = {
    Visit_Date:          new Date().toISOString().split("T")[0],
    Visit_Notes:         document.getElementById("formVisitNotes").value,
    Competition_In_Use:   document.getElementById("formCompetitionInUse").value,
    Follow_up_Type:      document.getElementById("formNextFollowUpType").value,
    // Image_URL added later via photo form
  };

  try {
    const token = await getZohoToken();
    if (!token) throw new Error("No Zoho token");

    // 1. Update main UPS record (text fields)
    const updateResult = await zohoUpdateRecord(token, activeDealer.id, fields);
    if (!updateResult.ok) throw new Error("Zoho update failed: " + JSON.stringify(updateResult.error));

    // 2. Increment Total_visits
    await zohoIncrementVisits(token, activeDealer.id, activeDealer.visit_count || 0);

    // 3. Create Dealer Meets entry
    const meetResult = await zohoCreateDealerMeet(token, activeDealer.id, dealerMeetFields);
    if (!meetResult.ok) console.warn("Dealer Meets creation partially failed:", meetResult);

    // 4. Update Firebase
    const currentCount = activeDealer.visit_count || 0;
    const visitCount = currentCount + 1;

    await window.FB.db.collection(CONFIG.FIRESTORE_COLLECTION).doc(activeDealer.dealer_code || activeDealer.id).update({
      ...fields,
      visit_count:      visitCount,
      last_visit_date:  new Date().toISOString(),
      follow_up_date_time: fields.Follow_up_date_and_time,
      follow_up_notes: fields.Follow_up_notes,
      existing_battery_stock: fields.Existing_Battery_stock,
      existing_ups_stock: fields.Existing_UPS_stock,
      existing_high_kv_ups_stock: fields.Existing_High_KV_UPS_stock,
      approx_value_in_outlet: fields.Approx_value_in_outlet,
      credit_value_with_dealer: fields.Credit_value_with_dealer,
      dealer_meets: firebase.firestore.FieldValue.arrayUnion({
        ...dealerMeetFields,
        Visit_Number: visitCount,
        submitted_at: new Date().toISOString(),
        record_id: activeDealer.id,
      })
    });

    showToast(`✅ Visit #${visitCount} submitted successfully!`);
    closeInfoForm();
    closeModal();

    // Trigger background sync to refresh list
    setTimeout(() => syncFromZoho(), 1000);

  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit to Zoho CRM";
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON 3: UPLOAD PHOTO (Google Form)
// ─────────────────────────────────────────────────────────────
function openPhotoForm() {
  if (!activeDealer) return;
  if (!CONFIG.GOOGLE_FORM.enabled) {
    showToast("Photo form not configured yet. Create the form first.", "error");
    return;
  }
  const cfg = CONFIG.GOOGLE_FORM;
  const params = new URLSearchParams();
  params.set(cfg.entry_record_id, activeDealer.id || "");
  params.set(cfg.entry_dealer_code, activeDealer.dealer_code || activeDealer.code || "");
  const url = `${cfg.base_url}?${params.toString()}`;
  window.open(url, "_blank");
}

// ── Toast Notification ─────────────────────────────────────
function showToast(message, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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