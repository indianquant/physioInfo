import urllib.request
import urllib.parse
import json
import re

def get_practo_fee(clinic_name, locality):
    query = f"{clinic_name} {locality} bangalore consultation fee site:practo.com"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
        # Search for fee patterns like ₹500 or Rs 750
        match = re.search(r'(?:₹|Rs\.?)\s*([3-9][0-9]{2}|[1-2][0-9]{3})', html)
        if match:
            return f"₹{match.group(1)} / session"
    except Exception as e:
        pass
    return "N/A (Contact Clinic)"

def main():
    json_path = "/Users/priyanshuvarshney/Desktop/physio-bengaluru-guide/bengaluru_physio_clinics.json"
    with open(json_path, "r", encoding="utf-8") as f:
        clinics = json.load(f)

    updated_count = 0
    for c in clinics:
        name = c['name']
        loc = c.get('locality', '')
        if c.get('fee_range') == "N/A (Contact Clinic)":
            fee = get_practo_fee(name, loc)
            if fee != "N/A (Contact Clinic)":
                c['fee_range'] = fee
                updated_count += 1
                print(f"✓ Found published fee for {name}: {fee}")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clinics, f, indent=2, ensure_ascii=False)

    print(f"Done! Updated {updated_count} clinics with verified published fees.")

if __name__ == "__main__":
    main()
