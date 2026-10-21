"""قارِن — يبني ملفات منتجات علي إكسبرس الصغيرة من ملف Admitad.

يشتغل يوميًا داخل GitHub Actions:
  - ينزّل ملف المنتجات (CSV) من الرابط المحفوظ في السر ADMITAD_FEED_URL
  - يختار أفضل المنتجات لكل كلمة بحث
  - يحفظها في data/ali/<slug>.json ليقرأها موقع قارِن
"""
import csv, gzip, heapq, io, json, os, re, sys, time, urllib.request, zipfile

PER_KEYWORD = 40
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


class _Prefixed(io.RawIOBase):
    """يعيد البايتات اللي قرأناها للفحص ثم يكمل من الاتصال."""
    def __init__(self, head, rest):
        self.head, self.rest = head, rest
    def readable(self):
        return True
    def readinto(self, b):
        if self.head:
            n = min(len(b), len(self.head))
            b[:n] = self.head[:n]
            self.head = self.head[n:]
            return n
        data = self.rest.read(len(b))
        b[:len(data)] = data
        return len(data)


def open_feed(url):
    """يفتح الملف كتيار نصي يُقرأ سطرًا بسطر أثناء التنزيل (بدون تحميله كامل في الذاكرة)."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 QarinFeedBot"})
    resp = urllib.request.urlopen(req, timeout=600)
    print("connected, status", resp.status, flush=True)
    head = resp.read(4)
    raw = io.BufferedReader(_Prefixed(head, resp), buffer_size=1 << 20)
    if head[:2] == b"\x1f\x8b":
        raw = gzip.GzipFile(fileobj=raw)
    elif head[:2] == b"PK":
        data = head + resp.read()
        z = zipfile.ZipFile(io.BytesIO(data))
        raw = z.open(z.namelist()[0])
    return io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")


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
    stream = open_feed(url)
    first = stream.readline()
    delim = max([";", ",", "\t", "|"], key=first.count)
    header = [f.strip().strip('"').lower() for f in next(csv.reader([first], delimiter=delim))]
    reader = csv.DictReader(stream, fieldnames=header, delimiter=delim)
    print("columns:", header, flush=True)

    heaps = {slug: [] for slug in KEYWORDS}
    total = 0
    sample = []
    for row in reader:
        total += 1
        if total % 50000 == 0:
            print(f"processed {total} rows", flush=True)
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
        disc = (old - price) / old * 100 if old > price else 0
        # المبيعات والتقييم أولًا، ثم الخصم والسعر الأرخص
        if price < 1.5:  # أرخص من كذا غالبًا قطع غيار أو منتجات رديئة
            continue
        # السعر الأرخص أهم شي، بعده المبيعات والتقييم والخصم
        score = orders * 10 + rating * 100 + 300 / (1 + price) + disc * 0.2 + (5 if image else 0)
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
