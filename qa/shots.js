// نفتح صفحة Linktree حق Yield في متصفح حقيقي ونطلع روابطها، ونفحص المتجر
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const mk = t => ['cdn.shopify', 'salla', 'zid.store', 'zidcdn', 'woocommerce', 'wp-content', 'wix', 'odoo', 'Odoo', '__NEXT_DATA__', 'OMR', 'ر.ع', 'ld+json', 'oe_product_cart', 'ecwid', 'squarespace', 'bigcommerce'].filter(m => t.includes(m));
async function probe(u) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' } }); const t = await r.text();
    fs.writeFileSync(path.join(OUT, u.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80) + '.txt'), t.slice(0, 4000000));
    return `${r.status} ${u} -> ${r.url} len=${t.length} carts=${(t.match(/oe_product_cart/g) || []).length} [${mk(t).join(',')}]`;
  } catch (e) { return `ERR ${u} ${e.message}`; }
}
(async () => {
  const log = [];
  const b = await chromium.launch(); const p = await b.newPage();
  try { await p.goto('https://linktr.ee/yieldoman', { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { log.push('goto ' + e.message); }
  const links = await p.$$eval('a[href]', as => as.map(a => (a.innerText || '').trim().replace(/\s+/g, ' ') + ' => ' + a.href)).catch(() => []);
  log.push(...links.map(l => 'LINK ' + l)); await p.screenshot({ path: path.join(OUT, 'yield.png') }).catch(() => {});
  await b.close();
  const sites = [...new Set(links.map(l => l.split(' => ')[1]).filter(h => h && /^https?:/.test(h) && !/linktr|linktree|instagram|tiktok|wa\.me|whatsapp|facebook|twitter|x\.com|snapchat|youtube|google|apple\.com|maps\.app|cookie|privacy|report/.test(h)).map(h => new URL(h).origin))].slice(0, 4);
  for (const o of sites) for (const s of ['/', '/robots.txt', '/products.json?limit=3', '/wp-json/wc/store/v1/products?per_page=3', '/shop?ppg=200', '/sitemap.xml']) log.push(await probe(o + s));
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
