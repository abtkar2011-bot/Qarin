"""قارِن — يحوّل ملف كوبونات Admitad (CSV أو XML) إلى coupons.json للموقع.

الرابط سرّي (فيه رمز الحساب)، فيجي من متغير COUPONS_FEED_URL وما يُكتب في أي ملف منشور.
لو فشل التحميل نخلي آخر ملف محفوظ (أو قائمة فاضية) عشان النشر ما يتعطل.
"""
import csv, io, json, os, re, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone

URL = os.environ.get("COUPONS_FEED_URL", "").strip()
OUT = os.environ.get("COUPONS_OUT", "coupons.json")
MAX = 400

# أسماء الأعمدة المحتملة لكل حقل (Admitad يغيّرها أحيانًا)
FIELDS = {
    "title": ["name", "title", "coupon_name", "short_name"],
    "code": ["promocode", "promo_code", "code", "coupon_code"],
    "url": ["gotolink", "goto_link", "link", "url", "deeplink", "tracking_link"],
    "start": ["date_start", "start_date", "datestart", "begin"],
    "end": ["date_end", "end_date", "dateend", "expiration", "expire", "valid_till"],
    "desc": ["description", "desc", "terms", "conditions"],
    "discount": ["discount", "value", "discount_value"],
    "store": ["advcampaign_name", "campaign_name", "program", "program_name", "advertiser", "shop", "store"],
    "logo": ["image", "logo", "advcampaign_logo", "campaign_logo", "picture"],
    "type": ["types", "type", "species", "kind"],
    "region": ["regions", "region", "geo", "countries"],
}


def norm_key(k):
    return re.sub(r"[^a-z0-9]+", "_", (k or "").strip().lower()).strip("_")


def pick(row, field):
    for name in FIELDS[field]:
        for k, v in row.items():
            if norm_key(k) == name and v not in (None, ""):
                return str(v).strip()
    return ""


def parse_date(s):
    s = (s or "").strip()
    if not s or s.lower() in ("none", "null", "0"):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d.%m.%Y %H:%M", "%d.%m.%Y", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(s[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def clean(s, n):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]


def rows_from_csv(text):
    sample = text[:5000]
    delim = ";" if sample.count(";") > sample.count(",") else ","
    rd = csv.DictReader(io.StringIO(text), delimiter=delim)
    print("csv columns:", rd.fieldnames)
    return list(rd)


def rows_from_xml(text):
    root = ET.fromstring(text)
    stores, rows = {}, []
    for c in root.iter():
        if c.tag in ("advcampaign", "campaign") and c.get("id"):
            nm = (c.findtext("name") or "").strip()
            if nm:
                stores[c.get("id")] = nm
    for c in root.iter("coupon"):
        row = {ch.tag: (ch.text or "").strip() for ch in c}
        row.update({k: v for k, v in c.attrib.items()})
        cid = row.get("advcampaign_id") or row.get("campaign_id")
        if cid and "advcampaign_name" not in row and cid in stores:
            row["advcampaign_name"] = stores[cid]
        rows.append(row)
    print("xml coupons:", len(rows))
    return rows


def main():
    if not URL:
        print("COUPONS_FEED_URL not set; skipping")
        if not os.path.exists(OUT):
            json.dump({"updated": None, "coupons": []}, open(OUT, "w"))
        return
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Qarin/1.0"})
        raw = urllib.request.urlopen(req, timeout=120).read()
    except Exception as e:
        print("download failed:", type(e).__name__)
        if not os.path.exists(OUT):
            json.dump({"updated": None, "coupons": []}, open(OUT, "w"))
        return
    text = raw.decode("utf-8-sig", errors="replace")
    rows = rows_from_xml(text) if text.lstrip().startswith("<") else rows_from_csv(text)
    now = datetime.now(timezone.utc)
    out, seen = [], set()
    for r in rows:
        url = pick(r, "url")
        title = clean(pick(r, "title"), 140)
        if not url.startswith("https://") or not title:
            continue
        end = parse_date(pick(r, "end"))
        if end and end < now:
            continue
        code = clean(pick(r, "code"), 40)
        if code.lower() in ("not required", "none", "null", "-", "не требуется"):
            code = ""
        key = (title, code, url)
        if key in seen:
            continue
        seen.add(key)
        start = parse_date(pick(r, "start"))
        logo = pick(r, "logo")
        out.append({
            "t": title,
            "c": code,
            "u": url,
            "s": clean(pick(r, "store"), 60),
            "d": clean(pick(r, "desc"), 400),
            "x": clean(pick(r, "discount"), 30),
            "k": clean(pick(r, "type"), 60),
            "r": clean(pick(r, "region"), 120),
            "l": logo if logo.startswith("https://") else "",
            "a": start.strftime("%Y-%m-%d") if start else "",
            "e": end.strftime("%Y-%m-%d") if end else "",
        })
    out.sort(key=lambda c: c["a"], reverse=True)
    out = out[:MAX]
    json.dump({"updated": now.strftime("%Y-%m-%d %H:%M"), "coupons": out}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    stores = sorted({c["s"] for c in out if c["s"]})
    print(f"coupons: {len(out)} active from {len(rows)} rows; stores: {stores[:15]}")


if __name__ == "__main__":
    main()
