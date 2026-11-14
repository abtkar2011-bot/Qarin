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
  await get('v_robots.txt', V + '/robots.txt');
  await get('v_men.html', V + '/om-en/category/perfumes-for-men');
  await get('v_search1.html', V + '/om-en/search?q=oud');
  await get('v_search2.html', V + '/om-en/search?query=oud');
  await get('v_products.json', V + '/products.json?limit=5');
  await get('v_sitemap.xml', V + '/sitemap.xml');
  // روابط الأفلييت: نشوف وين توصل (الدومين الحقيقي) بدون ما نتبعها كاملة
  await get('d_aff.txt', 'https://bjpql.com/g/03how5od0x683a5815dd238e05a71e/', { manual: true });
  await get('w_aff.txt', 'https://naiawork.com/g/do86ucnzhx683a5815ddc586cc6aee/', { manual: true });
  await get('v_aff.txt', 'https://wbbsv.com/g/ax1gp3o9dz683a5815ddbe59cac899/', { manual: true });
  fs.writeFileSync(path.join(OUT, 'log.tsv'), log.join('\n'));
  console.log(log.join('\n'));
})();
