import urllib.request
import urllib.parse
import json
import re

def search_locality(locality):
    query = f"physiotherapy clinic in {locality} bangalore reviews rating"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        print(f"[{locality}] HTML fetched length: {len(html)}")
    except Exception as e:
        print(f"Error fetching {locality}: {e}")

search_locality("Panathur")
search_locality("HSR Layout")
