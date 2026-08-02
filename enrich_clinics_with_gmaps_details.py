#!/usr/bin/env python3
"""
Google Places Details & Website Flattener Script
================================================
Queries Google Places Details API for phone numbers, official websites,
and operating hours for clinics in Bengaluru.

Crawls official website pages to extract published session fees.

Outputs:
- Updated bengaluru_physio_clinics.json
- Updated bengaluru_physio_clinics.csv
"""

import os
import sys
import json
import csv
import re
import time
import urllib.request
import urllib.parse
from html import unescape

def extract_fee_from_website(url):
    if not url or not isinstance(url, str) or not url.startswith('http'):
        return None
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # Look for fee patterns like ₹500, Rs. 600, 750 / session
            matches = re.findall(r'(?:₹|Rs\.?|INR)\s*([3-9][0-9]{2}|[1-2][0-9]{3})\s*(?:per|\/|\s)*(?:session|consultation|visit)?', html, re.IGNORECASE)
            if matches:
                fees = [int(m) for m in matches if 300 <= int(m) <= 2500]
                if fees:
                    return f"₹{min(fees)} / session (Website Published)"
    except Exception:
        pass
    return None

def main():
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "AIzaSyCoASrn7P7r9dgodExKvopoTZTI6hxjVDw")
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    with open(json_path, "r", encoding="utf-8") as f:
        clinics = json.load(f)

    print("=======================================================")
    print("ENRICHING CLINICS WITH GMAPS DETAILS & WEBSITE FLATTENER")
    print("=======================================================")
    print(f"Processing {len(clinics)} clinics...")

    enriched_count = 0
    fees_found_count = 0

    # Enrich top 100 clinics to manage API quota & keep execution fast
    for idx, c in enumerate(clinics[:100]):
        place_url = c.get('google_maps_url', '')
        place_id_match = re.search(r'place_id:([A-Za-z0-9_-]+)', place_url)
        
        if place_id_match:
            place_id = place_id_match.group(1)
            details_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=formatted_phone_number,website,opening_hours&key={api_key}"
            
            try:
                req = urllib.request.Request(details_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    res = data.get('result', {})
                    
                    phone = res.get('formatted_phone_number') or res.get('international_phone_number') or 'N/A'
                    website = res.get('website') or 'N/A'
                    opening_hours = res.get('opening_hours', {}).get('weekday_text', [])
                    
                    c['phone'] = phone
                    c['website'] = website
                    c['opening_hours'] = opening_hours[0] if opening_hours else "N/A"
                    
                    # Attempt website flattening for session fee
                    if website != 'N/A':
                        web_fee = extract_fee_from_website(website)
                        if web_fee:
                            c['fee_range'] = web_fee
                            fees_found_count += 1
                            print(f"[{idx+1}/100] ✓ Found website fee for {c['name']}: {web_fee}")

                    enriched_count += 1
                    time.sleep(0.15)
            except Exception as e:
                pass
        else:
            c['phone'] = c.get('phone', 'N/A')
            c['website'] = c.get('website', 'N/A')
            c['opening_hours'] = c.get('opening_hours', 'N/A')

    # Save updated JSON & CSV
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clinics, f, indent=2, ensure_ascii=False)

    fieldnames = [
        "name", "locality", "distance_km", "rating", "reviews", "mps_score", 
        "fee_range", "phone", "website", "opening_hours", "specialization", 
        "top_praise", "top_complaint", "sentiment_pct", "address", 
        "google_maps_url", "source", "lat", "lng"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for c in clinics:
            writer.writerow(c)

    print("\n=======================================================")
    print(f"ENRICHMENT COMPLETE:")
    print(f" Enriched with Phone, Website & Hours: {enriched_count} clinics")
    print(f" Extracted Session Fees from Official Websites: {fees_found_count} clinics")
    print(" Saved JSON & CSV successfully!")
    print("=======================================================")

if __name__ == "__main__":
    main()
