"""قارِن — يبني ملفات منتجات علي إكسبرس الصغيرة من ملف Admitad.

يشتغل يوميًا داخل GitHub Actions:
  - ينزّل ملف المنتجات (CSV) من الرابط المحفوظ في السر ADMITAD_FEED_URL
  - يختار أفضل المنتجات لكل كلمة بحث
  - يحفظها في data/ali/<slug>.json ليقرأها موقع قارِن
"""
import csv, gzip, heapq, io, json, os, re, sys, time, urllib.request, zipfile

PER_KEYWORD = 24
OUT_DIR = os.path.join("data", "ali")

# الكلمات الإنجليزية التي يبحث عنها قارِن (نفس القائمة داخل index.html)
KEYWORDS = {
    "wireless earbuds": ["wireless earbuds", "tws earbuds", "bluetooth earbuds", "true wireless"],
    "headphones": ["headphones", "headphone", "headset", "earphones"],
    "summer dress": ["summer dress", "beach dress", "sundress"],
    "dress": ["dress"],
    "smart watch": ["smart watch", "smartwatch", "fitness tracker"],
    "watch": ["wrist watch", "quartz watch", "men watch", "women watch", "watch"],
    "running shoes": ["running shoes", "sneakers", "sport shoes"],
    "shoes": ["shoes", "sandals", "boots", "loafers"],
    "backpack": ["backpack"],
    "bag": ["handbag", "shoulder bag", "tote bag", "crossbody bag", "bag"],
    "air fryer": ["air fryer"],
    "smartphone": ["smartphone", "mobile phone", "cell phone"],
    "laptop": ["laptop", "notebook computer"],
    "charger": ["charger", "power bank", "fast charging"],
    "phone case": ["phone case", "iphone case", "samsung case"],
    "sunglasses": ["sunglasses"],
    "perfume": ["perfume", "fragrance"],
    "camera": ["camera", "webcam", "dash cam"],
    "computer mouse": ["gaming mouse", "wireless mouse", "computer mouse", "mouse"],
    "keyboard": ["keyboard"],
    "tv": ["tv box", "smart tv", "projector"],
    "vacuum cleaner": ["vacuum cleaner", "robot vacuum", "vacuum"],
    "blender": ["blender", "juicer"],
}

PATTERNS = {
    slug: re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.I)
    for slug, terms in KEYWORDS.items()
}
ACCESSORY = re.compile(r"\b(case|cover|holder|clip|cable|strap|band|replacement|sticker|skin|protector|film|stand|mount|pouch|tips|parts?)\b", re.I)
ACCESSORY_OK = {"phone case", "charger"}


def slugify(kw):
    return kw.replace(" ", "-")


def open_feed(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 QarinFeedBot"})
    resp = urllib.request.urlopen(req, timeout=300)
    raw = resp.read()
    print(f"downloaded {len(raw)/1e6:.1f} MB", flush=True)
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    elif raw[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(raw))
        raw = z.read(z.namelist()[0])
    text = raw.decode("utf-8-sig", errors="replace")
    return text


def pick(row, *names):
    for n in names:
        v = row.get(n)
        if v not in (None, ""):
            return v.strip()
    return ""


def num(v):
    try:
        return float(re.sub(r"[^\d.]", "", v)) if v else 0.0
    except ValueError:
        return 0.0


def main():
    url = os.environ.get("ADMITAD_FEED_URL", "").strip()
    if not url:
        sys.exit("ADMITAD_FEED_URL secret is missing")
    text = open_feed(url)
    first = text.split("\n", 1)[0]
    delim = max([";", ",", "\t", "|"], key=first.count)
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]
    header = reader.fieldnames
    print("columns:", header, flush=True)

    heaps = {slug: [] for slug in KEYWORDS}
    total = 0
    sample = []
    for row in reader:
        total += 1
        if len(sample) < 2:
            sample.append({k: (v or "")[:120] for k, v in row.items() if k})
        name = pick(row, "name", "title", "product_name")
        link = pick(row, "url", "link", "product_url", "deeplink")
        price = num(pick(row, "price", "sale_price", "price_usd"))
        if not name or not link.startswith("http") or price <= 0:
            continue
        cur = pick(row, "currencyid", "currency").upper()
        if cur and cur not in ("USD", "US$"):
            continue
        image = pick(row, "picture", "image", "image_url", "picture_url").split(",")[0].strip()
        orders = num(pick(row, "orders", "sales", "volume", "lastest_volume", "sold"))
        rating = num(pick(row, "rating", "evaluate_rate", "product_rating"))
        if rating > 5:  # أحيانًا يكون نسبة مئوية
            rating = round(rating / 20, 1)
        old = num(pick(row, "oldprice", "old_price", "original_price"))
        score = orders * 10 + rating * 100 + (5 if image else 0)
        for slug, pat in PATTERNS.items():
            if not pat.search(name):
                continue
            if slug not in ACCESSORY_OK and ACCESSORY.search(name):
                continue
            item = {"title": name[:160], "price": round(price, 2), "url": link, "image": image,
                    "original": round(old, 2) if old > price else None,
                    "orders": int(orders) or None, "rating": rating or None}
            h = heaps[slug]
            entry = (score, total, item)
            if len(h) < PER_KEYWORD:
                heapq.heappush(h, entry)
            elif score > h[0][0]:
                heapq.heapreplace(h, entry)

    os.makedirs(OUT_DIR, exist_ok=True)
    counts = {}
    for slug, h in heaps.items():
        items = [e[2] for e in sorted(h, key=lambda e: -e[0])]
        counts[slug] = len(items)
        with open(os.path.join(OUT_DIR, slugify(slug) + ".json"), "w", encoding="utf-8") as f:
            json.dump({"items": items}, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"updated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "rows": total,
                   "columns": header, "counts": counts, "sample": sample}, f, ensure_ascii=False, indent=1)
    print(f"rows={total}", counts, flush=True)


if __name__ == "__main__":
    main()
