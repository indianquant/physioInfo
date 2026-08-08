# Project Directives: Physiotherapy Bengaluru Guide & Agency

## 🔒 Mandatory Behavioral Instructions

### 1. STRICT ZERO-HYPOTHETICAL DATA POLICY
- **NEVER** use hypothetical, fake, or synthetic placeholder data for clinic details, doctor names, patient reviews, rental quotes, or equipment prices.
- All information presented in web apps, mockups, proposals, or guides **MUST** be empirically verified and sourced from:
  - Scraped GMB dataset (`bengaluru_physio_clinics.json`)
  - Live verified property portals (NoBroker, 99acres, MagicBricks)
  - Live medical equipment suppliers (IndiaMART, HospitalStore)
  - Verified WHOIS domain registries

### 2. MANDATORY LEAD PRE-QUALIFICATION VERIFICATION
- **Double-Check Website Absence**: Before selecting ANY lead to target or build a mockup for, perform a deep web search (`"[Clinic Name]" + website`) to verify they do NOT already own a standalone `.com`/`.in` website on the internet. Skip any lead that already owns a website.

### 3. DEMO MOCKUP ACCURACY & MANDATORY SECTIONS
- Any clinic demo website built (e.g., `drpooja/`, `corpergo/`, `govardhan/`) must strictly reflect the clinic's real doctor credentials, actual address, real phone number, real review count, and real patient feedback themes.
- **Mandatory Map Section**: Every website built MUST include an exact Google Maps embedded iframe (`.map-strip`) with the clinic's exact lat/lng and an overlay card with a direct "Get Directions" link pointing to the clinic's Google Maps place page.

### 4. PERSISTENCE & DEPLOYMENT
- All fixes, updates, and demo sites must be committed to git and pushed to GitHub Pages.
- Verify live URLs with `curl -sI` HTTP 200 before reporting completion.
