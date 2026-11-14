// استكشاف مؤقت: كيف نجيب منتجات المتاجر الشريكة (V Perfumes / DermaZone / Woodestic)
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const log = [];
async function get(name, url, opt = {}) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' }, redirect: opt.manual ? 'manual' : 'follow' });
    const t = await r.text();
    fs.writeFileSync(path.join(OUT, name), t.slice(0, 3_000_000));
    log.push(`${name}\t${r.status}\t${r.url}\t${r.headers.get('content-type')}\t${t.length}\t${r.headers.get('location') || ''}`);
  } catch (e) { log.push(`${name}\tERR\t${url}\t${e.message}`); }
}
(async () => {
  const V = 'https://www.vperfumes.com';
  await get('v_cats.xml', V + '/om-en/sitemaps/categories/0.xml');
  await get('v_cols.xml', V + '/om-en/sitemaps/collections/0.xml');
  await get('v_brands.xml', V + '/om-en/sitemaps/brands/0.xml');
  await get('v_prod0.xml', V + '/om-en/sitemaps/products/0.xml');
  await get('v_brandpage.html', V + '/om-en/brand/lattafa');
  await get('d_ship.html', 'https://www.dermazonestore.com/policies/shipping-policy');
  await get('d_ship2.html', 'https://www.dermazonestore.com/pages/shipping');
  await get('d_count.json', 'https://www.dermazonestore.com/products.json?limit=250&page=1');
  fs.writeFileSync(path.join(OUT, 'log.tsv'), log.join('\n'));
  console.log(log.join('\n'));
})();
