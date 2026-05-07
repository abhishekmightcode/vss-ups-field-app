// ============================================================
// VSS UPS FIELD APP — CONFIG
// ============================================================

const CONFIG = {

  // ── ZOHO CRM ──────────────────────────────────────────────
  // These are stored in Hermes memory. DO NOT commit real tokens.
  ZOHO: {
    client_id:     "1000.3JWYP8QJM6S3CIGPPOQ5R8VOUFCQ9Z",
    client_secret: "2145cf205323bd243c721dd33ebb9521b6d41d9ce0",
    refresh_token:  "1000.2034b714368b7f024a7d98a0746442cd.63b5dfcedc97dd27d3bebaf7c71b734e",
    token_url:     "https://accounts.zoho.in/oauth/v2/token",
    api_base:      "https://www.zohoapis.in/crm/v2",
    module:        "UPS",
  },

  // ── GOOGLE FORM ────────────────────────────────────────────
  // TODO: Replace with actual form URL and entry IDs after you create the form
  GOOGLE_FORM: {
    base_url:  "https://docs.google.com/forms/d/e/1FAIpQLSfFormID/viewform",
    entry_name:    "entry.DEALER_NAME_ID",    // TODO: replace
    entry_id:      "entry.RECORD_ID_ID",       // TODO: replace
    entry_phone:   "entry.PHONE_ID",           // TODO: replace
    entry_stage:   "entry.STAGE_ID",           // TODO: replace
    entry_notes:   "entry.NOTES_ID",           // TODO: replace
    entry_photos:  "entry.PHOTOS_ID",          // TODO: replace
    entry_by:      "entry.SUBMITTED_BY_ID",    // TODO: replace
  },

  // ── VISIT STAGES (for display) ─────────────────────────────
  VISIT_STAGES: [
    "New Visit",
    "Follow-up",
    "Site Survey",
    "Order Taken",
    "Installation",
    "AMC",
  ],

  // ── DEALER TYPES (for filters) ──────────────────────────────
  DEALER_TYPES: [
    "All",
    "Distributor",
    "Retailer",
    "Service Partner",
  ],

  // ── FIRESTORE COLLECTION ────────────────────────────────────
  FIRESTORE_COLLECTION: "ups_dealers",

};
