// قارِن — اختبار جودة النتائج: يشغّل الموقع الحقيقي على كل كلمات القاموس ويحفظ النتائج الخام والنهائية.
// أول تشغيل يسجّل ردود السيرفر (عشان ما نستهلك حصة إيباي/علي إكسبريس مرة ثانية)، والتشغيلات اللي بعده تعيدها من التسجيل.
//   node qa/run.js  (REC_DIR=qa-rec OUT=qa-out PAGES=3)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const REC_DIR = process.env.REC_DIR || 'qa-rec';
const OUT = process.env.OUT || 'qa-out';
const PAGES = +(process.env.PAGES || 3);
const LIVE_SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const LIMIT = +(process.env.LIMIT || 0);
fs.mkdirSync(REC_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- تسجيل الردود (رابط ← نص الرد) ----
const recFile = path.join(REC_DIR, 'responses.json.gz');
const rec = fs.existsSync(recFile) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(recFile))) : {};
let recNew = 0;
const saveRec = () => fs.writeFileSync(recFile, zlib.gzipSync(JSON.stringify(rec)));
const shardDir = path.join(REC_DIR, 'shards');
fs.mkdirSync(shardDir, { recursive: true });

// ---- سيرفر محلي للموقع (نسخة الفرع) ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function liveFetch(url, opts) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, opts);
      const body = await r.text();
      return { status: r.status, body };
    } catch (e) { await new Promise(r => setTimeout(r, 800 * (a + 1))); }
  }
  return { status: 599, body: '{"error":"network"}' };
}

async function setupPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  // السيرفر والترجمة وسعر الصرف: من التسجيل، ولو مو موجود نجيبه ونسجّله
  await page.route(/qarin-ebay\.abtkar2011\.workers\.dev|api\.mymemory\.translated\.net|open\.er-api\.com/, async route => {
    const req = route.request(), url = req.url();
    if (/\/(event|rate)(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    const key = req.method() + ' ' + url;
    if (!rec[key]) {
      const r = await liveFetch(url, { method: req.method(), headers: { 'Content-Type': 'text/plain' }, body: req.method() === 'POST' ? req.postData() : undefined });
      if (r.status < 500) { rec[key] = r; recNew++; }
      else return route.fulfill({ status: r.status, contentType: 'application/json', body: r.body });
    }
    return route.fulfill({ status: rec[key].status, contentType: 'application/json', body: rec[key].body });
  });
  // فهرس علي إكسبريس: من الموقع الحقيقي (مع نسخة محفوظة)
  await page.route(/127\.0\.0\.1:\d+\/data\/s\//, async route => {
    const rel = route.request().url().split('/data/s/')[1].split('?')[0];
    const f = path.join(shardDir, rel.replace(/\//g, '_'));
    if (!fs.existsSync(f)) {
      const r = await liveFetch(LIVE_SITE + 'data/s/' + rel);
      if (r.status !== 200) return route.fulfill({ status: r.status, body: '' });
      fs.writeFileSync(f, r.body);
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(f) });
  });
  // صور وخطوط: ما نحتاجها
  await page.route(/\.(png|jpe?g|webp|avif|gif|svg|woff2?)(\?|$)|fonts\.(googleapis|gstatic)\.com/, route => {
    if (route.request().url().includes('127.0.0.1')) return route.continue();
    return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
  });
  await page.goto(base + 'index.html?qa=1', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__qa, null, { timeout: 30000 });
  return page;
}

const errors = [];
let base = '';
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  let queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'queries.json'), 'utf8'));
  if (LIMIT) queries = queries.slice(0, LIMIT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar' });
  await ctx.addInitScript(() => { try { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); } catch (e) {} });
  const report = new Array(queries.length);
  let next = 0, done = 0;
  const t0 = Date.now();
  async function worker() {
    const page = await setupPage(ctx);
    while (next < queries.length) {
      const i = next++;
      const { en, ar } = queries[i];
      try {
        const out = await page.evaluate(async q => {
          await window.__qa.search(q, true);
          for (let k = 0; k < 600 && window.__qa.state.loading; k++) await new Promise(r => setTimeout(r, 50));
          const s = window.__qa.state;
          return {
            raw: window.__qa.raw[window.__qa.normalize(q)] || {},
            final: s.products.map(p => [p.platform, p.title, Math.round(p.price * 100) / 100, p.original || 0, Math.round((p.rating || 0) * 10) / 10, p.reviews || 0]),
          };
        }, en);
        report[i] = { en, ar, ...out };
      } catch (e) {
        report[i] = { en, ar, error: String(e.message).slice(0, 200), raw: {}, final: [] };
      }
      if (++done % 25 === 0) { console.log(`${done}/${queries.length} (${Math.round((Date.now() - t0) / 1000)}s, new responses ${recNew})`); if (recNew) saveRec(); }
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: PAGES }, worker));
  saveRec();
  fs.writeFileSync(path.join(OUT, 'report.json.gz'), zlib.gzipSync(JSON.stringify(report)));
  const tot = { ali: 0, idx: 0, ebay: 0, etsy: 0, final: 0, empty: 0 };
  for (const r of report) {
    for (const k of ['ali', 'idx', 'ebay', 'etsy']) tot[k] += (r.raw[k] || []).length;
    tot.final += r.final.length; if (!r.final.length) tot.empty++;
  }
  const summary = { queries: report.length, seconds: Math.round((Date.now() - t0) / 1000), newResponses: recNew, totals: tot, pageErrors: [...new Set(errors)].slice(0, 20), at: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary));
  await browser.close();
  server.close();
})();
