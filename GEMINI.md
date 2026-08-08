# Project Directives: Physiotherapy Bengaluru Guide & Agency

## 🔒 Mandatory Behavioral Instructions

### 1. STRICT ZERO-HYPOTHETICAL DATA POLICY
- **NEVER** use hypothetical, fake, or synthetic placeholder data for clinic details, doctor names, patient reviews, rental quotes, or equipment prices.
- All information presented in web apps, mockups, proposals, or guides **MUST** be empirically verified and sourced from:
  - Scraped GMB dataset (`bengaluru_physio_clinics.json`)
  - Live verified property portals (NoBroker, 99acres, MagicBricks)
  - Live medical equipment suppliers (IndiaMART, HospitalStore)
  - Verified WHOIS domain registries

### 2. DEMO MOCKUP ACCURACY
- Any clinic demo website built (e.g., `drpooja/`, `corpergo/`) must strictly reflect the clinic's real doctor credentials, actual address, real phone number, real review count, and real patient feedback themes.

### 3. PERSISTENCE & DEPLOYMENT
- All fixes, updates, and demo sites must be committed to git and pushed to GitHub Pages.
- Verify live URLs with `curl -sI` HTTP 200 before reporting completion.
