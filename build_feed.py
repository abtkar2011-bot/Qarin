"""قارِن — يبني فهرس بحث لكل منتجات علي إكسبرس من ملف Admitad.

يشتغل داخل GitHub Actions (يوميًا + عند أي تحديث للموقع):
  - ينزّل ملف المنتجات (CSV) من الرابط المحفوظ في السر ADMITAD_FEED_URL
  - يحفظ كل المنتجات في ملفات صغيرة  (OUT_DIR/p/<رقم>.json)
  - يبني فهرس كلمات  (OUT_DIR/t/<رقم>.json) عشان الموقع يبحث بأي كلمة
  - meta.json فيه الإعدادات اللي يحتاجها الموقع
"""
import csv, gzip, io, json, os, re, shutil, sys, time, urllib.request, zipfile
from urllib.parse import quote, unquote

OUT_DIR = os.environ.get("OUT_DIR", "products")
SHARD = 150        # عدد المنتجات في كل ملف
NB = 1024          # عدد ملفات الفهرس
CAP = 4000         # أقصى عدد منتجات نحفظه لكل كلمة (الأفضل أولًا)
MIN_PRICE = 1.0
TITLE_MAX = 120
IMG_PREFIX = "https://ae-pic-a1.aliexpress-media.com/kf/"

# ===== تقسيم العنوان إلى كلمات (نفس الدالة بالضبط موجودة في index.html) =====
STOP = set("""for with and the of in on to a an by from or at as is it be up out your you my new hot sale free
shipping high quality best original fashion style pc pcs 1pc 1pcs 2pcs 2023 2024 2025 2026""".split())


def stem(t):
    if len(t) > 4 and t.endswith("ies"):
        return t[:-3] + "y"
    if len(t) > 4 and t.endswith(("sses", "ches", "shes", "xes")):
        return t[:-2]
    if len(t) > 3 and t.endswith("s") and not t.endswith(("ss", "us", "is")):
        return t[:-1]
    return t


NON_WORD = re.compile(r"[^a-z0-9]+")


def tokens(text):
    out = []
    for w in NON_WORD.sub(" ", text.lower()).split():
        w = stem(w)
        if len(w) > 1 and w not in STOP and w not in out:
            out.append(w)
    return out


def fnv(s):
    h = 0x811C9DC5
    for ch in s.encode():
        h ^= ch
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# منتجات هي قطع أو إكسسوارات أو أدوات تصليح: تنزل لآخر الترتيب (ما تنحذف)
ACCESSORY = re.compile(r"\b(case|cover|holder|clips?|cables?|cord|charger|charging|battery|batteries|replacement|spare|parts?|repair|tools?|straps?|watchband|film|protector|tempered|sticker|skin|stand|mount|dock|pouch|ear ?tips|ear ?pads|cushions?|adapter|connector|module|board|bezel|buckle|winder|organi[sz]er|hook|hanger|insoles?|laces?|filter|nozzle|blade|kit|soldering|screwdriver|pcb)\b", re.I)

# منتجات ما نحفظها أبدًا: منتجات للكبار، وتدخين وفيب (نفس القائمة في index.html)
BLOCK = re.compile(r"\b(sex|sexy|erotic|dildos?|vibrators?|masturbat\w*|bdsm|bondage|fetish|condoms?|lingerie|porn\w*|nipples?|penis|anal|butt ?plugs?|strap-?on|adult toys?|cigarettes?|cigars?|e-?cig\w*|vapes?|vaping|vaporizers?|hookahs?|shisha|nargile|tobacco|smoking|bongs?|cannabis|marijuana|rolling papers?)\b", re.I)
BLOCK_CAT = re.compile(r"adult|sex|erotic|lingerie|vape|e-?cig|electronic cigarette|tobacco|smok|hookah|shisha", re.I)

# ===== روابط علي إكسبرس: نحفظ رقم المنتج + جزء صغير، والموقع يرجّع الرابط كامل =====
RAW = re.compile(r"^(https://[^?]+\?ulp=)([^&]+)(&.*)?$")
DL = re.compile(r"^(.*?dl_target_url=)([^&]+)(&.*)?$")
TGT = re.compile(r"^https://www\.aliexpress\.com/item/(\d+)\.html(?:\?pdp_npi=([^&]*))?$")
NPI_A, NPI_B = "6@dis!USD!", "!affd!!!!1!0!"


def enc(s):  # نفس encodeURIComponent في جافاسكربت
    return quote(s, safe="-_.!~*'()")


def build_link(tpl, iid, npi):
    t = "https://www.aliexpress.com/item/" + iid + ".html"
    if npi is not None:
        t += "?pdp_npi=" + npi.replace("@", "%40").replace("!", "%21")
    return tpl[0] + enc(tpl[1] + enc(t) + tpl[2]) + tpl[3]


def split_link(url, tpl):
    """يرجع (رقم المنتج، الجزء المتغير، القالب) أو None لو الرابط بشكل ثاني."""
    m = RAW.match(url)
    if not m:
        return None
    m2 = DL.match(unquote(m.group(2)))
    if not m2:
        return None
    m3 = TGT.match(unquote(m2.group(2)))
    if not m3:
        return None
    iid, npi = m3.group(1), m3.group(2)
    npi = unquote(npi) if npi is not None else None
    t = (m.group(1), m2.group(1), m2.group(3) or "", m.group(3) or "")
    if tpl[0] is None:
        tpl[0] = t
    if t != tpl[0] or build_link(t, iid, npi) != url:
        return None
    if npi is None:
        small = "-"
    elif npi.startswith(NPI_A) and npi.endswith(NPI_B):
        small = "~" + npi[len(NPI_A):-len(NPI_B)]
    else:
        small = "=" + npi
    return iid, small


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
    if os.path.exists(url):  # للتجربة على جهاز محلي
        return open(url, encoding="utf-8-sig", errors="replace", newline="")
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


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main():
    t0 = time.time()
    url = os.environ.get("ADMITAD_FEED_URL", "").strip()
    if not url:
        sys.exit("ADMITAD_FEED_URL secret is missing")
    csv.field_size_limit(10_000_000)
    stream = open_feed(url)
    first = stream.readline()
    delim = max([";", ",", "\t", "|"], key=first.count)
    header = [f.strip().strip('"').lower() for f in next(csv.reader([first], delimiter=delim))]
    reader = csv.DictReader(stream, fieldnames=header, delimiter=delim)
    print("columns:", header, flush=True)

    tpl = [None]
    seen = set()
    prods = []
    total = 0
    sample = []
    full_links = 0
    blocked = 0
    for row in reader:
        total += 1
        if total % 50000 == 0:
            print(f"processed {total} rows, kept {len(prods)}  ({time.time() - t0:.0f}s)", flush=True)
        if len(sample) < 2:
            sample.append({k: (v or "")[:160] for k, v in row.items() if k})
        name = " ".join(pick(row, "name", "title", "product_name").split())
        link = pick(row, "url", "link", "product_url", "deeplink")
        price = num(pick(row, "price", "sale_price", "price_usd"))
        if not name or not link.startswith("http") or price < MIN_PRICE:
            continue
        cat = pick(row, "category", "category_name") or "Other"
        if BLOCK.search(name) or BLOCK_CAT.search(cat):
            blocked += 1
            continue
        cur = pick(row, "currencyid", "currency").upper()
        if cur and cur not in ("USD", "US$"):
            continue
        parts = split_link(link, tpl)
        if parts:
            iid, small = parts
        else:
            iid = pick(row, "id") or link
            small = link
            full_links += 1
        if iid in seen:
            continue
        seen.add(iid)
        image = pick(row, "picture", "image", "image_url", "picture_url").split(",")[0].strip()
        if image.startswith("//"):
            image = "https:" + image
        image = image.replace("http://", "https://", 1)
        if image.startswith(IMG_PREFIX):
            image = image[len(IMG_PREFIX):]
        old = num(pick(row, "oldprice", "old_price", "original_price"))
        disc = (old - price) / old * 100 if old > price else 0
        score = disc * 0.5 + 40 / (1 + price) ** 0.5 + (5 if image else 0)
        if ACCESSORY.search(name):
            score -= 1000
        toks = tuple(sys.intern(t) for t in tokens(name))
        prods.append((sys.intern(cat), -score, int(iid) if iid.isdigit() else iid, name[:TITLE_MAX],
                      round(price, 2), round(old, 2) if old > price else 0, image, small, toks))

    print(f"read {total} rows, kept {len(prods)} products in {time.time() - t0:.0f}s", flush=True)
    if len(prods) < 1000:
        sys.exit("too few products, something is wrong with the feed")

    # الترتيب: حسب القسم، وداخل القسم الأفضل أولًا (عشان نتائج البحث تكون في ملفات قليلة)
    prods.sort(key=lambda p: (p[0], p[1]))
    shutil.rmtree(OUT_DIR, ignore_errors=True)
    os.makedirs(os.path.join(OUT_DIR, "p"))
    os.makedirs(os.path.join(OUT_DIR, "t"))

    cats = []
    post = {}
    for i, p in enumerate(prods):
        if not cats or cats[-1][1] != p[0]:
            cats.append([i, p[0]])
        for t in p[8]:
            lst = post.get(t)
            if lst is None:
                post[t] = [i]
            else:
                lst.append(i)
    for k in range(0, len(prods), SHARD):
        dump(os.path.join(OUT_DIR, "p", f"{k // SHARD}.json"),
             [[p[2], p[3], p[4], p[5], p[6], p[7]] for p in prods[k:k + SHARD]])

    buckets = [dict() for _ in range(NB)]
    kept_tokens = 0
    for t, lst in post.items():
        if len(lst) < 2:  # كلمة في منتج واحد بس (غالبًا رقم موديل)
            continue
        n = len(lst)
        if n > CAP:
            lst = sorted(sorted(lst, key=lambda i: prods[i][1])[:CAP])
        deltas = [n, lst[0]] + [lst[j] - lst[j - 1] for j in range(1, len(lst))]
        buckets[fnv(t) % NB][t] = deltas
        kept_tokens += 1
    for b, d in enumerate(buckets):
        dump(os.path.join(OUT_DIR, "t", f"{b}.json"), d)

    t = tpl[0] or ("", "", "", "")
    dump(os.path.join(OUT_DIR, "meta.json"), {
        "v": 1, "n": len(prods), "shard": SHARD, "nb": NB, "cap": CAP,
        "updated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "img": IMG_PREFIX, "tpl": list(t), "npi": [NPI_A, NPI_B], "cats": cats,
    })
    with open(os.path.join(OUT_DIR, "info.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": total, "products": len(prods), "tokens": kept_tokens, "full_links": full_links, "blocked": blocked,
                   "categories": len(cats), "seconds": round(time.time() - t0), "columns": header,
                   "sample": sample}, f, ensure_ascii=False, indent=1)
    print(f"done: {len(prods)} products, {kept_tokens} words, {len(cats)} categories, "
          f"{full_links} full links, {blocked} blocked, {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
