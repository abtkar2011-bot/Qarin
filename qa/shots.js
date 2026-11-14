// فحص متاجر القهوة العمانية: المنصة، robots، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const sites = ['https://fooh.coffee', 'https://bunalqassab.com', 'https://www.bunalqassab.com', 'https://omancoffeestore.com', 'https://www.spirithubcafe.com', 'https://copperroastery.com',
  'https://souqalbun.com', 'https://www.souqalbun.com', 'https://souqalbun.om', 'https://soqalbun.com', 'https://souq-albun.com', 'https://souqalbunn.com', 'https://albun.om', 'https://bunoman.com'];
const paths = ['/robots.txt', '/', '/products.json?limit=3', '/wp-json/wc/store/v1/products?per_page=3', '/sitemap.xml'];
(async () => {
  const log = [];
  for (const s of sites) {
    for (const p of paths) {
      const u = s + p; let line;
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
        const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' }, redirect: 'follow', signal: ctl.signal }); clearTimeout(tm);
        const t = await r.text();
        const f = (s.replace(/^https:\/\//, '') + p).replace(/[^a-z0-9.]+/gi, '_').slice(0, 90);
        fs.writeFileSync(path.join(OUT, f + '.txt'), t.slice(0, 400000));
        const mk = ['cdn.shopify', 'Shopify.theme', 'salla', 'zid.store', 'zidcdn', 'woocommerce', 'wp-content', 'wix', 'squarespace', 'magento', 'expandcart', 'youcan', 'matjrah', 'OMR', 'ر.ع'].filter(m => t.includes(m));
        line = `${r.status} ${u} -> ${r.url} len=${t.length} [${mk.join(',')}]`;
      } catch (e) { line = `ERR ${u} ${e.message}`; }
      log.push(line); console.log(line);
    }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
})();
