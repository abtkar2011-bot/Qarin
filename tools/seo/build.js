// قارِن — صفحات قوقل (مقارنة أسعار) + عروض اليوم + تاريخ الأسعار، من قوائم المتاجر الشريكة.
//   node tools/seo/build.js <partners> <history-cache> <out>
//   ← out/compare/*.html     صفحة لكل ماركة عطر / بلد قهوة / أداة (فيها منتجات من أكثر من متجر)
//   ← out/deals.html + out/data/deals.txt   أكبر التخفيضات اليوم، ونص جاهز لقناة الواتساب
//   ← out/data/h/<متجر>.json  تاريخ سعر كل منتج (يتسجل كل يوم في <history-cache>)
//   ← out/sitemap.xml + out/robots.txt
const fs = require('fs');
const path = require('path');

const [, , PARTNERS = 'partners', HIST = 'pricehist', OUT = 'seoout'] = process.argv;
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const ROOT = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---- أسماء المتاجر ومجموعاتها من index.html نفسه (عشان ما تختلف) ----
const NAME = {}, GROUP = {}, AFF = {};
for (const m of html.matchAll(/^\s*([a-z0-9]+):\s*\{\s*name:\s*'([^']+)'/gm)) NAME[m[1]] = m[2];
for (const m of html.matchAll(/^\s*([a-z0-9]+): Object\.assign\(\{ file: 'data\/p\/[a-z0-9]+\.json'[^}]*\}, (PERF|COFFEE)_FEED[,)]/gm)) GROUP[m[1]] = m[2] === 'PERF' ? 'perfume' : 'coffee';
for (const m of html.matchAll(/^\s*([a-z0-9]+):[^\n]*?file: 'data\/p\/[a-z0-9]+\.json'[^\n]*?aff: '(https:\/\/[^']+)'/gm)) AFF[m[1]] = m[2];
const USD_OMR = 1 / 2.6008, RATE = { OMR: 1, USD: USD_OMR, AED: USD_OMR / 3.6725, SAR: USD_OMR / 3.75 };

const today = new Date(Date.now() + 4 * 3600e3);              // توقيت عُمان
const DAY = Math.floor(today.getTime() / 864e5);               // رقم اليوم (للتاريخ)
const dateAr = today.toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const omr = v => (Math.round(v * 1000) / 1000).toFixed(3);
const link = (k, u) => AFF[k] ? AFF[k] + '?ulp=' + encodeURIComponent(u) : u;

// ---- كل المنتجات ----
const items = [];
const stores = fs.readdirSync(PARTNERS).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5));
for (const k of stores) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(PARTNERS, k + '.json'), 'utf8')); } catch (e) { continue; }
  const rate = RATE[d.cur || 'OMR'] || 1;
  for (const r of d.items || []) {
    const [t, p, img, u, tags, orig] = r;
    if (!(p > 0) || !u || !t) continue;
    items.push({ k, t: String(t).replace(/Â|\u00a0/g, ' ').replace(/\s+/g, ' ').trim(), p: p * rate, o: orig > p ? orig * rate : 0, img: img || '', u: String(u), tags: String(tags || ''), raw: p });
  }
}
console.log('items', items.length, 'stores', stores.length);

// ---- تاريخ الأسعار: نضيف سطر لما يتغير السعر (أو أول مرة نشوف المنتج) ----
fs.mkdirSync(HIST, { recursive: true });
fs.mkdirSync(path.join(OUT, 'data', 'h'), { recursive: true });
const histOut = {};
for (const k of stores) {
  const fp = path.join(HIST, k + '.json');
  let h = {}; try { h = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { /* أول مرة */ }
  const seen = new Set();
  for (const it of items.filter(x => x.k === k)) {
    seen.add(it.u);
    const arr = h[it.u] || (h[it.u] = []);
    const last = arr[arr.length - 1];
    if (!last || Math.abs(last[1] - it.raw) > 1e-6) arr.push([DAY, it.raw]);
    if (arr.length > 60) arr.splice(0, arr.length - 60);
  }
  // منتج اختفى من المتجر من أكثر من 90 يوم: نشيله
  for (const u of Object.keys(h)) if (!seen.has(u) && DAY - h[u][h[u].length - 1][0] > 90) delete h[u];
  fs.writeFileSync(fp, JSON.stringify(h));
  // للموقع: بس المنتجات اللي تغيّر سعرها (الباقي سعره ثابت من أول ما سجلنا)
  const pub = {}; let first = DAY;
  for (const [u, arr] of Object.entries(h)) { first = Math.min(first, arr[0][0]); if (arr.length > 1 && seen.has(u)) pub[u] = arr; }
  histOut[k] = { since: first, n: Object.keys(pub).length };
  fs.writeFileSync(path.join(OUT, 'data', 'h', k + '.json'), JSON.stringify({ day: DAY, since: first, h: pub }));
}
console.log('history', JSON.stringify(histOut));

// ---- صفحات المقارنة ----
const W = (alts) => new RegExp('(^|[^a-z\\u0600-\\u06ff])(' + alts + ')(?![a-z\\u0600-\\u06ff])', 'i');
const BRANDS = [['dior', 'ديور'], ['chanel', 'شانيل'], ['tom ford', 'توم فورد'], ['creed', 'كريد'], ['amouage', 'أمواج'], ['lattafa', 'لطافة'], ['ajmal', 'أجمل'], ['rasasi', 'الرصاصي'],
  ['swiss arabian', 'سويس أرابيان'], ['arabian oud', 'العربية للعود'], ['armani|giorgio armani', 'أرماني'], ['versace', 'فيرساتشي'], ['yves saint laurent|ysl', 'إيف سان لوران'], ['gucci', 'غوتشي'],
  ['prada', 'برادا'], ['hugo boss', 'هوغو بوس'], ['calvin klein', 'كالفن كلاين'], ['paco rabanne|rabanne', 'باكو رابان'], ['montblanc|mont blanc', 'مونت بلانك'], ['givenchy', 'جيفنشي'],
  ['lancome|lancôme', 'لانكوم'], ['guerlain', 'غيرلان'], ['hermes|hermès', 'هيرميس'], ['jo malone', 'جو مالون'], ['kilian', 'كيليان'], ['xerjoff', 'زيرجوف'], ['nishane', 'نيشان'],
  ['initio', 'إنيشيو'], ['parfums de marly|de marly', 'بارفيوم دي مارلي'], ['maison francis kurkdjian|kurkdjian', 'ميزون فرانسيس كوركدجيان'], ['bvlgari|bulgari', 'بولغاري'],
  ['burberry', 'بربري'], ['carolina herrera', 'كارولينا هيريرا'], ['dolce & gabbana|dolce&gabbana|dolce and gabbana|d&g', 'دولتشي آند غابانا'], ['valentino', 'فالنتينو'],
  ['narciso rodriguez', 'نارسيسو رودريغيز'], ['mancera', 'مانسيرا'], ['montale', 'مونتال'], ['byredo', 'بايريدو'], ['le labo', 'لو لابو'], ['davidoff', 'دافيدوف'], ['azzaro', 'أزارو'],
  ['lalique', 'لاليك'], ['elie saab', 'إيلي صعب'], ['afnan', 'أفنان'], ['armaf', 'أرماف'], ['al haramain', 'الحرمين'], ['ard al zaafaran', 'أرض الزعفران'], ['victor hills', 'فيكتور هيلز'],
  ['mark des vince', 'مارك دي فينس'], ['jean paul gaultier|gaultier', 'جان بول غوتييه'], ['cartier', 'كارتييه'], ['chloe|chloé', 'كلوي'], ['marc jacobs', 'مارك جيكوبس'],
  ['viktor&rolf|viktor & rolf|viktor and rolf', 'فيكتور آند رولف'], ['roja', 'روجا'], ['penhaligon', 'بنهاليغونز'], ['ex nihilo', 'إكس نيهيلو'], ['mugler', 'موغلر'], ['kayali', 'كيالي'],
  ['abdul samad al qurashi|al qurashi', 'عبدالصمد القرشي'], ['louis vuitton', 'لويس فيتون'], ['dunhill', 'دنهل'], ['boadicea', 'بوديسيا'], ['ormonde jayne', 'أورموند جين'],
  ['al majed|almajed', 'الماجد للعود'], ['ibraq', 'إبراق'], ['al hajis|alhajis', 'الحاجي'], ['asgharali|asghar ali', 'أصغر علي'], ['nawader', 'نوادر العود']];
const ORIGINS = [['ethiopia|ethiopian|إثيوبيا|اثيوبيا|إثيوبي|اثيوبي', 'القهوة الإثيوبية', 'ethiopian-coffee'], ['colombia|colombian|كولومبيا|كولومبي', 'القهوة الكولومبية', 'colombian-coffee'],
  ['brazil|brazilian|البرازيل|برازيل', 'القهوة البرازيلية', 'brazilian-coffee'], ['kenya|kenyan|كينيا|كيني', 'القهوة الكينية', 'kenyan-coffee'], ['yemen|yemeni|اليمن|يمني|يمنية', 'القهوة اليمنية', 'yemeni-coffee'],
  ['guatemala|غواتيمالا|جواتيمالا', 'قهوة غواتيمالا', 'guatemala-coffee'], ['honduras|هندوراس', 'قهوة هندوراس', 'honduras-coffee'], ['costa rica|كوستاريكا|كوستا ريكا', 'قهوة كوستاريكا', 'costa-rica-coffee'],
  ['panama|بنما|geisha|gesha|قيشا|جيشا', 'قهوة بنما والقيشا', 'panama-geisha-coffee'], ['rwanda|رواندا', 'قهوة رواندا', 'rwanda-coffee'], ['burundi|بوروندي', 'قهوة بوروندي', 'burundi-coffee'],
  ['el salvador|السلفادور', 'قهوة السلفادور', 'el-salvador-coffee'], ['peru|بيرو', 'قهوة بيرو', 'peru-coffee'], ['indonesia|sumatra|إندونيسيا|اندونيسيا|سومطرة', 'قهوة إندونيسيا', 'indonesia-coffee'],
  ['nicaragua|نيكاراغوا|نيكاراجوا', 'قهوة نيكاراغوا', 'nicaragua-coffee'], ['mexico|المكسيك', 'قهوة المكسيك', 'mexico-coffee'], ['uganda|أوغندا|اوغندا', 'قهوة أوغندا', 'uganda-coffee'],
  ['tanzania|تنزانيا', 'قهوة تنزانيا', 'tanzania-coffee'], ['china|yunnan|الصين|يونان', 'قهوة الصين', 'china-coffee'], ['india|الهند|هندي', 'قهوة الهند', 'india-coffee']];
const TOOLS = [['v60|في 60|في٦٠', 'أقماع V60', 'v60'], ['chemex|كيمكس', 'كيمكس', 'chemex'], ['aeropress|ايروبرس|إيروبرس|ايرو برس', 'إيروبرس', 'aeropress'],
  ['grinder|مطحنة|مطحنه|مطاحن', 'مطاحن القهوة', 'coffee-grinders'], ['kettle|غلاية|غلايه|غلايات', 'غلايات القهوة', 'coffee-kettles'], ['scale|ميزان|موازين', 'موازين القهوة', 'coffee-scales'],
  ['espresso machine|coffee machine|مكينة|ماكينة|مكائن|مكاين', 'مكائن القهوة', 'coffee-machines'], ['french press|فرنش برس|فرنش', 'فرنش برس', 'french-press'], ['moka|موكا', 'موكا بوت', 'moka-pot'],
  ['drip bag|drip bags|دريب|مقطرة', 'قهوة الدريب', 'drip-coffee'], ['capsule|capsules|كبسولة|كبسولات|nespresso|نسبريسو', 'كبسولات القهوة', 'coffee-capsules'],
  ['omani coffee|قهوة عمانية|قهوه عمانيه|قهوة عماني', 'القهوة العمانية', 'omani-coffee'], ['turkish coffee|قهوة تركية|قهوه تركيه|تركي', 'القهوة التركية', 'turkish-coffee'],
  ['cold brew|كولد برو', 'كولد برو', 'cold-brew'], ['filter paper|filters|فلتر|فلاتر', 'فلاتر القهوة', 'coffee-filters']];
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pages = [];
const perfume = items.filter(x => GROUP[x.k] === 'perfume' || x.k === 'vperfumes');
const coffee = items.filter(x => GROUP[x.k] === 'coffee');
for (const [alts, ar] of BRANDS) {
  const re = W(alts), en = alts.split('|')[0].replace(/\b\w/g, c => c.toUpperCase());
  const list = perfume.filter(x => re.test(x.t) || re.test(x.tags.split('|').slice(0, 3).join(' ')));
  pages.push({ slug: 'perfume-' + slug(alts.split('|')[0]), list, kind: 'perfume', q: en,
    h1: `أسعار عطور ${ar} (${en}) في عُمان`, title: `أسعار عطور ${en} ${ar} في عُمان — قارن بين المتاجر | قارِن`, name: `عطور ${ar}`, what: `عطر ${ar}` });
}
for (const [alts, ar, sl] of ORIGINS) {
  const re = W(alts);
  const list = coffee.filter(x => re.test(x.t + ' ' + x.tags) && !/grinder|مطحن|kettle|غلاي|v60|dripper|قمع|scale|ميزان|cup|كوب/i.test(x.t));
  pages.push({ slug: sl, list, kind: 'coffee', q: ar, h1: `أسعار ${ar} في عُمان`, title: `${ar} — أسعار المحامص في عُمان | قارِن`, name: ar, what: ar });
}
for (const [alts, ar, sl] of TOOLS) {
  const re = W(alts);
  const list = coffee.filter(x => re.test(x.t) || (/omani|turkish|عمان|ترك/.test(alts) && re.test(x.tags)));
  pages.push({ slug: sl, list, kind: 'coffee', q: ar, h1: `أسعار ${ar} في عُمان`, title: `${ar} — قارن الأسعار في المتاجر العمانية | قارِن`, name: ar, what: ar });
}
// صفحة تستاهل: 4 منتجات أو أكثر من متجرين أو أكثر
const good = pages.filter(pg => pg.list.length >= 4 && new Set(pg.list.map(x => x.k)).size >= 2);
for (const pg of good) {
  const seen = new Set();
  pg.list = pg.list.sort((a, b) => a.p - b.p).filter(x => { const d = x.k + '|' + x.t.toLowerCase(); if (seen.has(d)) return false; seen.add(d); return true; });
  pg.stores = [...new Set(pg.list.map(x => x.k))];
}
console.log('pages', good.length, 'of', pages.length);

const CSS = `:root{--bg:#F5F5F7;--card:#fff;--fg:#1D1D1F;--muted:#6E6E73;--line:#E3E3E8;--accent:#0071E3;--hot:#BF4800}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--fg:#F5F5F7;--muted:#98989D;--line:#38383A;--accent:#2997FF;--hot:#FF9F0A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"SF Arabic","Segoe UI",Tahoma,Arial,sans-serif;line-height:1.6}
a{color:var(--accent)}header{display:flex;align-items:center;gap:10px;padding:14px 16px;max-width:1100px;margin:auto}header img{width:40px;height:40px;border-radius:10px}
header b{font-size:20px}header a{margin-inline-start:auto;font-weight:700;text-decoration:none}main{max-width:1100px;margin:auto;padding:0 16px 40px}
h1{font-size:clamp(22px,5vw,32px);margin:8px 0 4px;line-height:1.35}.sub{color:var(--muted);margin:0 0 14px}
.cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:999px;margin:4px 0 14px}
.sum{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px}
.c{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.c img{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:12px}.st{font-size:12px;color:var(--muted)}
.t{font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.8em}
.pr{font-weight:800;font-size:16px}.pr s{color:var(--muted);font-weight:400;font-size:12px;margin-inline-start:6px}.off{color:var(--hot);font-size:12px;font-weight:700}
.go{margin-top:auto;text-align:center;border:1px solid var(--line);border-radius:999px;padding:7px;text-decoration:none;font-weight:700;font-size:13px}
.more{margin-top:26px}.more a{display:inline-block;margin:4px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:13px;background:var(--card)}
footer{color:var(--muted);font-size:12px;text-align:center;padding:20px}`;

function page({ title, h1, sub, cta, body, canonical, desc, ld }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${SITE}icons/icon-512.png?v=5">
<link rel="icon" href="${SITE}icons/favicon-32.png?v=5"><link rel="apple-touch-icon" href="${SITE}icons/apple-touch-icon.png?v=5">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}<style>${CSS}</style></head><body>
<header><img src="${SITE}icons/apple-touch-icon.png?v=5" alt="قارِن"><b>قارِن</b><a href="${SITE}">ابحث في قارِن ←</a></header>
<main><h1>${esc(h1)}</h1><p class="sub">${sub}</p>${cta || ''}${body}</main>
<footer>قارِن — قارن الأسعار من كل المتاجر في بحث واحد · الأسعار من مواقع المتاجر وتتحدث كل يوم، وقد تتغير عند المتجر · <a href="${SITE}compare/">كل صفحات المقارنة</a> · <a href="${SITE}deals.html">عروض اليوم</a></footer></body></html>`;
}
const card = x => { const off = x.o ? Math.round((1 - x.p / x.o) * 100) : 0;
  return `<div class="c"><img src="${esc(x.img)}" alt="${esc(x.t)}" loading="lazy" referrerpolicy="no-referrer"><span class="st">${esc(NAME[x.k] || x.k)}</span><span class="t">${esc(x.t)}</span>
<span class="pr">${omr(x.p)} ر.ع.${x.o ? `<s>${omr(x.o)}</s>` : ''}</span>${off >= 5 ? `<span class="off">خصم ${off}%</span>` : ''}<a class="go" href="${esc(link(x.k, x.u))}" target="_blank" rel="noopener sponsored">تسوّق من ${esc(NAME[x.k] || x.k)} ↗</a></div>`; };

fs.mkdirSync(path.join(OUT, 'compare'), { recursive: true });
const byKind = { perfume: good.filter(p => p.kind === 'perfume'), coffee: good.filter(p => p.kind === 'coffee') };
for (const pg of good) {
  const L = pg.list, min = L[0], max = L[L.length - 1], url = `${SITE}compare/${pg.slug}.html`;
  const storesAr = pg.stores.map(k => NAME[k] || k);
  const sn = pg.stores.length, sw = sn === 2 ? 'متجرين' : `${sn} ${sn >= 3 && sn <= 10 ? 'متاجر' : 'متجر'}`;
  const sub = `${L.length} منتج من ${sw} في عُمان · آخر تحديث ${dateAr}`;
  const summary = `<div class="sum">أرخص ${esc(pg.what)} حاليًا: <b>${omr(min.p)} ر.ع.</b> في ${esc(NAME[min.k] || min.k)} («${esc(min.t)}»)، والأسعار توصل لين ${omr(max.p)} ر.ع. نقارن بين: ${esc(storesAr.join('، '))}.</div>`;
  const rel = byKind[pg.kind].filter(p => p !== pg).slice(0, 30).map(p => `<a href="${p.slug}.html">${esc(p.name)}</a>`).join('');
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: pg.h1, numberOfItems: Math.min(L.length, 60),
    itemListElement: L.slice(0, 30).map((x, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Product', name: x.t, image: x.img || undefined,
      offers: { '@type': 'Offer', price: omr(x.p), priceCurrency: 'OMR', url: x.u, seller: { '@type': 'Organization', name: NAME[x.k] || x.k } } } })) };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: `وين ألقى أرخص ${pg.what} في عُمان؟`,
    acceptedAnswer: { '@type': 'Answer', text: `حسب أسعار اليوم (${dateAr})، أرخص سعر ${omr(min.p)} ريال عماني في ${NAME[min.k] || min.k}. قارِن يقارن ${L.length} منتج من ${sw}.` } }] };
  fs.writeFileSync(path.join(OUT, 'compare', pg.slug + '.html'), page({ title: pg.title, h1: pg.h1, sub, canonical: url, ld: [ld, faq],
    desc: `قارن أسعار ${pg.what} في ${sw} في عُمان. أرخص سعر اليوم ${omr(min.p)} ر.ع. في ${NAME[min.k] || min.k}.`,
    cta: `<a class="cta" href="${SITE}?q=${encodeURIComponent(pg.q)}">قارن ${esc(pg.name)} في قارِن ←</a>`,
    body: summary + `<div class="grid">${L.slice(0, 60).map(card).join('')}</div><div class="more"><b>صفحات مقارنة ثانية:</b><br>${rel}</div>` }));
}
// فهرس صفحات المقارنة
const idx = (t, list) => list.length ? `<h2>${t}</h2><div class="more">${list.map(p => `<a href="${p.slug}.html">${esc(p.name)} (${p.list.length})</a>`).join('')}</div>` : '';
fs.writeFileSync(path.join(OUT, 'compare', 'index.html'), page({ title: 'مقارنة أسعار العطور والقهوة في عُمان | قارِن', h1: 'مقارنة الأسعار في المتاجر العمانية',
  sub: `${good.length} صفحة مقارنة · آخر تحديث ${dateAr}`, canonical: SITE + 'compare/', desc: 'قارن أسعار العطور حسب الماركة، والقهوة حسب البلد والأدوات، في المتاجر العمانية. تتحدث كل يوم.',
  body: idx('🌸 العطور حسب الماركة', byKind.perfume) + idx('☕ القهوة حسب البلد والأدوات', byKind.coffee) }));

// ---- عروض اليوم: أكبر تخفيض حقيقي (السعر قبل/بعد من المتجر نفسه) ----
// خصم بين 15% و70% (أكبر من كذا غالبًا سعر قبل منفوخ)، والماركات المعروفة أول
const BRAND_RE = W(BRANDS.map(b => b[0]).join('|'));
const deals = items.filter(x => x.o && x.p >= 1 && x.o / x.p >= 1.18 && x.o / x.p <= 3.4).map(x => Object.assign(x, { off: Math.round((1 - x.p / x.o) * 100), known: BRAND_RE.test(x.t) }))
  .sort((a, b) => (b.known - a.known) || (b.off * Math.log(b.o + 1)) - (a.off * Math.log(a.o + 1)));
const per = {}, top = [];
const perB = {};
for (const d of deals) { const bm = (d.t.toLowerCase().match(BRAND_RE) || [])[2] || d.t.toLowerCase().split(' ')[0]; if ((perB[bm] || 0) >= 2 || (per[d.k] || 0) >= 3) continue; per[d.k] = (per[d.k] || 0) + 1; perB[bm] = (perB[bm] || 0) + 1; if (top.some(x => x.t.toLowerCase() === d.t.toLowerCase())) continue; top.push(d); if (top.length >= 30) break; }
fs.writeFileSync(path.join(OUT, 'deals.html'), page({ title: `عروض اليوم في المتاجر العمانية (${dateAr}) | قارِن`, h1: '🔥 عروض اليوم',
  sub: `أكبر التخفيضات في المتاجر اللي يقارنها قارِن · ${dateAr}`, canonical: SITE + 'deals.html', desc: 'أكبر تخفيضات اليوم على العطور والقهوة والمنتجات في المتاجر العمانية، تتحدث كل يوم.',
  body: `<div class="grid">${top.map(card).join('')}</div>` }));
const short = s => s.length > 60 ? s.slice(0, 57) + '…' : s;
const txt = [`🔥 عروض اليوم من قارِن — ${dateAr}`, ''].concat(top.slice(0, 8).flatMap((d, i) => [
  `${i + 1}) ${short(d.t)}`, `💰 ${omr(d.p)} ر.ع. بدل ${omr(d.o)} (خصم ${d.off}%) · ${NAME[d.k] || d.k}`, link(d.k, d.u), ''])).concat([`كل العروض: ${SITE}deals.html`, `قارن قبل ما تشتري 👇`, SITE]).join('\n');
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', 'deals.txt'), txt);
fs.writeFileSync(path.join(OUT, 'data', 'deals.json'), JSON.stringify({ day: dateAr, items: top.map(d => ({ k: d.k, t: d.t, p: +omr(d.p), o: +omr(d.o), off: d.off, u: link(d.k, d.u), img: d.img })) }));
console.log('deals', top.length);

// ---- sitemap + robots ----
const urls = [[SITE, 'daily', '1.0'], [SITE + 'coupons.html', 'daily', '0.8'], [SITE + 'deals.html', 'daily', '0.8'], [SITE + 'compare/', 'daily', '0.8'],
  [SITE + 'searches.html', 'weekly', '0.6'], [SITE + 'about.html', 'monthly', '0.4'], [SITE + 'privacy.html', 'monthly', '0.3']]
  .concat(good.map(p => [`${SITE}compare/${p.slug}.html`, 'daily', '0.7']));
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(([u, f, pr]) => `  <url><loc>${u}</loc><lastmod>${dateAr}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /Qarin/admin/\nDisallow: /Qarin/data/\nDisallow: /Qarin/models/\n\nSitemap: ${SITE}sitemap.xml\n`);
console.log('done');
