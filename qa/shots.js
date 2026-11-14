// فحص ٢: صفحات المتجر عند بن القصاب و Spirit Hub، وعدد منتجات Copper
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const urls = ['https://bunalqassab.com/shop', 'https://bunalqassab.com/shop-new', 'https://bunalqassab.com/shop/cloud-' + encodeURIComponent('كلاود') + '-5590', 'https://bunalqassab.com/shipping-policy',
  'https://www.spirithubcafe.com/om/products/decaf-colombia-swiss-water-decaffeinated', 'https://www.spirithubcafe.com/assets/index-CO4zIFE4.js', 'https://www.spirithubcafe.com/om/delivery',
  'https://copperroastery.com/wp-json/wc/store/v1/products?per_page=100&page=1', 'https://copperroastery.com/shipping-policy/'];
(async () => {
  const log = [];
  for (const u of urls) {
    let line;
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' } });
      const t = await r.text();
      const f = u.replace(/^https:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80);
      fs.writeFileSync(path.join(OUT, f + '.txt'), t.slice(0, 3000000));
      line = `${r.status} ${u} len=${t.length} total=${r.headers.get('x-wp-total')} pages=${r.headers.get('x-wp-totalpages')}`;
    } catch (e) { line = `ERR ${u} ${e.message}`; }
    log.push(line); console.log(line);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
})();
