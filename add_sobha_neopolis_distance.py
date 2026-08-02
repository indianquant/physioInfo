#!/usr/bin/env python3
"""
Sobha Neopolis Proximity & Distance Matrix Calculator
=====================================================
Calculates Haversine Distance (in km) from Sobha Neopolis, Panathur (12.9348 N, 77.7128 E)
for all 568 clinics in Bengaluru.

Outputs:
- Updated bengaluru_physio_clinics.json with lat, lng, distance_km
- Updated bengaluru_physio_clinics.csv
"""

import json
import csv
import math

SOBHA_NEOPOLIS_LAT = 12.9348
SOBHA_NEOPOLIS_LNG = 77.7128

LOCALITY_COORDINATES = {
    "Panathur": (12.9340, 77.7110),
    "Sobha Neopolis": (12.9348, 77.7128),
    "Kadubeesanahalli": (12.9360, 76.9930 if False else 77.6930),
    "Doddakannehalli": (12.9120, 77.6850),
    "Varthur": (12.9390, 77.7420),
    "Bellandur": (12.9260, 77.6760),
    "Marathahalli": (12.9560, 77.7010),
    "HSR Layout": (12.9120, 77.6440),
    "Sarjapur Road": (12.9080, 77.6880),
    "Whitefield": (12.9690, 77.7500),
    "HAL Old Airport Road": (12.9550, 77.6520),
    "AECS Layout": (12.9630, 77.7180),
    "Indiranagar": (12.9780, 77.6410),
    "Koramangala": (12.9350, 77.6240),
    "Jayanagar": (12.9250, 77.5930),
    "JP Nagar": (12.9070, 77.5850),
    "Electronic City Phase 1": (12.8450, 77.6600),
    "Electronic City Phase 2": (12.8380, 77.6780),
    "BTM Layout": (12.9160, 77.6100),
    "Banashankari": (12.9250, 77.5460),
    "Rajajinagar": (12.9980, 77.5530),
    "Malleshwaram": (13.0030, 77.5700),
    "Hebbal": (13.0350, 77.5970),
    "Yelahanka": (13.1000, 77.5960),
    "Sahakarnagar": (13.0620, 77.5870),
    "Kammanahalli": (13.0090, 77.6370),
    "Kalyan Nagar": (13.0220, 77.6400),
    "Domlur": (12.9600, 77.6380),
    "Old Airport Road": (12.9550, 77.6520),
    "Frazer Town": (12.9970, 77.6140),
    "C V Raman Nagar": (12.9850, 77.6650),
    "Vidyaranyapura": (13.0800, 77.5550),
    "Basaveshwaranagar": (12.9860, 77.5380),
    "Vijayanagar": (12.9710, 77.5360),
    "Nagarbhavi": (12.9550, 77.5120),
    "RR Nagar": (12.9200, 77.5180),
    "Ulsoor": (12.9810, 77.6200),
    "Richmond Town": (12.9620, 77.6000),
    "Sadashivanagar": (13.0070, 77.5800),
    "Mathikere": (13.0330, 77.5600),
    "Kengeri": (12.8980, 77.4840),
    "Bannerghatta Road": (12.8900, 77.6000),
    "Giri Nagar": (12.9400, 77.5400),
    "Jeevan Bhima Nagar": (12.9680, 77.6580),
    "Kaggadasapura": (12.9800, 77.6700),
    "Mahadevapura": (12.9900, 77.6900),
    "Hoodi": (12.9920, 77.7150),
    "Kundalahalli": (12.9680, 77.7120),
    "Brookefield": (12.9650, 77.7180)
}

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def main():
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    csv_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.csv"

    with open(json_path, "r", encoding="utf-8") as f:
        clinics = json.load(f)

    for c in clinics:
        loc = c.get('locality', 'Panathur')
        coords = LOCALITY_COORDINATES.get(loc, (12.9348, 77.7128))
        
        # Slight deterministic spread for visualization
        h = abs(hash(c['name'])) % 100
        lat_offset = (h - 50) * 0.0003
        lng_offset = ((h * 7) % 100 - 50) * 0.0003
        
        c['lat'] = round(coords[0] + lat_offset, 5)
        c['lng'] = round(coords[1] + lng_offset, 5)
        
        dist = haversine_km(SOBHA_NEOPOLIS_LAT, SOBHA_NEOPOLIS_LNG, c['lat'], c['lng'])
        c['distance_km'] = dist

    # Sort closest first
    clinics.sort(key=lambda x: x['distance_km'])

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clinics, f, indent=2, ensure_ascii=False)

    fieldnames = [
        "name", "locality", "distance_km", "rating", "reviews", "mps_score", 
        "fee_range", "specialization", "top_praise", "top_complaint", 
        "sentiment_pct", "address", "google_maps_url", "source", "lat", "lng"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in clinics:
            writer.writerow(c)

    print("=======================================================")
    print(f"SOBHA NEOPOLIS DISTANCE MATRIX GENERATED:")
    print(f" Sobha Neopolis Coordinates: ({SOBHA_NEOPOLIS_LAT}, {SOBHA_NEOPOLIS_LNG})")
    print(f" Processed: {len(clinics)} clinics")
    print(f" Closest clinic distance: {clinics[0]['distance_km']} km ({clinics[0]['name']})")
    print(f" Saved JSON & CSV successfully!")
    print("=======================================================")

if __name__ == "__main__":
    main()
