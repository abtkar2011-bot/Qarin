// يبني ملفات منتجات المتاجر الشريكة (Admitad) لقارِن: V Perfumes (عُمان) و DermaZone.
// node tools/partners/build.js <out-dir>
// الناتج: <out>/vperfumes.json و <out>/dermazone.json بشكل مضغوط:
//   { updated, cur, items: [[title, price, image, url, tags], ...], brands: [...] }
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'partners';
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/about.html)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } });
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
      out.push({ t: String(it.name).trim(), p: price, i: String(it.image || ''), u: String(it.url), b: (it.brand && it.brand.name) || '' });
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
  return (d.products || []).map(p => {
    const vs = (p.variants || []).filter(v => v.available !== false);
    if (!vs.length) return null;
    const price = Math.min(...vs.map(v => +v.price).filter(x => x > 0));
    const img = (p.images && p.images[0] && p.images[0].src) || '';
    if (!(price > 0) || !img) return null;
    const tags = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
    return { t: String(p.title || '').trim(), p: price, i: img, u: base + '/products/' + p.handle, b: String(p.vendor || ''), ty: String(p.product_type || ''), tags };
  }).filter(Boolean);
}
async function dermazone() {
  const B = 'https://www.dermazonestore.com', all = [];
  for (let page = 1; page <= 60; page++) {
    const items = parseShopify(await get(`${B}/products.json?limit=250&page=${page}`), B);
    if (!items.length) break;
    all.push(...items); console.log('dermazone page', page, all.length);
    await sleep(600);
  }
  return { updated: new Date().toISOString(), cur: 'SAR', store: B,
    brands: [...new Set(all.map(x => x.b.toLowerCase()).filter(Boolean))],
    items: all.map(x => [x.t, x.p, x.i, x.u, (x.b + ' | ' + x.ty + ' | ' + x.tags).toLowerCase()]) };
}

module.exports = { parseVListing, parseShopify };
if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const index = {};
  for (const [name, fn] of [['vperfumes', vperfumes], ['dermazone', dermazone]]) {
    try {
      const data = await fn();
      if (data.items.length < 20) throw new Error('too few items: ' + data.items.length);
      fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data));
      console.log(name, 'items', data.items.length, 'size', fs.statSync(path.join(OUT, name + '.json')).size);
    } catch (e) { console.log(name, 'FAILED', e.message, '(keeping the previous file if any)'); }
    try { const d = JSON.parse(fs.readFileSync(path.join(OUT, name + '.json'), 'utf8')); index[name] = { updated: d.updated, n: d.items.length, brands: d.brands }; } catch (e) { /* ما في ملف */ }
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
})();
