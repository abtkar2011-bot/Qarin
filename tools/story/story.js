// ستوري انستقرام اليومية لقارِن: «وفّر كذا ريال».
// نبحث في الموقع الحقيقي عن موديل محدد (نفس المنتج في أكثر من متجر)، ناخذ أرخص سعر له في كل متجر،
// ونرسم صورة 1080×1920 (JPEG) فيها الفرق بالريال. الناتج في مجلد OUT: story.jpg و story.json.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const SITE = process.env.SITE || 'https://abtkar2011-bot.github.io/Qarin/';
const OUT = process.env.OUT || 'story-out';
fs.mkdirSync(OUT, { recursive: true });

// موديلات لها متاجر رسمية وتنباع في أكثر من متجر، عشان المقارنة تكون على نفس المنتج فعلًا.
// must: كلمات لازم تكون كلها في اسم المنتج.
const MODELS = [
  { q: 'xiaomi redmi buds 6 active', name: 'سماعة ريدمي بودز 6 أكتيف', must: ['redmi', 'buds', '6', 'active'] },
  { q: 'baseus power bank 20000mah', name: 'باور بانك بيسوس 20000', must: ['baseus', '20000'] },
  { q: 'xiaomi redmi watch 5 active', name: 'ساعة ريدمي واتش 5 أكتيف', must: ['redmi', 'watch', '5', 'active'] },
  { q: 'sandisk ultra 128gb microsd', name: 'ذاكرة سانديسك 128 جيجا', must: ['sandisk', '128'] },
  { q: 'qcy t13 anc earbuds', name: 'سماعة QCY T13', must: ['qcy', 't13'] },
  { q: 'ugreen usb c cable 100w', name: 'كيبل يوجرين 100 واط', must: ['ugreen', '100w'] },
  { q: 'xiaomi smart band 9', name: 'سوار شاومي سمارت باند 9', must: ['xiaomi', 'band', '9'] },
  { q: 'anker nano charger 20w', name: 'شاحن أنكر نانو 20 واط', must: ['anker', '20w'] },
  { q: 'amazfit bip 5', name: 'ساعة أمازفيت بيب 5', must: ['amazfit', 'bip', '5'] },
  { q: 'logitech g102 mouse', name: 'ماوس لوجيتك G102', must: ['logitech', 'g102'] },
  { q: 'kingston datatraveler 64gb', name: 'فلاش كينغستون 64 جيجا', must: ['kingston', '64'] },
  { q: 'anker soundcore r50i', name: 'سماعة ساوندكور R50i', must: ['soundcore', 'r50i'] },
  { q: 'baseus car charger', name: 'شاحن سيارة بيسوس', must: ['baseus', 'car', 'charger'] },
  { q: 'ugreen hdmi cable 4k', name: 'كيبل HDMI يوجرين 4K', must: ['ugreen', 'hdmi'] },
  { q: 'lenovo thinkplus lp40', name: 'سماعة لينوفو LP40', must: ['lenovo', 'lp40'] },
  { q: 'haylou s35 headphones', name: 'سماعة رأس هايلو S35', must: ['haylou', 's35'] },
  { q: 'xiaomi redmi buds 6 lite', name: 'سماعة ريدمي بودز 6 لايت', must: ['redmi', 'buds', '6', 'lite'] },
  { q: 'baseus bowie e3 earbuds', name: 'سماعة بيسوس E3', must: ['baseus', 'e3'] },
  { q: 'ugreen nexode 65w charger', name: 'شاحن يوجرين 65 واط', must: ['ugreen', '65w'] },
  { q: 'amazfit active 2', name: 'ساعة أمازفيت أكتيف 2', must: ['amazfit', 'active', '2'] },
];
const NOT_SAME = /\b(case|cases|cover|strap|straps|protector|film|skin|tips|replacement|parts?|used|refurbished|pre-?owned|broken|box only|sticker|holder|stand|bag|pouch|for repair)\b/i;
const STORE = { aliexpress: ['علي إكسبريس', '#E62E04'], ebay: ['إيباي', '#0064D2'], etsy: ['إتسي', '#F1641E'] };

const muscatDate = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const dayIndex = () => Math.floor((Date.now() + 4 * 3600e3) / 86400e3);
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const omr = v => v.toFixed(3) + ' ر.ع.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function grab(b, m) {
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], locale: 'ar-OM' });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.currency', 'OMR'); localStorage.setItem('qarin.instHide', String(Date.now())); });
  const p = await ctx.newPage();
  try {
    await p.goto(SITE + '?qa=1&q=' + encodeURIComponent(m.q), { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction(() => /✓/.test((document.getElementById('status') || {}).innerText || '') && window.__qa && window.__qa.state.products.length, null, { timeout: 90000 });
    await sleep(1500);
    return await p.evaluate(() => {
      const qa = window.__qa, rate = qa.RATES.OMR;
      return qa.state.products.map(x => ({ platform: x.platform, title: String(x.title || ''), usd: qa.tot(x), omr: qa.tot(x) * rate, url: x.url, image: x.image, real: x.real !== false }));
    });
  } finally { await ctx.close(); }
}

// أرخص إعلان لنفس الموديل في كل متجر
function compare(m, items) {
  const best = {};
  for (const it of items) {
    if (!it.real || !(it.omr > 0) || !it.image) continue;
    const t = it.title.toLowerCase();
    if (!m.must.every(w => new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)').test(t))) continue;
    if (NOT_SAME.test(t)) continue;
    if (!best[it.platform] || it.omr < best[it.platform].omr) best[it.platform] = it;
  }
  const list = Object.values(best).sort((a, b) => a.omr - b.omr);
  if (list.length < 2) return null;
  const low = list[0], high = list[list.length - 1], save = high.omr - low.omr;
  // فرق واضح، بس مو خيالي (الفرق الخيالي غالبًا يعني منتج مختلف أو تقليد)
  if (save < 0.4 || save / high.omr < 0.12 || low.omr / high.omr < 0.35) return null;
  return { low, high, save, stores: list };
}

function page(d) {
  const row = (it, win) => `<div class="srow${win ? ' win' : ''}"><span class="sn"><i style="background:${STORE[it.platform][1]}"></i>${STORE[it.platform][0]}</span><b>${omr(it.omr)}</b></div>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#F5F5F7;font-family:'Almarai',sans-serif;color:#1D1D1F}
.wrap{position:absolute;inset:0;padding:200px 72px 0;display:flex;flex-direction:column;align-items:center}
.tag{display:flex;align-items:center;gap:14px;background:#fff;font-size:34px;font-weight:800;padding:12px 34px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.tag img{height:34px;filter:brightness(0)}
.tag span{color:#248A3D}
h1{margin-top:22px;font-size:${d.name.length > 22 ? 62 : 72}px;font-weight:800;line-height:1.3;text-align:center}
.ph{margin-top:26px;width:600px;height:var(--ph,450px);border-radius:44px;background:#fff;overflow:hidden;display:grid;place-items:center;box-shadow:0 24px 60px rgba(0,0,0,.07)}
.ph img{width:100%;height:100%;object-fit:contain;background:#fff}
.save{margin-top:34px;text-align:center}
.save .l1{font-size:46px;font-weight:700;color:#6E6E73}
.save .big{font-size:150px;font-weight:800;color:#248A3D;line-height:1.15;letter-spacing:-2px;direction:rtl}
.save .big small{font-size:64px;font-weight:800;margin-inline-start:14px}
.save .l2{font-size:44px;font-weight:800}
.cmp{margin-top:30px;width:936px;background:#fff;border-radius:40px;padding:14px 36px}
.srow{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:40px}
.srow+.srow{border-top:2px solid #EDEDF0}
.srow b{font-weight:800;color:#6E6E73;text-decoration:line-through;text-decoration-thickness:3px}
.srow.win b{color:#1D1D1F;text-decoration:none}
.sn{display:flex;align-items:center;gap:14px;font-weight:700}
.sn i{width:18px;height:18px;border-radius:50%;display:inline-block}
.note{margin-top:14px;font-size:24px;color:#8E8E93}
.cta{margin-top:26px;display:flex;flex-direction:column;align-items:center;gap:10px}
.cta .btn{background:#1D1D1F;color:#fff;font-size:40px;font-weight:800;padding:22px 56px;border-radius:999px}
.cta small{font-size:30px;color:#6E6E73}
</style></head><body><div class="wrap">
<div class="tag">قارِن <img src="data:image/png;base64,${d.mark}"> · <span>وفّر مع المقارنة</span></div>
<h1>${esc(d.name)}</h1>
<div class="ph"><img referrerpolicy="no-referrer" src="${esc(d.low.image)}"></div>
<div class="save"><div class="l1">نفس المنتج… وفّرت</div><div class="big">${d.save.toFixed(3)}<small>ر.ع.</small></div><div class="l2">لأنك قارنت</div></div>
<div class="cmp">${row(d.high, false)}${row(d.low, true)}</div>
<div class="note">أرخص سعر في كل متجر يوم ${esc(d.dateAr)}، مع الشحن إذا كان معروف. الأسعار تتغيّر.</div>
<div class="cta"><div class="btn">قارن قبل لا تشتري</div><small>الرابط في البايو</small></div>
</div></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  const order = process.env.QUERY
    ? [{ q: process.env.QUERY, name: process.env.QUERY, must: process.env.QUERY.toLowerCase().split(/\s+/).filter(w => w.length > 1) }]
    : Array.from({ length: MODELS.length }, (_, i) => MODELS[(dayIndex() + i * 3) % MODELS.length]).filter((m, i, a) => a.indexOf(m) === i);
  let pick = null, m = null;
  for (const cand of order.slice(0, 8)) {
    try {
      const items = await grab(b, cand);
      const c = compare(cand, items);
      console.log(cand.q, '→', items.length, 'items', c ? `save ${c.save.toFixed(3)} (${c.low.platform} ${c.low.omr.toFixed(3)} vs ${c.high.platform} ${c.high.omr.toFixed(3)})` : 'no fair comparison');
      if (c) { pick = c; m = cand; break; }
    } catch (e) { console.log('failed', cand.q, e.message); }
  }
  if (!pick) { await b.close(); console.error('no usable comparison today'); process.exit(1); }
  const date = muscatDate();
  const dateAr = new Date(date + 'T12:00:00Z').toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const mark = fs.readFileSync(path.join(__dirname, '..', '..', 'icons', 'logo-mark.png')).toString('base64');
  const data = { date, style: 'save', query: m.q, name: m.name, save: +pick.save.toFixed(3),
    low: { store: STORE[pick.low.platform][0], platform: pick.low.platform, omr: +pick.low.omr.toFixed(3), title: pick.low.title, url: pick.low.url, image: pick.low.image },
    high: { store: STORE[pick.high.platform][0], platform: pick.high.platform, omr: +pick.high.omr.toFixed(3), title: pick.high.title, url: pick.high.url },
    link: SITE + '?q=' + encodeURIComponent(m.q) };
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(page({ ...data, low: pick.low, high: pick.high, save: pick.save, mark, dateAr }), { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  const imgOk = await p.evaluate(() => { const i = document.querySelector('.ph img'); return !!(i && i.naturalWidth > 10); });
  if (!imgOk) await p.evaluate(() => { document.querySelector('.ph').innerHTML = '<div style="font-size:150px">🛍️</div>'; });
  // نبعد المحتوى عن أزرار انستقرام تحت (آخر 250 بكسل)
  const fit = await p.evaluate(() => { let h = 450; const bottom = () => document.querySelector('.cta').getBoundingClientRect().bottom;
    while (bottom() > 1665 && h > 240) { h -= 10; document.documentElement.style.setProperty('--ph', h + 'px'); }
    return { photo: h, bottom: Math.round(bottom()) }; });
  console.log('fit', JSON.stringify(fit));
  await sleep(400);
  await p.screenshot({ path: path.join(OUT, 'story.jpg'), type: 'jpeg', quality: 92 });
  data.imageOk = imgOk;
  fs.writeFileSync(path.join(OUT, 'story.json'), JSON.stringify(data, null, 1));
  console.log(JSON.stringify(data));
  await b.close();
})();
