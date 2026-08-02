#!/usr/bin/env python3
"""
Bengaluru Google Places API Live Scanner (Environment Variable Security Pattern)
==================================================================================
Scans sub-localities across Bengaluru Urban via official Google Places API.

SECURITY NOTE:
- Never hardcodes API keys in source code.
- Reads GOOGLE_MAPS_API_KEY strictly from environment variable or interactive prompt.

Outputs:
- bengaluru_physio_clinics.json
- bengaluru_physio_clinics.csv
"""

import os
import sys
import json
import csv
import math
import time
import urllib.request
import urllib.parse

# 50 Major Sub-Localities covering Bengaluru Urban
BENGALURU_LOCALITIES = [
    "Panathur", "Kadubeesanahalli", "Varthur", "Sobha Neopolis", "Bellandur",
    "HSR Layout", "Indiranagar", "Koramangala", "Jayanagar", "JP Nagar",
    "Whitefield", "Marathahalli", "Sarjapur Road", "Electronic City Phase 1",
    "Electronic City Phase 2", "BTM Layout", "Banashankari", "Rajajinagar",
    "Malleshwaram", "Hebbal", "Yelahanka", "Sahakarnagar", "Kammanahalli",
    "Kalyan Nagar", "Domlur", "Old Airport Road", "Frazer Town", "C V Raman Nagar",
    "Doddakannehalli", "Vidyaranyapura", "Basaveshwaranagar", "Vijayanagar",
    "Nagarbhavi", "RR Nagar", "Ulsoor", "Richmond Town", "Sadashivanagar",
    "Mathikere", "Kengeri", "Bannerghatta Road", "Giri Nagar", "Jeevan Bhima Nagar",
    "Kaggadasapura", "Mahadevapura", "Hoodi", "Kundalahalli", "Brookefield"
]

def scan_google_places(api_key):
    print("=======================================================")
    print("STARTING LIVE GOOGLE PLACES API SCAN ACROSS BENGALURU")
    print("=======================================================")
    
    base_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    clinics = []
    seen_place_ids = set()

    for idx, loc in enumerate(BENGALURU_LOCALITIES):
        query = f"physiotherapy clinic in {loc} Bengaluru"
        url = f"{base_url}?query={urllib.parse.quote(query)}&key={api_key}"
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                status = data.get('status')
                
                if status != 'OK' and status != 'ZERO_RESULTS':
                    print(f"[{loc}] API Status: {status} - {data.get('error_message', '')}")
                    if status == 'REQUEST_DENIED':
                        print("\n❌ API Key invalid or request denied.")
                        return None
                
                results = data.get('results', [])
                count = 0
                for p in results:
                    place_id = p.get('place_id')
                    if place_id and place_id not in seen_place_ids:
                        seen_place_ids.add(place_id)
                        
                        rating = float(p.get('rating', 0))
                        reviews = int(p.get('user_ratings_total', 0))
                        mps = round(rating * math.log10(reviews + 1), 2) if rating and reviews else "N/A"

                        clinics.append({
                            "name": p.get("name"),
                            "locality": loc,
                            "rating": rating if rating else "N/A",
                            "reviews": reviews if reviews else "N/A",
                            "mps_score": mps,
                            "fee_range": "N/A (Contact Clinic)",
                            "specialization": "Physiotherapy & Rehabilitation",
                            "top_praise": "N/A",
                            "top_complaint": "N/A",
                            "sentiment_pct": "N/A",
                            "address": p.get("formatted_address", f"{loc}, Bengaluru"),
                            "google_maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}",
                            "source": "Official Google Places API"
                        })
                        count += 1
                        
                print(f"[{idx+1}/{len(BENGALURU_LOCALITIES)}] ✓ {loc}: Fetched {count} live clinics")
                time.sleep(0.5)

        except Exception as e:
            print(f"[{loc}] Error: {e}")

    return clinics

def main():
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        api_key = input("Enter your GOOGLE_MAPS_API_KEY: ").strip()

    if not api_key:
        print("No API key provided. Exiting.")
        sys.exit(1)

    clinics = scan_google_places(api_key)

    if not clinics:
        print("\nScan aborted or returned no results.")
        sys.exit(1)

    clinics.sort(key=lambda x: (x.get('reviews') if isinstance(x.get('reviews'), (int, float)) else -1), reverse=True)

    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clinics, f, indent=2, ensure_ascii=False)

    fieldnames = [
        "name", "locality", "rating", "reviews", "mps_score", 
        "fee_range", "specialization", "top_praise", "top_complaint", 
        "sentiment_pct", "address", "google_maps_url", "source"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in clinics:
            writer.writerow(c)

    print(f"\n=======================================================")
    print(f"SUCCESS: Extracted {len(clinics)} LIVE GOOGLE MAPS CLINICS across Bengaluru!")
    print(f" Saved JSON -> {json_path}")
    print(f" Saved CSV  -> {csv_path}")
    print("=======================================================")

if __name__ == "__main__":
    main()
