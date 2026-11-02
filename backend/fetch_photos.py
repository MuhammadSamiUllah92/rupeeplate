"""Download real, openly licensed photos for every meal from Wikimedia Commons.

Run:   python fetch_photos.py              (all meals that do not have a photo yet)
       python fetch_photos.py --force      (replace existing photos)
       python fetch_photos.py b_paratha_omelette c_chicken_rice   (only these meals)

Only photos licensed CC0, public domain, CC BY or CC BY-SA are accepted. The photographer's name and
licence are saved in credits.json and shown under every photo on the website (this is required by the licences).
Search results are not perfect: check the photos, and delete any that look wrong, or edit
data/photo_queries.json and run again with --force. You can also drop in your own photo named <meal id>.jpg.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUERIES = json.loads((ROOT / "data" / "photo_queries.json").read_text(encoding="utf-8"))
# recipes from the Recipes page use the same downloader: photo id = recipe id (r_...)
QUERIES.update({r["id"]: r["photo"] + " food" for r in json.loads((ROOT / "data" / "recipe_book.json").read_text(encoding="utf-8"))})
OUT = ROOT.parent / "frontend" / "public" / "meal-photos"
API = "https://commons.wikimedia.org/w/api.php"
OK_LICENCES = ("cc0", "cc by", "cc-by", "public domain", "pd")
HEADERS = {"User-Agent": "RupeePlate-university-project/1.0 (student project; photos for a meal planner)"}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40).read()


def search(query):
    params = {"action": "query", "generator": "search", "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": 15,
              "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size", "iiurlwidth": 900, "format": "json"}
    data = json.loads(fetch(API + "?" + urllib.parse.urlencode(params)))
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    found = []
    for p in pages:
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        licence = meta.get("LicenseShortName", {}).get("value", "")
        if info.get("mime") != "image/jpeg" or not licence.lower().startswith(OK_LICENCES) or info.get("width", 0) < 600:
            continue
        found.append({"url": info.get("thumburl") or info["url"], "title": p["title"],
                      "author": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "Unknown")).strip()[:80] or "Unknown",
                      "license": licence, "page": info.get("descriptionurl", "")})
    return found


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    cfile = OUT / "credits.json"
    credits = json.loads(cfile.read_text()) if cfile.exists() else {}
    todo = args or list(QUERIES)
    got, missing = 0, []
    for mid in todo:
        if (OUT / f"{mid}.jpg").exists() and not force:
            continue
        try:
            hits = search(QUERIES[mid])
            if not hits:
                missing.append(mid); print(f"  no suitable photo for {mid} ({QUERIES[mid]})"); continue
            h = hits[0]
            (OUT / f"{mid}.jpg").write_bytes(fetch(h["url"]))
            credits[mid] = {k: h[k] for k in ("author", "license", "page", "title")}
            cfile.write_text(json.dumps(credits, indent=1))
            got += 1; print(f"  {mid:<24} {h['title']}  [{h['license']}]")
        except Exception as e:
            missing.append(mid); print(f"  {mid}: failed ({e})")
        time.sleep(1.0)
    print(f"\nDownloaded {got} photos. Missing: {len(missing)}" + (f" -> {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
