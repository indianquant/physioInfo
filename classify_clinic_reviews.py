#!/usr/bin/env python3
"""
Offline NLP Review Classifier & Session Cost Extractor
======================================================
100% Offline Python NLP script. Operates locally on scraped review text & web snippets.
Makes ZERO paid API calls.

Uses context-aware regex & NLP classification:
1. Direct session fee patterns ("₹700 per session", "500 rs consultation")
2. Package fee division ("₹6000 for 10 sessions" -> ₹600/session)
3. Consultation fee patterns ("Rs 800 consultation fee")

Outputs:
- Updated bengaluru_physio_clinics.json
- Updated bengaluru_physio_clinics.csv
"""

import json
import csv
import re
import sys

# Offline NLP Pattern Classifiers
DIRECT_SESSION_PATTERNS = [
    r'(?:₹|rs\.?|inr)\s*([3-9][0-9]{2}|[1-2][0-9]{3})\s*(?:per|\/|a|\s)*(?:session|visit|sitting|consultation|treatment)',
    r'([3-9][0-9]{2}|[1-2][0-9]{3})\s*(?:rs|rupees|inr|per session|\/session)',
    r'cost(?:s)?\s*(?:around|is|of)?\s*(?:₹|rs\.?|inr)?\s*([3-9][0-9]{2}|[1-2][0-9]{3})'
]

PACKAGE_PATTERNS = [
    r'(?:₹|rs\.?|inr)?\s*([4-9][0-9]{3}|1[0-8][0-9]{3})\s*(?:for|-\s*)\s*(10|5|8|12)\s*session'
]

def classify_review_text(text):
    if not text or not isinstance(text, str):
        return None
    
    text_lower = text.lower()
    
    # 1. Test Package Division First
    for pat in PACKAGE_PATTERNS:
        match = re.search(pat, text_lower)
        if match:
            total_amt = int(match.group(1))
            num_sessions = int(match.group(2))
            if num_sessions > 0:
                per_session = round(total_amt / num_sessions)
                return f"₹{per_session} / session (Package Rate)"

    # 2. Test Direct Session Fee Patterns
    for pat in DIRECT_SESSION_PATTERNS:
        match = re.search(pat, text_lower)
        if match:
            fee = int(match.group(1))
            if 300 <= fee <= 3000:
                return f"₹{fee} / session"

    return None

def main():
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            clinics = json.load(f)
    except Exception as e:
        print(f"Error loading {json_path}: {e}")
        sys.exit(1)

    print("=======================================================")
    print("RUNNING 100% OFFLINE NLP REVIEW CLASSIFIER (0 API CALLS)")
    print("=======================================================")
    print(f"Analyzing review text & snippets across {len(clinics)} clinics...")

    extracted_count = 0
    for c in clinics:
        # Check snippet or address text for review comments
        review_snippet = c.get('review_snippet') or c.get('top_praise') or c.get('address') or ''
        cost_classified = classify_review_text(review_snippet)
        
        if cost_classified:
            c['fee_range'] = cost_classified
            extracted_count += 1
        elif c.get('fee_range') not in [None, '', 'N/A']:
            # Keep existing fee if present
            pass
        else:
            c['fee_range'] = "N/A (Contact Clinic)"

    # Save updated JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clinics, f, indent=2, ensure_ascii=False)

    # Save updated CSV
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
    print(f"OFFLINE CLASSIFICATION COMPLETE:")
    print(f" Analyzed: {len(clinics)} total clinics")
    print(f" Extracted per-session fees: {extracted_count} clinics")
    print(f" Remaining unmentioned: {len(clinics) - extracted_count} marked strictly as N/A")
    print(f" Paid API Calls Made: ZERO (0)")
    print("=======================================================")

if __name__ == "__main__":
    main()
