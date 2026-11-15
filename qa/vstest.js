// قارِن — اختبار «البحث بنفس الشكل» على نسخة محلية من الموقع (قبل النشر).
// يصوّر منتجات حقيقية «كأنها من كاميرا الجوال» (قص، ميلان، خلفية، إضاءة، تشويش) ويشوف هل نفس المنتج يطلع فوق.
//   SITE_DIR=site OUT=probe-out node qa/vstest.js
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require(path.resolve('tools/embed/node_modules/sharp'));
const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const DIR = process.env.SITE_DIR || 'site';
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/vstest.txt', lines.join('\n')); };

async function camera(url, i) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) return null;
  const b = await sharp(Buffer.from(await r.arrayBuffer())).flatten({ background: '#ffffff' }).resize(700, 700, { fit: 'inside' }).toBuffer();
  const m = await sharp(b).metadata(); const BG = ['#8a7a66', '#d8d2c8', '#3b3b3b', '#c9b79c', '#e8e4dc'];
  const crop = await sharp(b).extract({ left: Math.round(m.width * 0.07), top: Math.round(m.height * 0.05), width: Math.round(m.width * 0.86), height: Math.round(m.height * 0.86) }).rotate(i % 2 ? 8 : -6, { background: BG[i % 5] }).toBuffer();
  const cm = await sharp(crop).metadata();
  return sharp({ create: { width: cm.width + 240, height: cm.height + 360, channels: 3, background: BG[i % 5] } }).composite([{ input: crop, left: 110, top: 170 }]).modulate({ brightness: 0.88 }).blur(1).jpeg({ quality: 72 }).toBuffer();
}

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1'], { cwd: DIR, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'data/pe/index.json'), 'utf8'));
  L('prints index:', JSON.stringify(idx).slice(0, 600));
  const pick = (k, n, from = 0) => { const d = JSON.parse(fs.readFileSync(path.join(DIR, 'data/p', k + '.json'), 'utf8')); return d.items.filter(it => it[1] > 0 && it[2]).slice(from, from + 40).filter((_, j) => j % 8 === 0).slice(0, n).map(it => ({ k, t: it[0], img: it[2] })); };
  const cases = [
    ...['vperfumes', 'alhajis', 'swissarabian', 'oudworlds', 'boulevard'].flatMap(k => fs.existsSync(path.join(DIR, 'data/p', k + '.json')) ? pick(k, 2, 5).map(c => ({ ...c, sec: 'perfume' })) : []),
    ...['mahaseel', 'souqalbon', 'epanda', 'copper', 'bunalqassab'].flatMap(k => fs.existsSync(path.join(DIR, 'data/p', k + '.json')) ? pick(k, 2, 3).map(c => ({ ...c, sec: 'coffee' })) : []),
  ];
  cases.push(...cases.filter((_, i) => i % 5 === 0).map(c => ({ ...c, sec: 'main' })));
  L('cases', cases.length);
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /look/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  let top1 = 0, top3 = 0, n = 0, first = true;
  for (const [i, c] of cases.entries()) {
    const buf = await camera(c.img, i).catch(() => null); if (!buf) { L('skip (image)', c.t); continue; }
    const f = `/tmp/vs_${i}.jpg`; fs.writeFileSync(f, buf); if (i < 3) fs.writeFileSync(`${OUT}/q_${i}.jpg`, buf);
    const hash = c.sec === 'main' ? '' : '#' + c.sec;
    await p.goto('http://127.0.0.1:8080/?t=' + Date.now() + hash); await p.waitForTimeout(c.sec === 'main' ? 1200 : 2500);
    const input = { perfume: '#pfImgIn', coffee: '#cfImgIn', main: '#imgIn' }[c.sec];
    const t0 = Date.now(); await p.setInputFiles(input, f);
    const ok = await p.waitForSelector('.vs-box .pcard', { timeout: first ? 180000 : 60000 }).then(() => true).catch(() => false);
    const ms = Date.now() - t0; first = false;
    if (!ok) { L('FAIL no box', c.sec, c.k, c.t, ms + 'ms', (await p.locator('.vs-box').innerText().catch(() => '')).slice(0, 120), '|', (await p.locator('#status').innerText().catch(() => '')).slice(0, 100)); await p.screenshot({ path: `${OUT}/fail_${i}.jpg`, type: 'jpeg', quality: 60 }); continue; }
    const titles = await p.$$eval('.vs-box .ptitle', e => e.map(x => x.textContent.trim()));
    const head = await p.locator('.vs-box h2').innerText();
    const r = titles.findIndex(t => t === c.t.trim()); n++; if (r === 0) top1++; if (r >= 0 && r < 3) top3++;
    L(r === 0 ? 'TOP1' : r > 0 && r < 3 ? 'TOP3' : 'MISS', c.sec, c.k, '|', c.t.slice(0, 50), '| got:', titles.slice(0, 2).map(t => t.slice(0, 40)).join(' / '), '|', head, '|', ms + 'ms');
    if (i < 4 || r !== 0) { await p.locator('.vs-box').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/box_${i}.jpg`, type: 'jpeg', quality: 60 }); }
  }
  L(`SUMMARY top1 ${top1}/${n}  top3 ${top3}/${n}`);
  L('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close(); srv.kill();
})().catch(e => { L('CRASH', e.stack); process.exit(1); });
