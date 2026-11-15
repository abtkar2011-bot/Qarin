// فحص محاصيل البن: المنصة، robots، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const urls = ['https://barista-oman.kushk.om/robots.txt', 'https://barista-oman.kushk.om/', 'https://barista-oman.kushk.om/sitemap.xml', 'https://barista-oman.kushk.om/products', 'https://barista-oman.kushk.om/products.json?limit=3', 'https://barista-oman.kushk.om/api/products'];
const mk = t => ['cdn.shopify', 'salla', 'zid.store', 'woocommerce', 'wp-content', 'wix', 'odoo', 'Odoo', '__NEXT_DATA__', 'kyte', 'kushk', '__NUXT__', 'window.__INITIAL', 'OMR', 'ر.ع', 'ld+json', 'oe_product_cart'].filter(m => t.includes(m));
(async () => {
  const log = [];
  for (const u of urls) {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 25000); const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' }, signal: ctl.signal }); const t = await r.text();
      fs.writeFileSync(path.join(OUT, u.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80) + '.txt'), t.slice(0, 4000000));
      log.push(`${r.status} ${u} -> ${r.url} len=${t.length} carts=${(t.match(/oe_product_cart/g) || []).length} [${mk(t).join(',')}]`);
    } catch (e) { log.push(`ERR ${u} ${e.message}`); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
