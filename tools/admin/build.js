// قارِن — بيانات صفحة الأدمن (مشفّرة بكلمة السر ADMIN_PASS من أسرار GitHub).
//   node tools/admin/build.js <partners> <out-dir>
// تشفير: PBKDF2-SHA256 (310 ألف دورة) ← مفتاح AES-256-GCM. بدون كلمة السر الملف ما ينقرأ.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , PARTNERS = 'partners', OUT = 'adminout'] = process.argv;
const ROOT = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NAME = {}, GROUP = {};
for (const m of html.matchAll(/^\s*([a-z0-9]+):\s*\{\s*name:\s*'([^']+)'/gm)) NAME[m[1]] = m[2];
for (const m of html.matchAll(/^\s*([a-z0-9]+): Object\.assign\(\{ file: 'data\/p\/[a-z0-9]+\.json'[^}]*\}, (PERF|COFFEE)_FEED[,)]/gm)) GROUP[m[1]] = m[2] === 'PERF' ? 'عطور' : 'قهوة';
const FEEDS = [...html.matchAll(/^\s*([a-z0-9]+):[^\n]*?file: 'data\/p\/([a-z0-9]+)\.json'/gm)].map(m => m[1]);
const readJ = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };

const idx = readJ(path.join(PARTNERS, 'index.json'), {}) || {};
const run = readJ(process.env.STATUS_FILE || '/tmp/qarin_status.json', null);
const pe = readJ('embout/pe/index.json', null);
const deals = readJ('seoout/data/deals.json', null);
const coupons = readJ('coupons.json', null);
const now = Date.now();
const stores = [...new Set([...FEEDS, ...Object.keys(idx)])].map(k => {
  const i = idx[k], st = run && run.stores && run.stores[k], pr = pe && pe.stores && pe.stores[k];
  const age = i && i.updated ? (now - Date.parse(i.updated)) / 864e5 : null;
  const status = !i ? 'off' : st && !st.ok ? 'warn' : age > 1.5 ? 'warn' : 'ok';
  return { k, name: NAME[k] || k, group: GROUP[k] || 'متاجر', n: i ? i.n : 0, updated: i ? i.updated : null, age: age == null ? null : +age.toFixed(2),
    prints: pr ? pr.ok : 0, status, msg: st && !st.ok ? st.msg + (st.removed ? ' — انشال من الموقع' : st.age != null ? ` — نعرض قائمة عمرها ${st.age} يوم` : '') : (!i ? 'ما له قائمة (مقفل أو ما تحدّث من أكثر من 3 أيام)' : '') };
}).sort((a, b) => ({ off: 0, warn: 1, ok: 2 })[a.status] - ({ off: 0, warn: 1, ok: 2 })[b.status] || b.n - a.n);

const c = coupons && Array.isArray(coupons.coupons) ? coupons.coupons : [];
const data = {
  built: new Date().toISOString(),
  run: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '',
  event: process.env.GITHUB_EVENT_NAME || '',
  steps: { partners: process.env.ST_PARTNERS || '', prints: process.env.ST_PRINTS || '', seo: process.env.ST_SEO || '', aliexpress: process.env.ST_ALI || '' },
  stores,
  totals: { products: stores.reduce((a, s) => a + s.n, 0), storesOn: stores.filter(s => s.n).length, prints: pe ? Object.values(pe.stores).reduce((a, s) => a + (s.ok || 0), 0) : 0, printsOn: !!(pe && pe.dim) },
  coupons: { n: c.length, updated: coupons && coupons.updated },
  deals: deals ? deals.items.slice(0, 10) : [],
  pages: fs.existsSync('seoout/compare') ? fs.readdirSync('seoout/compare').filter(f => f.endsWith('.html') && f !== 'index.html').length : 0,
};

fs.mkdirSync(OUT, { recursive: true });
// ملخص صحة المتاجر للتقرير الأسبوعي (فرع health-out). بدون روابط ولا تعليقات ولا إحصائيات الزوار.
{
  const clean = m => String(m || '').replace(/https?:\/\/\S+/g, '[رابط]').slice(0, 140);
  const day = { at: data.built, event: data.event, run: data.run, steps: data.steps, products: data.totals.products, storesOn: data.totals.storesOn,
    prints: data.totals.prints, coupons: data.coupons.n, pages: data.pages, deals: deals ? deals.items.length : 0,
    warn: stores.filter(s => s.status === 'warn').map(s => s.k), off: stores.filter(s => s.status === 'off').map(s => s.k) };
  const prev = readJ(process.env.HEALTH_PREV || '/tmp/hp/log.json', []);
  const log = (Array.isArray(prev) ? prev : []).concat([day]).filter(d => Date.parse(d.at) > now - 45 * 864e5).slice(-300);
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log));
  fs.writeFileSync(path.join(OUT, 'health.json'), JSON.stringify({ ...day, stores: stores.map(s => ({ k: s.k, name: s.name, group: s.group, n: s.n, age: s.age, prints: s.prints, status: s.status, msg: clean(s.msg) })) }, null, 1));
}
const pass = process.env.ADMIN_PASS || '';
if (!pass) {
  fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify({ v: 1, missing: true }));
  console.log('ADMIN_PASS not set: admin data not published');
} else {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 310000;
  const key = crypto.pbkdf2Sync(pass, salt, iter, 32, 'sha256');
  const ci = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([ci.update(JSON.stringify(data), 'utf8'), ci.final(), ci.getAuthTag()]);
  fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify({ v: 1, iter, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') }));
  console.log('admin data encrypted:', stores.length, 'stores');
}
