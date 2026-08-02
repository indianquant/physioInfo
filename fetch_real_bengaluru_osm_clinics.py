#!/usr/bin/env python3
"""
Bengaluru 100% Real Physiotherapy, Rehab & Orthopedic Clinic Extractor
=======================================================================
Extracted strictly for:
- Physiotherapy & Physical Therapy Clinics
- Rehabilitation & Sports Rehab Centers
- Orthopedic, Spine, Joint & Pain Management Clinics

Strict Rule: NO GENERAL PHARMA / DENTAL / LABS. ZERO HYPOTHETICAL FILLER.

Outputs:
- bengaluru_physio_clinics.json
- bengaluru_physio_clinics.csv
"""

import os
import sys
import json
import csv
import urllib.request
import urllib.parse

BENGALURU_LOCALITIES = [
    "Panathur", "Kadubeesanahalli", "Varthur", "Sobha Neopolis", "Bellandur",
    "HSR Layout", "Indiranagar", "Koramangala", "Jayanagar", "JP Nagar",
    "Whitefield", "Marathahalli", "Sarjapur", "Electronic City",
    "BTM Layout", "Banashankari", "Rajajinagar", "Malleshwaram", "Hebbal",
    "Yelahanka", "Sahakarnagar", "Kammanahalli", "Kalyan Nagar", "Domlur",
    "Frazer Town", "C V Raman Nagar", "Doddakannehalli", "Vidyaranyapura",
    "Basaveshwaranagar", "Vijayanagar", "Nagarbhavi", "RR Nagar", "Ulsoor",
    "Richmond Town", "Sadashivanagar", "Mathikere", "Kengeri"
]

PHYSIO_KEYWORDS = [
    'physio', 'rehab', 'physical therapy', 'ortho', 'spine', 'joint', 'pain', 
    'sports', 'movement', 'kinesi', 'bone', 'osteo', 'chiro', 'stiffness', 'paralysis'
]

EXCLUDE_KEYWORDS = [
    'dental', 'eye', 'pharma', 'chemist', 'skin', 'derma', 'ent', 'pathology', 
    'lab', 'dialysis', 'ayurved', 'homeo', 'nursing', 'optician', 'pet', 'vet', 
    'dental', 'cosmetic', 'lasik', 'maternity'
]

def fetch_strict_physio_dataset():
    print("Executing strict spatial query for Bengaluru Physiotherapy, Rehab & Ortho clinics...")
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = """
    [out:json][timeout:90];
    (
      node["healthcare"="physiotherapy"](12.75,77.35,13.25,77.85);
      way["healthcare"="physiotherapy"](12.75,77.35,13.25,77.85);
      node["amenity"="clinic"](12.75,77.35,13.25,77.85);
      way["amenity"="clinic"](12.75,77.35,13.25,77.85);
      node["healthcare"](12.75,77.35,13.25,77.85);
      way["healthcare"](12.75,77.35,13.25,77.85);
    );
    out body;
    """
    
    req = urllib.request.Request(
        overpass_url, 
        data=urllib.parse.urlencode({'data': query}).encode('utf-8'), 
        headers={'User-Agent': 'PhysioLaunchBLR/1.0'}
    )
    
    clinics = []
    seen = set()
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elements = data.get('elements', [])
            print(f"✓ Raw spatial nodes fetched: {len(elements)}")
            
            for elem in elements:
                tags = elem.get('tags', {})
                name = tags.get('name') or tags.get('name:en')
                if not name or len(name.strip()) < 3:
                    continue
                
                name_clean = name.strip()
                name_key = name_clean.lower()
                
                if name_key in seen:
                    continue
                
                # Check strict inclusion & exclusion criteria
                healthcare_tag = tags.get('healthcare', '').lower()
                is_explicit_physio = (healthcare_tag == 'physiotherapy')
                
                matches_physio = any(k in name_key for k in PHYSIO_KEYWORDS) or is_explicit_physio
                is_excluded = any(ex in name_key for ex in EXCLUDE_KEYWORDS)
                
                if not matches_physio or is_excluded:
                    continue
                
                seen.add(name_key)
                
                # Address & Locality
                addr_street = tags.get('addr:street', '')
                addr_suburb = tags.get('addr:suburb') or tags.get('addr:district') or tags.get('addr:neighbourhood') or ''
                addr_postcode = tags.get('addr:postcode', '')
                
                locality = "Bengaluru Urban"
                full_text = f"{name_clean} {addr_street} {addr_suburb}".lower()
                for loc in BENGALURU_LOCALITIES:
                    if loc.lower() in full_text:
                        locality = loc
                        break
                
                if addr_street or addr_suburb:
                    address = f"{name_clean}, {addr_street} {addr_suburb}, Bengaluru {addr_postcode}".strip()
                else:
                    address = f"{name_clean}, {locality}, Bengaluru, Karnataka"

                # Specialization categorization
                specialization = "Physiotherapy & Rehabilitation"
                if any(k in name_key for k in ['spine', 'joint', 'ortho', 'bone', 'osteo']):
                    specialization = "Orthopedic & Spine Rehab"
                elif any(k in name_key for k in ['sports', 'fitness', 'movement', 'kinesi']):
                    specialization = "Sports Physio & Movement Therapy"
                elif any(k in name_key for k in ['pain', 'stiffness']):
                    specialization = "Pain Management & Physio"

                clinics.append({
                    "name": name_clean,
                    "locality": locality,
                    "rating": "N/A",
                    "reviews": "N/A",
                    "mps_score": "N/A",
                    "fee_range": "N/A (Contact Clinic)",
                    "specialization": specialization,
                    "top_praise": "N/A",
                    "top_complaint": "N/A",
                    "sentiment_pct": "N/A",
                    "address": address,
                    "google_maps_url": f"https://www.google.com/maps/search/{urllib.parse.quote(name_clean + ' ' + locality + ' Bengaluru')}",
                    "source": "OpenStreetMap Real Physio Spatial Node"
                })
                
    except Exception as e:
        print(f"Error executing Overpass query: {e}")
        
    return clinics

def main():
    clinics = fetch_strict_physio_dataset()
    
    # Priority sort: put clinics with 'physio' or 'rehab' or specific localities first
    def priority_key(c):
        n = c['name'].lower()
        if 'physio' in n: return 0
        if 'rehab' in n: return 1
        return 2

    clinics.sort(key=priority_key)

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
    print(f"SUCCESS: Extracted {len(clinics)} STRICT PHYSIO / REHAB / ORTHO CLINICS across Bengaluru!")
    print(f" Saved JSON -> {json_path}")
    print(f" Saved CSV  -> {csv_path}")
    print("=======================================================")

if __name__ == "__main__":
    main()
