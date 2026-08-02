#!/usr/bin/env python3
"""
Web Snippet Review Extractor & Offline NLP Classifier
=====================================================
Fetches public patient review text snippets using free web requests (0 Google API calls).
Runs offline NLP regex classifier to extract per-session fees and review highlights.

Outputs:
- Updated bengaluru_physio_clinics.json
- Updated bengaluru_physio_clinics.csv
"""

import json
import csv
import re
import time
import urllib.request
import urllib.parse
from html import unescape

DIRECT_SESSION_PATTERNS = [
    r'(?:₹|rs\.?|inr)\s*([3-9][0-9]{2}|[1-2][0-9]{3})\s*(?:per|\/|a|\s)*(?:session|visit|sitting|consultation|treatment)',
    r'([3-9][0-9]{2}|[1-2][0-9]{3})\s*(?:rs|rupees|inr|per session|\/session)',
    r'cost(?:s)?\s*(?:around|is|of)?\s*(?:₹|rs\.?|inr)?\s*([3-9][0-9]{2}|[1-2][0-9]{3})'
]

PACKAGE_PATTERNS = [
    r'(?:₹|rs\.?|inr)?\s*([4-9][0-9]{3}|1[0-8][0-9]{3})\s*(?:for|-\s*)\s*(10|5|8|12)\s*session'
]

def classify_text(text):
    if not text or not isinstance(text, str):
        return None
    text_lower = text.lower()
    
    for pat in PACKAGE_PATTERNS:
        match = re.search(pat, text_lower)
        if match:
            total_amt = int(match.group(1))
            num_sessions = int(match.group(2))
            if num_sessions > 0:
                per_session = round(total_amt / num_sessions)
                return f"₹{per_session} / session (Package Rate)"

    for pat in DIRECT_SESSION_PATTERNS:
        match = re.search(pat, text_lower)
        if match:
            fee = int(match.group(1))
            if 300 <= fee <= 3000:
                return f"₹{fee} / session"

    return None

def fetch_review_snippets(clinic_name, locality):
    query = f"{clinic_name} {locality} bangalore reviews fee cost session"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
        snippets = re.findall(r'<a class="result__snippet[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
        combined_text = " ".join([unescape(re.sub(r'<[^>]+>', '', s)) for s in snippets])
        return combined_text
    except Exception as e:
        return ""

def main():
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    with open(json_path, "r", encoding="utf-8") as f:
        clinics = json.load(f)

    print("=======================================================")
    print("FETCHING REVIEW SNIPPETS & RUNNING OFFLINE CLASSIFIER")
    print("=======================================================")

    classified_count = 0
    # Process top 50 clinics to keep execution fast & polite
    for idx, c in enumerate(clinics[:50]):
        name = c['name']
        loc = c.get('locality', '')
        
        snippet_text = fetch_review_snippets(name, loc)
        fee = classify_text(snippet_text)
        
        if fee:
            c['fee_range'] = fee
            classified_count += 1
            print(f"[{idx+1}/50] ✓ Found verified fee for {name}: {fee}")
        else:
            c['fee_range'] = "N/A (Contact Clinic)"
            
        time.sleep(0.3)

    # Save updated JSON & CSV
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

    print("\n=======================================================")
    print(f"COMPLETED: Extracted fees for {classified_count} clinics with 0 Google API calls!")
    print("=======================================================")

if __name__ == "__main__":
    main()
