// يبني ملفات منتجات المتاجر الشريكة لقارِن: V Perfumes (عُمان) و DermaZone (Admitad)،
// ومتاجر القهوة العمانية: Copper Roastery و بن القصاب و Spirit Hub و سوق البن و ePanda (روابط مباشرة).
// node tools/partners/build.js <out-dir>
// الناتج: <out>/<store>.json بشكل مضغوط:
//   { updated, cur, items: [[title, price, image, url, tags, original?, rating?, reviews?], ...], brands: [...] }
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'partners';
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/about.html)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// بعض الأسماء عندهم مكتوبة بترميز خربان («GiÃ²» بدل «Giò»): نرجّعها
function fixText(v) {
  let t = String(v || '');
  if (/[ÃÂ][\u0080-\u00BF]/.test(t) && !/[^\u0000-\u00FF]/.test(t)) { const f = Buffer.from(t, 'latin1').toString('utf8'); if (!f.includes('\uFFFD')) t = f; }
  return t.replace(/[\u00A0\s]+/g, ' ').trim();
}
async function get(url, tries = 3, extra = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: Object.assign({ 'user-agent': UA, 'accept-language': 'en' }, extra), signal: AbortSignal.timeout(30000) });
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
    } catch (e) { /* نعيد المحاولة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const locs = xml => [...String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
const slugWords = u => (u.split('/').pop() || '').replace(/-/g, ' ');

// ---------- V Perfumes: صفحات الأقسام والمجموعات والماركات (كل صفحة فيها 24 منتج في JSON-LD) ----------
function parseVListing(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch (e) { continue; }
    if (!d || d['@type'] !== 'ItemList' || !Array.isArray(d.itemListElement)) continue;
    for (const el of d.itemListElement) {
      const it = el && el.item; if (!it || !it.url || !it.name) continue;
      const of = it.offers || {}; const price = +of.price;
      if (!(price > 0) || of.priceCurrency !== 'OMR') continue;
      if (/OutOfStock|SoldOut|Discontinued/i.test(of.availability || '')) continue;
      out.push({ t: fixText(it.name), p: price, i: String(it.image || ''), u: String(it.url), b: (it.brand && it.brand.name) || '' });
    }
  }
  return out;
}
async function vperfumes() {
  const V = 'https://www.vperfumes.com/om-en';
  // أول شي المجموعات (الأكثر مبيعًا أولًا) ثم الأقسام ثم الماركات
  const pages = [...locs(await get(V + '/sitemaps/collections/0.xml')), ...locs(await get(V + '/sitemaps/categories/0.xml')), ...locs(await get(V + '/sitemaps/brands/0.xml'))]
    .filter(u => /\/om-en\/(collection|category|brands)\//.test(u));
  const best = pages.findIndex(u => /best-sellers/.test(u)); if (best > 0) pages.unshift(pages.splice(best, 1)[0]);
  console.log('vperfumes pages', pages.length);
  const map = new Map(); let done = 0;
  const work = async () => {
    while (pages.length) {
      const u = pages.shift();
      const items = parseVListing(await get(u));
      const tag = slugWords(u);
      for (const it of items) {
        const k = it.u; const cur = map.get(k);
        if (cur) { if (!cur.tags.includes(tag)) cur.tags.push(tag); }
        else map.set(k, { ...it, tags: [tag] });
      }
      if (++done % 50 === 0) console.log('  pages', done, 'products', map.size);
      await sleep(250);
    }
  };
  await Promise.all([work(), work(), work()]);
  const items = [...map.values()];
  return { updated: new Date().toISOString(), cur: 'OMR', store: 'https://www.vperfumes.com',
    brands: [...new Set(items.map(x => x.b.toLowerCase()).filter(b => b && b !== 'v perfumes'))],
    items: items.map(x => [x.t, x.p, x.i, x.u, (x.b + ' | ' + x.tags.join(' | ')).toLowerCase()]) };
}

// ---------- DermaZone: متجر Shopify، الكتالوج كامل من products.json ----------
function parseShopify(json, base) {
  let d; try { d = JSON.parse(json); } catch (e) { return []; }
  const out = (d.products || []).map(p => {
    const vs = (p.variants || []).filter(v => v.available !== false);
    if (!vs.length) return null;
    const price = Math.min(...vs.map(v => +v.price).filter(x => x > 0));
    const cheap = vs.find(v => +v.price === price) || {};
    const size = /\d\s*(ml|مل|g|gm|gr|جرام|غرام|tola|توله|تولة|kg|كيلو)\b/i.test(cheap.title || '') && !/\d\s*(ml|مل|g|gm|tola|توله)\b/i.test(p.title || '') ? ' ' + String(cheap.title).trim() : '';
    const img = (p.images && p.images[0] && p.images[0].src) || '';
    if (!(price > 0) || !isFinite(price) || !img) return null;
    const tags = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
    const cmp = Math.max(0, ...vs.map(v => +v.compare_at_price || 0));
    return { t: (String(p.title || '').trim() + size).trim(), p: price, o: cmp > price * 1.02 ? cmp : 0, i: img, u: base + '/products/' + p.handle, b: String(p.vendor || ''), ty: String(p.product_type || ''), tags };
  }).filter(Boolean);
  out.raw = (d.products || []).length;  // عدد المنتجات في الصفحة قبل حذف غير المتوفر
  return out;
}
async function dermazone() {
  const B = 'https://www.dermazonestore.com', all = [];
  for (let page = 1; page <= 60; page++) {
    const items = parseShopify(await get(`${B}/products.json?limit=250&page=${page}`), B);
    if (!items.raw) break;
    all.push(...items); console.log('dermazone page', page, all.length);
    await sleep(600);
  }
  return { updated: new Date().toISOString(), cur: 'SAR', store: B,
    brands: [...new Set(all.map(x => x.b.toLowerCase()).filter(Boolean))],
    items: all.map(x => [x.t, x.p, x.i, x.u, (x.b + ' | ' + x.ty + ' | ' + x.tags).toLowerCase()]) };
}

// ---------- محامص القهوة العمانية ----------
const ent = v => fixText(String(v || '').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' '));
// أمان: روابط المنتج والصورة لازم تكون https (لا javascript: ولا علامات تكسر HTML)
const okUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || ''));
const pack = (x, extra) => [String(x.t).replace(/[<>]/g, ' '), x.p, okUrl(x.i) ? x.i : '', x.u, x.tags.toLowerCase(), x.o || 0, x.r || 0, x.n || 0];

// Copper Roastery (مسقط): ووكومرس — واجهة المتجر العامة /wp-json/wc/store/v1/products
function parseWoo(list, store = 'copper roastery', skip = /cafe beverages/i) {
  const out = [];
  for (const p of list || []) {
    const cats = (p.categories || []).map(c => ent(c.name));
    if (!p.is_in_stock || cats.some(c => skip.test(c))) continue;
    if (/^(shipping insurance|gift card|e-?gift)/i.test(p.name || '')) continue;  // تأمين الشحن وبطاقات الهدايا مو منتجات  // مشروبات الكوفي (داخل المقهى) مو للشحن
    const pr = p.prices || {}, mu = Math.pow(10, pr.currency_minor_unit ?? 3);
    const price = (+pr.price || +(pr.price_range && pr.price_range.min_amount) || 0) / mu, reg = (+pr.regular_price || 0) / mu;
    if (!(price > 0) || !p.permalink) continue;
    const img = p.images && p.images[0] ? (p.images[0].thumbnail || p.images[0].src) : '';
    out.push({ t: ent(p.name), p: Math.round(price * 1000) / 1000, o: reg > price * 1.02 ? Math.round(reg * 1000) / 1000 : 0, i: img, u: p.permalink,
      r: +p.average_rating > 0 && p.review_count > 0 ? +p.average_rating : 0, n: p.review_count || 0,
      tags: [store, ...cats, ...(p.tags || []).map(t => ent(t.name)), ent(p.short_description || p.description || '').slice(0, 400)].filter(Boolean).join(' | ') });
  }
  return out;
}
// متجر ووكومرس (واجهة المتجر العامة): Copper Roastery و سوق البن
async function wooStore(B, store, skip, cur = 'OMR') {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const txt = await get(`${B}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    let d = null; try { d = JSON.parse(txt); } catch (e) { /* */ }
    if (!Array.isArray(d) || !d.length) break;
    all.push(...parseWoo(d, store, skip)); console.log(store, 'page', page, all.length);
    if (d.length < 100) break;
    await sleep(800);
  }
  return { updated: new Date().toISOString(), cur, store: B, brands: [], items: all.map(pack) };
}
const copper = () => wooStore('https://copperroastery.com', 'copper roastery', /cafe beverages/i);
// سوق البن (مسقط): محاصيل محامص سعودية وعالمية وأدوات — نشيل المشروبات الباردة والتغليفات
const souqalbon = () => wooStore('https://souqalbon.com', 'souq albon | سوق البن', /المشروبات الباردة|تغليفات/);

// بن القصاب (مسقط): أودو — صفحة المتجر وصفحات الأقسام (القسم يصير وسم للمنتج)
const BQ_CATS = { 'omani-coffee-1': 'omani coffee | arabic coffee | قهوة عمانية', 'turkish-coffee-6': 'turkish coffee | قهوة تركية', 'espresso-and-filter-coffee-2': 'specialty coffee beans | قهوة مختصة',
  'espresso-and-filter-coffee-brewing-classic-coffee-8': 'filter coffee | classic | قهوة مقطرة', 'espresso-and-filter-coffee-brewing-fruit-coffee-9': 'filter coffee | fruity | قهوة مقطرة',
  'espresso-and-filter-coffee-espresso-classic-coffee-10': 'espresso | classic | اسبريسو', 'espresso-and-filter-coffee-espresso-fruit-coffee-11': 'espresso | fruity | اسبريسو',
  'drip-boxes-5': 'drip coffee bags | قهوة مقطرة | دريب', 'gift-boxes-4': 'coffee gift box | بوكس هدية', 'offers-7': 'offers' };
function parseOdoo(html, base, store = 'bun al qassab | بن القصاب | coffee | قهوة') {
  const out = [];
  for (const c of String(html || '').match(/<form[^>]*class="[^"]*oe_product_cart[^"]*"[\s\S]*?<\/form>/g) || []) {
    const name = c.match(/itemprop="name"[^>]*>([\s\S]*?)<\/a>/) || c.match(/o_wsale_products_item_title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const prices = [...c.matchAll(/oe_currency_value">([^<]+)</g)].map(m => +m[1].replace(/,/g, '')).filter(n => n > 0);
    const href = c.match(/href="((?:\/[a-z]{2}(?:_[A-Z]{2})?)?\/shop\/[^"#?]+)[^"]*"/), img = c.match(/<img[^>]+src="([^"]+)"/);
    if (!name || !prices.length || !href) continue;
    const price = Math.min(...prices), orig = Math.max(...prices);
    out.push({ t: ent(name[1]).replace(/^\[[^\]]*\]\s*/, ''), p: price, o: orig > price * 1.02 ? orig : 0, u: base + encodeURI(decodeURI(href[1]).replace(/(\/shop\/)(?!category\/)[^/]+\/([^/]+-\d+)$/, '$1$2')), i: img ? (img[1].startsWith('http') ? img[1] : base + img[1]) : '', tags: store });
  }
  return out;
}
async function bunalqassab() {
  const B = 'https://www.bunalqassab.com', items = new Map(); // بدون www ما يفتح (من نوفمبر 2026)
  for (const c of [''].concat(Object.keys(BQ_CATS))) {
    const html = await get(B + (c ? '/shop/category/' + c : '/shop') + '?ppg=200');
    for (const it of parseOdoo(html, B)) { const x = items.get(it.u) || (items.set(it.u, it), it); if (c) x.tags += ' | ' + BQ_CATS[c]; }
    console.log('bunalqassab', c || 'all', items.size);
    await sleep(700);
  }
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: [...items.values()].map(pack) };
}

// ePanda (السيب): أودو — كل صفحات المتجر، وأقسامه (مطاحن، V60، محاصيل…) تصير وسوم
async function epanda() {
  const B = 'https://www.epandaom.com', items = new Map();
  for (let page = 1; page <= 15; page++) {
    const html = await get(`${B}/en/shop${page > 1 ? '/page/' + page : ''}?ppg=200`);
    const got = parseOdoo(html, B, 'epanda');
    let fresh = 0;
    for (const it of got) if (!items.has(it.u)) { items.set(it.u, it); fresh++; }
    console.log('epanda page', page, got.length, items.size);
    if (got.length < 200 || !fresh) break;
    await sleep(700);
  }
  const cats = [...new Set(locs(await get(B + '/sitemap.xml')).map(u => (u.match(/\/shop\/category\/([^/?#]+)$/) || [])[1]).filter(Boolean))].slice(0, 80);
  for (const c of cats) {
    const html = await get(`${B}/en/shop/category/${c}?ppg=200`);
    const crumbs = [...html.matchAll(/breadcrumb-item[^>]*>\s*(?:<a[^>]*>)?\s*<span[^>]*>([^<]+)<\/span>|breadcrumb-item[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)].map(m => ent(m[1] || m[2])).filter(n => n && !/^products$/i.test(n));
    const name = crumbs.slice(-2).join(' | ');
    if (name) for (const it of parseOdoo(html, B, 'epanda')) { const x = items.get(it.u); if (x && !x.tags.includes(name)) x.tags += ' | ' + name; }
    await sleep(500);
  }
  console.log('epanda categories', cats.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: [...items.values()].map(pack) };
}

// فوح (عُمان): شوبيفاي — سوق محامص عمانية وسعودية، الماركة = المحمصة
async function fooh() {
  const B = 'https://fooh.store', all = [];
  for (let page = 1; page <= 20; page++) {
    const items = parseShopify(await get(`${B}/products.json?limit=250&page=${page}`), B);
    if (!items.raw) break;
    all.push(...items.map(x => Object.assign(x, { tags: ['fooh | فوح', x.b, x.ty, x.tags].filter(Boolean).join(' | ') })));
    console.log('fooh page', page, all.length);
    await sleep(700);
  }
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}

// ---------- متاجر العطور العمانية ----------
// شوبيفاي: أمواج (دار عطور عمانية، أسعار موقعها العالمي بالدولار)، سويس أرابيان عمان، أصغر علي عمان، عمان لكشري، الحاجّي، بنك العود
async function shopifyStore(B, name, tags, cur = 'OMR', ownTags = true) {
  const all = [];
  // العينات المجانية وتغليف الهدايا وبطاقات التهنئة مو منتجات
  const SKIP = /complimentary|gift ?wrap|greeting card|تغليف|بطاقة تهنئة/i;
  for (let page = 1; page <= 20; page++) {
    const items = parseShopify(await get(`${B}/products.json?limit=250&page=${page}`), B);
    if (!items.raw) break;
    // وسوم أمواج فيها أسماء الدول والعملات («africa dollar $»): نكتفي بنوع المنتج
    all.push(...items.filter(x => !SKIP.test(x.t + ' ' + x.ty)).map(x => Object.assign(x, { tags: [tags, /vendor-unknown/.test(x.b) ? '' : x.b, x.ty, ownTags ? x.tags : ''].filter(Boolean).join(' | ') })));
    console.log(name, 'page', page, all.length);
    await sleep(700);
  }
  return { updated: new Date().toISOString(), cur, store: B, brands: [], items: all.map(pack) };
}
const amouage = () => shopifyStore('https://amouage.com', 'amouage', 'amouage | أمواج', 'USD', false);
const swissarabian = () => shopifyStore('https://om.swissarabian.com', 'swissarabian', 'swiss arabian | سويس أرابيان');
const asgharali = () => shopifyStore('https://om.asgharali.com', 'asgharali', 'asgharali | أصغر علي');
const omanluxury = () => shopifyStore('https://omanluxury.store', 'omanluxury', 'oman luxury | عمان لكشري');
const alhajis = () => shopifyStore('https://alhajisoman.com', 'alhajis', 'al hajis | الحاجي');
const oudbank = () => shopifyStore('https://oudbank.com', 'oudbank', 'the oud bank | بنك العود');
// ووكومرس: بوليفارد للعطور، عالم العود
const boulevard = () => wooStore('https://boulevardperfumes.com', 'boulevard perfumes | بوليفارد', /^$/);
const oudworlds = () => wooStore('https://oudworlds.com', 'oud worlds | عالم العود', /^$/);
const artal = () => wooStore('https://artalofficial.com', 'artal | أرتال', /^$/);
// نوادر العود (شوبيفاي، أسعارهم بالدرهم الإماراتي) والخنجر للعطور (أودو، بالريال العماني)
const nawader = () => shopifyStore('https://nwaderoud.com', 'nawader', 'nawader oud | نوادر العود', 'AED');
// متاجر Admitad العالمية (انقبلنا فيها): أوبنهاغن (حوامل جيتار وتصميم، شوبيفاي بالدولار) ووودستك (ألعاب طاولة خشب، ووكومرس بالدولار)
const openhagen = () => shopifyStore('https://openhagen.com', 'openhagen', 'openhagen | guitar wall mount | ukulele | speaker | home decor design | حامل جيتار | ديكور', 'USD');
const woodestic = () => wooStore('https://woodestic.com', 'woodestic | wooden board games | wooden table games | game | crokinole | billiards | ألعاب طاولة خشب | لعبة طاولة | كروكينول', /shipping insurance|gift card/i, 'USD');
const alkhanjar = () => odooPaged('https://www.alkhanjar.om', 'alkhanjar', 'al khanjar | الخنجر للعطور', 30);
// سلة: واجهة المتجر العامة (api.salla.dev) برقم المتجر، 15 منتج في الصفحة
async function sallaApi(storeId, B, name, tags) {
  const all = [];
  let url = 'https://api.salla.dev/store/v1/products?per_page=50';
  for (let i = 0; i < 120 && url; i++) {
    let d; try { d = JSON.parse(await get(url, 3, { 'Store-Identifier': storeId, currency: 'OMR', 'accept-language': 'ar', accept: 'application/json' })); } catch (e) { break; }
    for (const x of (d && d.data) || []) {
      const price = +x.price;
      if (!x.is_available || x.currency !== 'OMR' || !(price > 0)) continue;
      all.push({ t: fixText(x.name), p: price, o: +x.regular_price > price * 1.02 ? +x.regular_price : 0, i: (x.image && x.image.url) || '', u: x.url,
        r: (x.rating && +x.rating.stars) || 0, n: (x.rating && +x.rating.count) || 0, tags: [tags, x.category && x.category.name, x.brand && x.brand.name].filter(Boolean).map(fixText).join(' | ') });
    }
    url = d && d.cursor && d.cursor.next;
    await sleep(400);
  }
  // أسعار وهمية (عبوة فاضية بـ1000 ريال): نشيل اللي سعره أكثر من 10 أضعاف وسيط المتجر
  const ps = all.map(x => x.p).sort((a, b) => a - b), med = ps[ps.length >> 1] || 0;
  const ok = all.filter(x => !med || x.p <= med * 10);
  console.log(name, all.length, 'kept', ok.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: ok.map(pack) };
}
const ibraq = () => sallaApi('618083196', 'https://oman.ibraqperfumes.com', 'ibraq', 'ibraq | إبراق');
// الماجد للعود: متجر عمان جزء من متجر عالمي (الواجهة العامة ترجع دولار)، فنقرأ صفحات المنتجات العربية من خريطة الموقع
async function almajed() {
  const B = 'https://om.almajed4oud.com';
  const urls = [...new Set(locs(await get(B + '/sitemap-2.xml')).concat(locs(await get(B + '/sitemap-1.xml'))).filter(u => /\/ar\/[^/]+\/p\d+$/.test(u)))].slice(0, 500);
  const all = [];
  for (const u of urls) { const it = parseLdProduct(await get(u), u, 'al majed oud | الماجد للعود'); if (it) all.push(it); await sleep(250); }
  console.log('almajed', urls.length, all.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}
// زد: ريدان (روابط المنتجات من خريطة الموقع، والسعر بالريال العماني من نسخة /ar-om/)
async function raydan() {
  const B = 'https://raydanuae.com';
  // زد يعرض «هذا المتجر غير متاح» لما المتجر يتقفل: نشيله من قارِن على طول (روابطه ما تفتح)
  const home = await fetch(B + '/ar-om/', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) }).then(r => r.text()).catch(() => '');
  if (/هذا المتجر غير متاح|store is (not|un)available/i.test(home)) { const e = new Error('store unavailable (closed on Zid)'); e.gone = true; throw e; }
  const urls = [...new Set(locs(await get(B + '/sitemap_products.xml')).filter(u => /\/products\/[^/]+$/.test(u)))].slice(0, 400)
    .map(u => u.replace(/^https:\/\/raydanuae\.com\/(ar-om\/|ar\/|en\/)?/, B + '/ar-om/'));
  const all = [];
  for (const u of urls) { const it = parseLdProduct(await get(u), u, 'raydan | ريدان'); if (it) all.push(it); await sleep(300); }
  console.log('raydan', urls.length, all.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}

// متاجر أودو كبيرة بصفحات (محاصيل البن، مثلث): كل الصفحات، والأقسام من خريطة الموقع
// (اسم القسم مكتوب في رابطه: «ادوات-القهوة-المقطرة-المطاحن-23») فيصير وسم للمنتج
async function odooPaged(B, name, tags, maxPages = 40) {
  const items = new Map();
  const pages = async (path, tag) => {
    for (let page = 1; page <= maxPages; page++) {
      const got = parseOdoo(await get(`${B}${path}${page > 1 ? '/page/' + page : ''}`), B, tags);
      let fresh = 0;
      for (const it of got) {
        const x = items.get(it.u);
        if (!x) { if (!tag) { items.set(it.u, it); fresh++; } }
        else if (tag && !x.tags.includes(tag)) { x.tags += ' | ' + tag; fresh++; }
      }
      if (got.length < 10 || !fresh) break;
      await sleep(600);
    }
  };
  await pages('/shop', '');
  const cats = [...new Set(locs(await get(B + '/sitemap.xml')).map(u => (u.match(/\/shop\/category\/([^/?#]+)$/) || [])[1]).filter(Boolean))].slice(0, 90);
  for (const c of cats) {
    const tag = decodeURIComponent(c).replace(/-\d+$/, '').replace(/-/g, ' ');
    await pages('/shop/category/' + c, tag);
  }
  console.log(name, items.size, 'categories', cats.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: [...items.values()].map(pack) };
}
const mahaseel = () => odooPaged('https://mahaseelalbon.com', 'mahaseel', 'mahaseel albon');
const muthalath = () => odooPaged('https://www.muthalathstore.com', 'muthalath', 'muthalath | مثلث');

// Barista Oman (منصة كشك): خريطة المنتجات، وكل صفحة منتج فيها JSON-LD بالسعر والتوفر
async function barista() {
  const B = 'https://barista-oman.kushk.om';
  const urls = [...new Set(locs(await get(B + '/sitemap-products.xml')).filter(u => /\/products\/[^/]+$/.test(u)))].slice(0, 400);
  const all = [];
  for (const u of urls) { const it = parseLdProduct(await get(u), u, 'barista oman | باريستا عمان'); if (it) all.push(it); await sleep(300); }
  console.log('barista', urls.length, all.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}

// محامص أودو صغيرة (صفحة متجر وحدة): رواسي و سورا
async function odooShop(B, name, tags) {
  const items = parseOdoo(await get(B + '/shop?ppg=200'), B, tags);
  console.log(name, items.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: items.map(pack) };
}
const rawasi = () => odooShop('https://www.rawasiom.com', 'rawasi', 'rawasi | رواسي | specialty coffee beans | قهوة مختصة | محاصيل');
const sura = () => odooShop('https://www.suraroastery.om', 'sura', 'sura roastery | سورا | specialty coffee beans | قهوة مختصة | محاصيل');

// Yield Roastery (عُمان): متجر Kyte — صفحة كل منتج فيها الاسم والقسم والنكهات والسعر
function parseKyte(html, url) {
  const meta = n => { const m = html.match(new RegExp('<meta[^>]+(?:property|name)="' + n + '"[^>]+content="([^"]*)"')); return m ? ent(m[1]) : ''; };
  const t = meta('og:title').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
  const sp = html.match(/\\?"salePrice\\?":(\d+(?:\.\d+)?)/), promo = html.match(/\\?"salePromotionalPrice\\?":(\d+(?:\.\d+)?)/);
  if (!t || !sp) return null;
  const reg = +sp[1], price = promo && +promo[1] > 0 && +promo[1] < reg ? +promo[1] : reg;
  if (!(price > 0)) return null;
  return { t, p: price, o: price < reg ? reg : 0, i: meta('og:image'), u: url, tags: ['yield | ييلد', meta('category'), meta('description').slice(0, 160), 'specialty coffee beans | قهوة مختصة'].filter(Boolean).join(' | ') };
}
async function yieldOm() {
  const B = 'https://yield-oman.kyte.site';
  const urls = [...new Set(locs(await get(B + '/sitemap.xml')).filter(u => /\/p\/[^/]+\/[^/]+$/.test(u)))].slice(0, 200);
  const all = [];
  for (const u of urls) { const it = parseKyte(await get(u), u); if (it) all.push(it); await sleep(300); }
  console.log('yield', urls.length, all.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}

// Spirit Hub Cafe (مسقط): صفحات المنتجات فيها JSON-LD (الاسم، السعر، التوفر، والتقييم الحقيقي)
function parseLdProduct(html, url, store = 'spirit hub') {
  for (const m of String(html || '').matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch (e) { continue; }
    for (const x of [].concat(d, d && d['@graph'] || [])) {
      if (!x || x['@type'] !== 'Product') continue;
      const of = [].concat(x.offers || [])[0] || {};
      const price = +(of.price || of.lowPrice || 0);
      if (!(price > 0) || (of.availability && !/InStock|LimitedAvailability|PreOrder/i.test(of.availability))) return null;
      const ar = x.aggregateRating || {};
      return { t: ent(x.name), p: price, o: 0, i: [].concat(x.image || [])[0] || '', u: url, r: +ar.ratingValue || 0, n: +ar.reviewCount || +ar.ratingCount || 0,
        tags: [store, ent(x.description || '').slice(0, 400), x.category ? ent(x.category) : ''].filter(Boolean).join(' | ') };
    }
  }
  return null;
}
async function spirithub() {
  const B = 'https://www.spirithubcafe.com';
  const urls = [...new Set(locs(await get(B + '/sitemap.xml')).filter(u => /\/om\/(shop\/)?products?\/[^/]+$/.test(u)))].slice(0, 400);
  console.log('spirithub urls', urls.length);
  const all = [];
  for (const u of urls) {
    const it = parseLdProduct(await get(u), u);
    if (it) all.push(it);
    await sleep(300);
  }
  console.log('spirithub items', all.length);
  return { updated: new Date().toISOString(), cur: 'OMR', store: B, brands: [], items: all.map(pack) };
}

module.exports = { parseVListing, parseShopify, parseWoo, parseOdoo, parseLdProduct, parseKyte };
if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const index = {};
  // كلمات أسماء المحاصيل والمحامص في كل متجر قهوة (عشان بحث «أدهم» أو «دبليو» يوصل للمتجر الصحيح)
  const COFFEE = new Set(['copper', 'bunalqassab', 'spirithub', 'souqalbon', 'epanda', 'rawasi', 'yield', 'sura', 'fooh', 'mahaseel', 'muthalath', 'barista',
    'amouage', 'swissarabian', 'asgharali', 'omanluxury', 'alhajis', 'oudbank', 'boulevard', 'oudworlds', 'raydan', 'ibraq', 'almajed', 'artal', 'nawader', 'alkhanjar']);
  const STOP = new Set(['coffee', 'قهوه', 'جرام', 'غرام', 'gram', 'grams', 'محمصه', 'roastery', 'roasters', 'with', 'and', 'the', 'for', 'من', 'مع', 'حصري', 'لمحاصيل', 'البن', 'الحجم', 'حبه', 'pcs', 'box', 'بوكس']);
  const nrm = t => String(t).toLowerCase().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/چ/g, 'ج').replace(/ڤ/g, 'ف').replace(/[گک]/g, 'ك').replace(/ی/g, 'ي');
  const namesOf = items => [...new Set(items.flatMap(x => nrm(x[0] + ' ' + String(x[4]).split(' | ').filter(t => /محمص|roaster/i.test(t)).join(' '))
    .split(/[^a-z0-9\u0600-\u06ff]+/).map(w => w.replace(/^(ال|لل|بال|وال)(?=...)/, '')).filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w))))].slice(0, 3000);
  const STATUS = {};
  const MIN = { bunalqassab: 8, spirithub: 10, rawasi: 5, yield: 5, sura: 5, fooh: 5, amouage: 10, oudbank: 10, omanluxury: 10, alhajis: 10, raydan: 10, ibraq: 10, almajed: 10, artal: 3, nawader: 10, alkhanjar: 10, openhagen: 10, woodestic: 10 };
  for (const [name, fn] of [['vperfumes', vperfumes], ['dermazone', dermazone], ['copper', copper], ['bunalqassab', bunalqassab], ['spirithub', spirithub], ['souqalbon', souqalbon], ['epanda', epanda], ['rawasi', rawasi], ['yield', yieldOm], ['sura', sura], ['fooh', fooh], ['mahaseel', mahaseel], ['muthalath', muthalath], ['barista', barista],
    ['amouage', amouage], ['swissarabian', swissarabian], ['asgharali', asgharali], ['omanluxury', omanluxury], ['alhajis', alhajis], ['oudbank', oudbank], ['boulevard', boulevard], ['oudworlds', oudworlds], ['raydan', raydan], ['ibraq', ibraq], ['almajed', almajed], ['artal', artal], ['nawader', nawader], ['alkhanjar', alkhanjar], ['openhagen', openhagen], ['woodestic', woodestic]]) {
    // ONLY=amouage,oudbank: نبني متاجر معيّنة بس (للتجربة)
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue;
    try {
      const data = await fn();
      data.items = data.items.filter(r => okUrl(r[3]));   // أمان: منتج رابطه مو https ما ينزل
      if (COFFEE.has(name)) data.names = namesOf(data.items);
      if (data.items.length < (MIN[name] || 20)) throw new Error('too few items: ' + data.items.length);
      fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data));
      console.log(name, 'items', data.items.length, 'size', fs.statSync(path.join(OUT, name + '.json')).size);
      STATUS[name] = { ok: true, n: data.items.length };
    } catch (e) {
      // فشل اليوم: نخلي ملف أمس إذا عمره ٣ أيام أو أقل. أقدم من كذا (أو المتجر مقفل) نشيله، عشان ما نعرض أسعار قديمة وروابط خربانة
      const fp = path.join(OUT, name + '.json');
      let old = null; try { old = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (x) { /* ما فيه ملف قديم */ }
      const age = old ? (Date.now() - Date.parse(old.updated)) / 864e5 : Infinity;
      if (old && (e.gone || !(age <= 3))) { fs.unlinkSync(fp); console.log(name, 'FAILED', e.message, `(removed: last good list was ${age.toFixed(1)} days old)`); }
      else console.log(name, 'FAILED', e.message, old ? `(keeping the list from ${age.toFixed(1)} days ago)` : '(no list)');
      STATUS[name] = { ok: false, msg: String(e.message).slice(0, 160), gone: !!e.gone, removed: !!(old && (e.gone || !(age <= 3))), age: isFinite(age) ? +age.toFixed(1) : null };
    }
    try { const d = JSON.parse(fs.readFileSync(path.join(OUT, name + '.json'), 'utf8')); index[name] = { updated: d.updated, n: d.items.length, brands: d.brands, ...(d.names ? { names: d.names } : {}) }; } catch (e) { /* ما في ملف */ }
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  // حالة كل متجر في هالتشغيل (لصفحة الأدمن)، برا مجلد الموقع
  try { fs.writeFileSync(process.env.STATUS_FILE || '/tmp/qarin_status.json', JSON.stringify({ at: new Date().toISOString(), stores: STATUS })); } catch (e) { /* عادي */ }
})();
