// ============================================================
// VSS UPS FIELD APP — CONFIG
// ============================================================

const CONFIG = {

  // ── ZOHO CRM (active credentials) ──────────────────────────
  ZOHO: {
    client_id:     "1000.GRI56LMPI3FQGQBZYK7UG2C49XUSDB",
    client_secret: "1e59379b56985f2a94705fffb72f29469186a0453e",
    refresh_token:  "1000.e4908608b3dd0f59d1e09e0f90b28113.e293337cacb1eebd9fa2abcc138f3b7d",
    token_url:     "https://accounts.zoho.in/oauth/v2/token",
    api_base:      "https://crm.zoho.in/crm/v2",
    module:        "UPS",
  },

  // ── GOOGLE FORM (Photo Upload only — placeholder) ──────────
  GOOGLE_FORM: {
    base_url:   "https://docs.google.com/forms/d/YOUR_FORM_ID/viewform",
    entry_record_id: "entry.RECORD_ID",
    entry_dealer_code: "entry.DEALER_CODE",
    enabled: false, // TRUE once user creates the form
  },

  // ── DEALER TYPES (for filters + form) ──────────────────────
  DEALER_TYPES: ["All", "Distributor", "Retailer", "Service Partner", "Institution"],

  // ── FOLLOW-UP TYPES ─────────────────────────────────────────
  FOLLOWUP_TYPES: ["Call", "Visit", "Meeting", "Site Survey", "Demo", "Order Follow-up"],

  // ── FIRESTORE COLLECTION ────────────────────────────────────
  FIRESTORE_COLLECTION: "ups_dealers",

};