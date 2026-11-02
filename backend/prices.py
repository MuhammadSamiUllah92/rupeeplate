"""Automatic price updates from the Pakistan Bureau of Statistics (PBS) weekly SPI annex.

Run by hand:   python prices.py            (downloads the latest report)
               python prices.py --file report.pdf   (reads a PDF you downloaded)
               python prices.py --text report.txt   (reads text copied from the PDF)
Schedule it daily with Windows Task Scheduler (see README).  The website's
"Update prices" button calls the same code.
"""
import io
import json
import re
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

LIVE = Path(__file__).with_name("data") / "prices_live.json"
URL = "https://www.pbs.gov.pk/wp-content/uploads/2020/07/Annex_{d}.pdf"

# (ingredient ids, name as printed by PBS, divide by, multiply by)
MAP = [
    (["atta"], "Wheat Flour Bag 20 Kg", 20, 1),          # 20 kg bag -> per kg
    (["rice"], "Rice IRRI-6/9", 1, 1),
    (["masoor"], "Pulse Masoor", 1, 1),
    (["mash"], "Pulse Mash", 1, 1),
    (["chana_daal", "chana"], "Pulse Gram", 1, 1),
    (["potato"], "Potatoes", 1, 1),
    (["onion"], "Onions", 1, 1),
    (["tomato"], "Tomatoes", 1, 1),
    (["sugar"], "Sugar Refined", 1, 1),
    (["egg"], "Eggs Hen", 12, 1),                         # per dozen -> each
    (["milk"], "Milk fresh", 1, 1),
    (["dahi"], "Curd", 1, 1),
    (["beef"], "Beef with Bone", 1, 1),
    (["chicken"], "Chicken Farm Broiler", 1, 1.45),       # live weight -> dressed meat (estimate)
    (["banana"], "Bananas", 12, 1),                       # per dozen -> each
    (["oil"], "Cooking Oil DALDA", 5, 1),                 # 5 litre tin -> per litre
    (["tea"], "Tea Lipton", 0.19, 1),                     # 190 g packet -> per kg
    (["gg"], "Garlic", 1, 1),                             # ginger-garlic paste priced as garlic
]
NUM = r"-?\d[\d,]*\.\d{2}"


def parse_text(text):
    """Return {ingredient_id: price}. Uses the 'National Average' section: rows with 20 decimals."""
    out = {}
    for ids, name, div, mul in MAP:
        gap = r"(?:(?!" + NUM + r")[\s\S]){0,80}?"          # description text, never a decimal number
        m = re.search(re.escape(name) + gap + r"((?:" + NUM + r"\s+){20})(\d+)(?![.\d])", text)
        if not m:
            continue
        vals = [float(v.replace(",", "")) for v in re.findall(NUM, m.group(1))]
        national_avg = vals[10]                           # 4th min/avg/max block, the 'avg'
        price = round(national_avg / div * mul, 2)
        for i in ids:
            out[i] = price
    return out


def pdf_text(data):
    from pypdf import PdfReader
    return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)


def fetch_latest(days_back=21):
    for k in range(days_back):
        d = date.today() - timedelta(days=k)
        url = URL.format(d=d.strftime("%d.%m.%Y"))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 RupeePlate"})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read()
            if data[:4] == b"%PDF":
                return data, d
        except Exception:
            continue
    raise RuntimeError("Could not download a PBS weekly report from pbs.gov.pk in the last 3 weeks. "
                       "Download the Annex PDF yourself and run:  python prices.py --file report.pdf")


def save(prices, when, source):
    LIVE.write_text(json.dumps({"updated": when.isoformat(), "source": source, "prices": prices}, indent=1))


def update(file=None, text_file=None):
    if text_file:
        text, when, src = Path(text_file).read_text(encoding="utf-8"), date.today(), "PBS report (text file)"
    elif file:
        text, when, src = pdf_text(Path(file).read_bytes()), date.today(), f"PBS report ({Path(file).name})"
    else:
        data, when = fetch_latest()
        text, src = pdf_text(data), f"PBS weekly annex {when.strftime('%d.%m.%Y')}"
    prices = parse_text(text)
    if len(prices) < 8:
        raise RuntimeError(f"Only {len(prices)} prices could be read from that report, so nothing was changed.")
    save(prices, when, src)
    return {"updated": when.isoformat(), "source": src, "count": len(prices), "prices": prices}


def status():
    if not LIVE.exists():
        return {"updated": None, "source": None, "count": 0}
    j = json.loads(LIVE.read_text())
    return {"updated": j["updated"], "source": j["source"], "count": len(j["prices"])}


if __name__ == "__main__":
    a = sys.argv[1:]
    try:
        r = update(file=a[1] if a[:1] == ["--file"] else None, text_file=a[1] if a[:1] == ["--text"] else None)
        print(f"Updated {r['count']} prices from {r['source']}")
        for k, v in sorted(r["prices"].items()):
            print(f"  {k:<12} Rs {v}")
    except Exception as e:
        print("Price update failed:", e)
        sys.exit(1)
