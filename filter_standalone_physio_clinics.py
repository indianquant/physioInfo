#!/usr/bin/env python3
"""
Bengaluru Standalone Physiotherapy & Rehab Clinic Filter
========================================================
Filters the database strictly for standalone, dedicated physiotherapy
and rehabilitation practices.

Strict Exclusion:
- Multispecialty Hospitals (Manipal, Apollo, Fortis, Sakra, Aster, etc.)
- Multi-department Polyclinics, Diagnostic Centers & Nursing Homes
- General OPDs

Outputs:
- Updated bengaluru_physio_clinics.json
- Updated bengaluru_physio_clinics.csv
"""

import json
import csv
import math

HOSPITAL_KEYWORDS = [
    'hospital', 'multispecialty', 'multi-speciality', 'nursing home', 
    'diagnostics', 'apollo', 'manipal', 'fortis', 'sakra', 'sparsh', 
    'aster', 'columbia', 'medical centre', 'medical center', 'polyclinic'
]

PHYSIO_KEYWORDS = [
    'physio', 'rehab', 'physical therapy', 'spine', 'joint', 'posture', 
    'sports rehab', 'movement', 'kinesi', 'chiro'
]

def main():
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    standalone_clinics = []
    seen = set()

    for c in data:
        name = c['name']
        name_lower = name.lower()
        
        if name_lower in seen:
            continue

        is_physio = any(pk in name_lower for pk in PHYSIO_KEYWORDS)
        is_hospital = any(hk in name_lower for hk in HOSPITAL_KEYWORDS)

        if is_physio and not is_hospital:
            seen.add(name_lower)
            c['specialization'] = "Standalone Physiotherapy & Rehab"
            standalone_clinics.append(c)

    # Sort by review count
    standalone_clinics.sort(key=lambda x: (x.get('reviews') if isinstance(x.get('reviews'), (int, float)) else -1), reverse=True)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(standalone_clinics, f, indent=2, ensure_ascii=False)

    fieldnames = [
        "name", "locality", "rating", "reviews", "mps_score", 
        "fee_range", "specialization", "top_praise", "top_complaint", 
        "sentiment_pct", "address", "google_maps_url", "source"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in standalone_clinics:
            writer.writerow(c)

    print("=======================================================")
    print(f"STANDALONE PHYSIO FILTER COMPLETE:")
    print(f" Retained: {len(standalone_clinics)} Standalone Physiotherapy & Rehab Clinics")
    print(f" Filtered Out: {len(data) - len(standalone_clinics)} Hospitals & Polyclinics")
    print(" Saved JSON & CSV successfully!")
    print("=======================================================")

if __name__ == "__main__":
    main()
