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
  await get('v_feed_en.xml', V + '/api/v1/w/admin/auth/export-feed?type=google&lang=en');
  await get('v_om_sitemap.xml', V + '/om-en/sitemap.xml');
  await get('v_oils.html', V + '/om-en/category/perfume-oils');
  await get('v_best.html', V + '/om-en/collection/best-sellers');
  await get('v_ar_men.html', V + '/om-ar/category/perfumes-for-men');
  await get('d_products.json', 'https://www.dermazonestore.com/products.json?limit=3');
  await get('d_suggest.json', 'https://www.dermazonestore.com/search/suggest.json?q=sunscreen&resources[type]=product');
  await get('d_home.html', 'https://www.dermazonestore.com/');
  await get('w_products.json', 'https://woodestic.com/products.json?limit=3');
  await get('w_suggest.json', 'https://woodestic.com/search/suggest.json?q=watch&resources[type]=product');
  await get('d_robots.txt', 'https://www.dermazonestore.com/robots.txt');
  await get('w_robots.txt', 'https://woodestic.com/robots.txt');
  fs.writeFileSync(path.join(OUT, 'log.tsv'), log.join('\n'));
  console.log(log.join('\n'));
})();
