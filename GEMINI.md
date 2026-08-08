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
- **Mandatory Phone Number & WhatsApp Verification**: Before suggesting a phone number to send a WhatsApp pitch to, verify that the number is empirically sourced from GMB/Practo/Apollo247/Justdial listings, is a valid 10-digit Indian mobile number (`+91 XXXXX XXXXX`), and belongs specifically to the target clinic location.

### 3. DEMO MOCKUP ACCURACY & MANDATORY SECTIONS
- Any clinic demo website built (e.g., `drpooja/`, `corpergo/`, `govardhan/`) must strictly reflect the clinic's real doctor credentials, actual address, real phone number, real review count, and real patient feedback themes.
- **Mandatory Map Section**: Every website built MUST include an exact Google Maps embedded iframe (`.map-strip`) with the clinic's exact lat/lng and an overlay card with a direct "Get Directions" link pointing to the clinic's Google Maps place page.
- **Mandatory Agency Contact Banner**: Every demo website MUST feature a top `.demo-banner` linking interested prospects to the founder via WhatsApp (`+91-8770855796` / `https://wa.me/918770855796`) and Email (`quantindian@gmail.com`).
- **Mandatory Mobile-First Optimization**: Since >85% of doctor/prospect clicks come from mobile WhatsApp chats, all websites must feature 48px+ touch targets, single-column flex grids on ≤480px screens, responsive text scaling, and clean sticky banners.

### 4. PERSISTENCE & DEPLOYMENT
- All fixes, updates, and demo sites must be committed to git and pushed to GitHub Pages.
- Verify live URLs with `curl -sI` HTTP 200 before reporting completion.
