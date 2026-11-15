// فحص سورا: المنصة، robots، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const urls = ['https://www.suraroastery.om/robots.txt', 'https://www.suraroastery.om/ar', 'https://www.suraroastery.om/shop?ppg=200', 'https://www.suraroastery.om/ar/shop?ppg=200',
  'https://www.suraroastery.om/products.json?limit=3', 'https://www.suraroastery.om/wp-json/wc/store/v1/products?per_page=3', 'https://www.suraroastery.om/sitemap.xml'];
const mk = t => ['cdn.shopify', 'salla', 'zid.store', 'woocommerce', 'wp-content', 'wix', 'odoo', 'Odoo', '__NEXT_DATA__', 'kyte', 'OMR', 'ر.ع', 'ld+json', 'oe_product_cart'].filter(m => t.includes(m));
(async () => {
  const log = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' } }); const t = await r.text();
      fs.writeFileSync(path.join(OUT, u.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80) + '.txt'), t.slice(0, 4000000));
      log.push(`${r.status} ${u} -> ${r.url} len=${t.length} carts=${(t.match(/oe_product_cart/g) || []).length} [${mk(t).join(',')}]`);
    } catch (e) { log.push(`ERR ${u} ${e.message}`); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
