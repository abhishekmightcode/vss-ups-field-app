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
    document.getElementById("totalVisits").textContent = "000";

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

// ── WEBHOOK: n8n Workflow ─────────────────────────────────
// All field data goes to n8n webhook — different payloads per action

const WEBHOOK_URL = "https://vsustainsolar.app.n8n.cloud/webhook/ed515a09-7182-4541-9f7d-5b356d2e5770";

// Helper: send JSON to n8n webhook
async function sendToWebhook(payload) {
  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { ok: resp.ok, status: resp.status, body: json };
  } catch (err) {
    return { ok: false, status: 0, body: {}, error: err.message };
  }
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

// ── Firebase: Reload dealer list ──────────────────────────
async function reloadFromFirebase() {
  const snap = await window.FB.db
    .collection(CONFIG.FIRESTORE_COLLECTION)
    .orderBy("name")
    .get();
  allDealers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  filteredDealers = allDealers;
  renderDealers();
  document.getElementById("totalDealers").textContent = allDealers.length;
  document.getElementById("totalVisits").textContent = "000";
}

// ── Firebase: Write All Zoho Records ───────────────────────
async function syncFromZoho() {
  if (syncInProgress) return;
  syncInProgress = true;

  const badge = document.getElementById("syncBadge");
  badge.classList.add("syncing");
  badge.textContent = "↻";

  try {
    // Reload from Firebase (dealers seeded by server-side sync from Zoho)
    await reloadFromFirebase();
    lastSyncTime = new Date();
    document.getElementById("lastSync").textContent = "Just now";
    badge.classList.remove("syncing");
    badge.textContent = "●";

  } catch (err) {
    console.error("Firebase reload error:", err);
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
  document.getElementById("modalRecordId").textContent    = d.id || "—";
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
  document.getElementById("btnRecordMeeting").disabled = false;

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

  btn.textContent = "Sending...";

  try {
    // Payload for Send Location — lightweight ping with GPS
    const payload = {
      action: "send_location",
      timestamp: new Date().toISOString(),
      dealer: {
        zoho_id:    activeDealer.id,
        dealer_code: activeDealer.dealer_code || activeDealer.code || "",
        name:        activeDealer.name || ""
      },
      location: {
        latitude:  pos.lat,
        longitude: pos.lng,
        accuracy:  pos.accuracy || null
      }
    };

    const result = await sendToWebhook(payload);

    if (result.ok) {
      showToast("📍 Location sent successfully ✓");
      document.getElementById("modalLocationStatus").textContent =
        `${parseFloat(pos.lat).toFixed(4)}, ${parseFloat(pos.lng).toFixed(4)}`;
      document.getElementById("modalLocationStatus").classList.add("synced");
    } else {
      const errMsg = result.error || (result.body?.message || "Webhook failed");
      showToast("Failed: " + errMsg, "error");
    }
  } catch (err) {
    console.error("sendLocation error:", err);
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
    Existing_UPS_stock:        document.getElementById("formUpsStock").value,
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
  };

  try {
    // Payload for Submit Info — full dealer info + visit record
    const payload = {
      action: "submit_info",
      timestamp: new Date().toISOString(),
      dealer: {
        zoho_id:     activeDealer.id,
        dealer_code: activeDealer.dealer_code || activeDealer.code || "",
        name:        activeDealer.name || "",
        phone:       activeDealer.phone || ""
      },
      visit: {
        visit_number: (activeDealer.visit_count || 0) + 1,
        visit_date:   new Date().toISOString().split("T")[0],
        visit_notes:  document.getElementById("formVisitNotes").value,
        competition_in_use: document.getElementById("formCompetitionInUse").value,
        follow_up_type:     document.getElementById("formNextFollowUpType").value,
      },
      fields: {
        Dealer_Type:               fields.Dealer_Type,
        Existing_Battery_stock:     fields.Existing_Battery_stock,
        Existing_UPS_stock:         fields.Existing_UPS_stock,
        Existing_High_KV_UPS_stock: fields.Existing_High_KV_UPS_stock,
        Approx_value_in_outlet:     fields.Approx_value_in_outlet,
        Credit_value_with_dealer:   fields.Credit_value_with_dealer,
        Follow_up_date_and_time:    fields.Follow_up_date_and_time,
        Follow_up_notes:            fields.Follow_up_notes,
      }
    };

    const result = await sendToWebhook(payload);

    if (!result.ok) {
      const errMsg = result.error || (result.body?.message || "Webhook failed");
      showToast("Failed: " + errMsg, "error");
      btn.disabled = false;
      btn.textContent = "Submit to Zoho CRM";
      return;
    }

    showToast("✅ Info submitted! n8n will push to Zoho.");
    closeInfoForm();
    closeModal();

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

// ─────────────────────────────────────────────────────────────
// BUTTON 4: RECORD MEETING (Dealer Meets sub-form)
// ─────────────────────────────────────────────────────────────
async function openMeetingForm() {
  if (!activeDealer) return;
  const visitNum = (activeDealer.visit_count || 0) + 1;
  document.getElementById("meetingDealerName").textContent  = activeDealer.name || "";
  document.getElementById("meetingRecordId").value          = activeDealer.id || "";
  document.getElementById("meetingDealerCode").value        = activeDealer.dealer_code || activeDealer.code || "";
  document.getElementById("meetingVisitNumber").textContent = "#" + visitNum;
  document.getElementById("meetingDate").textContent        = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  // Clear form
  document.getElementById("meetingPurpose").value    = "";
  document.getElementById("meetingNotes").value      = "";
  document.getElementById("meetingCompetition").value= "";
  document.getElementById("meetingOutcome").value    = "";
  document.getElementById("meetingNextType").value   = "";
  document.getElementById("meetingNextDate").value   = "";
  document.getElementById("meetingOrderValue").value= "";

  document.getElementById("meetingFormModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeMeetingForm() {
  document.getElementById("meetingFormModal").classList.add("hidden");
  document.body.style.overflow = "";
}

async function submitMeetingForm() {
  if (!activeDealer) return;
  const btn = document.getElementById("btnMeetingSubmit");
  btn.disabled = true;
  btn.textContent = "Sending...";

  const visitNum = (activeDealer.visit_count || 0) + 1;

  const payload = {
    action: "record_meeting",
    timestamp: new Date().toISOString(),
    dealer: {
      zoho_id:     activeDealer.id,
      dealer_code: activeDealer.dealer_code || activeDealer.code || "",
      name:        activeDealer.name || "",
      phone:       activeDealer.phone || ""
    },
    meeting: {
      visit_number:     visitNum,
      visit_date:       new Date().toISOString().split("T")[0],
      visit_purpose:    document.getElementById("meetingPurpose").value,
      visit_notes:      document.getElementById("meetingNotes").value,
      competition:      document.getElementById("meetingCompetition").value,
      outcome:          document.getElementById("meetingOutcome").value,
      next_follow_type: document.getElementById("meetingNextType").value,
      next_follow_date: document.getElementById("meetingNextDate").value || null,
      order_value_expected: document.getElementById("meetingOrderValue").value || null,
    }
  };

  try {
    const result = await sendToWebhook(payload);

    if (!result.ok) {
      const errMsg = result.error || (result.body?.message || "Webhook failed");
      showToast("Failed: " + errMsg, "error");
      btn.disabled = false;
      btn.textContent = "Submit Meeting";
      return;
    }

    showToast("✅ Meeting recorded! n8n will push to Zoho.");
    closeMeetingForm();
    closeModal();

  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Meeting";
  }
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