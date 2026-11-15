// فحص سوق البن و Barista Oman و ePanda: المنصة، robots، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const urls = [
  'https://souqalbon.com/robots.txt', 'https://souqalbon.com/shop-2/', 'https://souqalbon.com/wp-json/wc/store/v1/products?per_page=100&page=1', 'https://souqalbon.com/products.json?limit=3', 'https://souqalbon.com/sitemap.xml', 'https://souqalbon.com/sitemap_index.xml',
  'https://baristaoman.com/robots.txt', 'https://baristaoman.com/', 'https://baristaoman.com/products.json?limit=3', 'https://baristaoman.com/wp-json/wc/store/v1/products?per_page=100&page=1', 'https://baristaoman.com/sitemap.xml',
  'https://www.epandaom.com/robots.txt', 'https://www.epandaom.com/en', 'https://www.epandaom.com/products.json?limit=3', 'https://www.epandaom.com/wp-json/wc/store/v1/products?per_page=3', 'https://www.epandaom.com/sitemap.xml', 'https://www.epandaom.com/en/sitemap.xml',
];
(async () => {
  const log = [];
  for (const u of urls) {
    let line;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' }, signal: ctl.signal }); clearTimeout(tm);
      const t = await r.text();
      const f = u.replace(/^https:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80);
      fs.writeFileSync(path.join(OUT, f + '.txt'), t.slice(0, 3000000));
      const mk = ['cdn.shopify', 'salla', 'zid.store', 'zidcdn', 'woocommerce', 'wp-content', 'wix', 'magento', 'expandcart', 'youcan', 'odoo', '__NEXT_DATA__', 'nuxt', 'OMR', 'ر.ع', 'ld+json'].filter(m => t.includes(m));
      line = `${r.status} ${u} -> ${r.url} len=${t.length} total=${r.headers.get('x-wp-total')} [${mk.join(',')}]`;
    } catch (e) { line = `ERR ${u} ${e.message}`; }
    log.push(line); console.log(line);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
})();
