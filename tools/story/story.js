// ستوري انستقرام اليومية لقارِن: يفتح الموقع الحقيقي ببحث من القائمة، ياخذ أفضل خيار وأرخص سعر في كل متجر،
// ويرسم صورة 1080×1920 (JPEG) في مجلد OUT مع story.json.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const SITE = process.env.SITE || 'https://abtkar2011-bot.github.io/Qarin/';
const OUT = process.env.OUT || 'story-out';
fs.mkdirSync(OUT, { recursive: true });
const QUERIES = ['سماعات لاسلكية', 'ساعة ذكية', 'قلاية هوائية', 'باور بانك', 'ماكينة قهوة', 'حقيبة ظهر', 'شاحن سيارة', 'مبخرة كهربائية',
  'ماوس لاسلكي', 'نظارة شمسية', 'مكنسة روبوت', 'حذاء رياضي', 'كفر ايفون ١٦', 'ترمس', 'مجفف شعر', 'ستاند لابتوب', 'كيبورد لاسلكي',
  'سماعة بلوتوث', 'ساعة يد رجالي', 'مكواة بخار', 'خلاط', 'كاميرا مراقبة', 'مصباح مكتب', 'شنطة سفر', 'دهن عود', 'يد تحكم بلايستيشن ٥',
  'ميزان ذكي', 'سماعة راس', 'كفر ايربودز', 'ماكينة حلاقة'];
const muscatDate = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const dayIndex = () => Math.floor((Date.now() + 4 * 3600e3) / 86400e3);
const num = s => { const t = String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.').replace(/[^\d.]/g, ''); return parseFloat(t) || 0; };
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function grab(b, q) {
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], locale: 'ar-OM' });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.currency', 'OMR'); localStorage.setItem('qarin.instHide', String(Date.now())); });
  const p = await ctx.newPage();
  try {
    await p.goto(SITE + '?qa=1&q=' + encodeURIComponent(q), { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction(() => /✓/.test((document.getElementById('status') || {}).innerText || '') && document.querySelector('.best-card'), null, { timeout: 90000 });
    await sleep(2500);
    return await p.evaluate(() => {
      const t = (el, s) => { const e = el.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const bc = document.querySelector('.best-card');
      const best = { title: t(bc, 'h3'), price: t(bc, '.big-price'), store: t(bc, '.img .plat'), rating: t(bc, '.rating b'),
        image: (bc.querySelector('.img img') || {}).src || '', url: (bc.querySelector('a.shop-btn') || {}).href || '' };
      const cards = [...document.querySelectorAll('#panel-cards .pcard')].map(c => ({ store: t(c, '.pstore span'), title: t(c, '.ptitle'), price: t(c, '.price'), image: (c.querySelector('.img img') || {}).src || '' }));
      return { best, cards };
    });
  } finally { await ctx.close(); }
}

function page(d) {
  const STORE_DOT = { 'علي إكسبريس': '#E62E04', 'إيباي': '#0064D2', 'إتسي': '#F1641E' };
  const rows = d.stores.map(s => `<div class="srow"><span class="sn"><i style="background:${STORE_DOT[s.store] || '#8E8E93'}"></i>${esc(s.store)}</span><b>${esc(s.price)}</b></div>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#F5F5F7;font-family:'Almarai',sans-serif;color:#1D1D1F}
.wrap{position:absolute;inset:0;padding:200px 72px 0;display:flex;flex-direction:column;align-items:center}
.tag{display:flex;align-items:center;gap:14px;background:#fff;color:#1D1D1F;font-size:34px;font-weight:800;padding:12px 30px 12px 34px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.tag img{height:34px;filter:brightness(0)}
.tag span{color:#0071E3}
h1{margin-top:18px;font-size:${d.query.length > 14 ? 84 : 100}px;font-weight:800;line-height:1.25;text-align:center}
.card{margin-top:30px;width:936px;background:#fff;border-radius:52px;padding:30px;box-shadow:0 30px 70px rgba(0,0,0,.08)}
.ph{width:876px;height:var(--ph,480px);border-radius:34px;background:#F5F5F7;overflow:hidden;display:grid;place-items:center}
.ph img{width:100%;height:100%;object-fit:contain;background:#fff}
.meta{display:flex;align-items:center;justify-content:space-between;margin-top:24px;padding:0 6px}
.best{color:#BF4800;font-size:32px;font-weight:700}
.st{display:flex;align-items:center;gap:10px;font-size:30px;color:#6E6E73;font-weight:700}
.st i,.sn i{width:16px;height:16px;border-radius:50%;display:inline-block}
.tt{margin-top:8px;padding:0 6px;font-size:28px;line-height:1.4;color:#6E6E73;direction:ltr;text-align:left;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.pr{margin-top:8px;padding:0 6px;font-size:80px;font-weight:800;line-height:1.1}
.cmp{margin-top:22px;width:936px;background:#fff;border-radius:40px;padding:22px 36px}
.cmp h2{font-size:32px;font-weight:700;color:#6E6E73;margin-bottom:6px}
.srow{display:flex;justify-content:space-between;align-items:center;padding:12px 0;font-size:36px}
.srow+.srow{border-top:2px solid #EDEDF0}
.sn{display:flex;align-items:center;gap:14px;font-weight:700}
.srow b{font-weight:800}
.cta{margin-top:30px;display:flex;flex-direction:column;align-items:center;gap:12px}
.cta .btn{background:#1D1D1F;color:#fff;font-size:40px;font-weight:800;padding:24px 56px;border-radius:999px}
.cta small{font-size:30px;color:#6E6E73}
</style></head><body><div class="wrap">
<div class="tag">قارِن <img src="data:image/png;base64,${d.mark}"> · <span>عرض اليوم</span></div>
<h1>${esc(d.query)}</h1>
<div class="card">
  <div class="ph"><img referrerpolicy="no-referrer" src="${esc(d.best.image)}"></div>
  <div class="meta"><span class="best">الخيار الأفضل</span><span class="st"><i style="background:${STORE_DOT[d.best.store] || '#8E8E93'}"></i>${esc(d.best.store)}</span></div>
  <div class="tt">${esc(d.best.title)}</div>
  <div class="pr">${esc(d.best.price)}</div>
</div>
${rows ? `<div class="cmp"><h2>أرخص سعر في كل متجر</h2>${rows}</div>` : ''}
<div class="cta"><div class="btn">قارن بنفسك في قارِن</div><small>الرابط في البايو</small></div>
</div>
</body></html>`;
}

(async () => {
  const b = await chromium.launch();
  const start = process.env.QUERY ? -1 : dayIndex() % QUERIES.length;
  const tries = process.env.QUERY ? [process.env.QUERY] : [0, 1, 2, 3, 4].map(i => QUERIES[(start + i * 7) % QUERIES.length]);
  let got = null, query = '';
  for (const q of tries) {
    try {
      const r = await grab(b, q);
      if (r && r.best && r.best.title && r.best.price && r.best.image && r.cards.length >= 4) { got = r; query = q; break; }
      console.log('weak result for', q, r && r.cards.length);
    } catch (e) { console.log('failed', q, e.message); }
  }
  if (!got) { await b.close(); console.error('no usable search'); process.exit(1); }
  const byStore = {};
  for (const c of got.cards) { const v = num(c.price); if (!c.store || !v) continue; if (!byStore[c.store] || v < byStore[c.store].v) byStore[c.store] = { store: c.store, price: c.price, v }; }
  const stores = Object.values(byStore).sort((a, b) => a.v - b.v);
  const mark = fs.readFileSync(path.join(__dirname, '..', '..', 'icons', 'logo-mark.png')).toString('base64');
  const data = { date: muscatDate(), query, best: got.best, stores: stores.map(({ store, price }) => ({ store, price })), count: got.cards.length,
    link: SITE + '?q=' + encodeURIComponent(query) };
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(page({ ...data, mark }), { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  const imgOk = await p.evaluate(() => { const i = document.querySelector('.ph img'); return !!(i && i.naturalWidth > 10); });
  if (!imgOk) await p.evaluate(() => { document.querySelector('.ph').innerHTML = '<div style="font-size:120px">🛍️</div>'; });
  // لو المحتوى طويل، نصغّر الصورة لين يبعد عن منطقة أزرار انستقرام تحت (آخر 250 بكسل)
  const fit = await p.evaluate(() => { let h = 480; const bottom = () => document.querySelector('.cta').getBoundingClientRect().bottom;
    while (bottom() > 1665 && h > 300) { h -= 10; document.documentElement.style.setProperty('--ph', h + 'px'); }
    return { photo: h, bottom: Math.round(bottom()) }; });
  console.log('fit', JSON.stringify(fit));
  await sleep(500);
  await p.screenshot({ path: path.join(OUT, 'story.jpg'), type: 'jpeg', quality: 92 });
  data.imageOk = imgOk;
  fs.writeFileSync(path.join(OUT, 'story.json'), JSON.stringify(data, null, 1));
  console.log(JSON.stringify(data));
  await b.close();
})();
