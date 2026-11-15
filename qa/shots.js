// temp: probe Al Widad + Artal, build Raydan/Ibraq/Al Majed
const { spawnSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const log = [];
async function get(u, save) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar' }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); const t = await r.text();
    const hints = ['shopify', 'woocommerce', 'wp-content', 'salla', 'zid', 'magento', 'odoo', 'OMR', 'AED', 'SAR', 'ر.ع', 'ld+json', '__NEXT_DATA__', '"Product"'].filter(h => t.includes(h));
    const sid = (t.match(/"store":\{"id":(\d+)/) || [])[1] || '';
    log.push(`${r.status} ${u} -> ${r.url} len=${t.length} [${hints}] ${sid ? 'store=' + sid : ''} :: ${t.slice(0, 160).replace(/\s+/g, ' ')}`);
    if (save) fs.writeFileSync(OUT + '/' + save, t.slice(0, 600000));
    return t;
  } catch (e) { log.push('ERR ' + u + ' ' + e.message); return ''; }
}
(async () => {
  for (const [B, tag] of [['https://nwaderoud.com', 'n'], ['https://www.alkhanjar.om', 'k']]) {
    await get(B + '/ar', tag + '_home.txt');
    await get(B + '/products.json?limit=3', tag + '_pj.txt');
    await get(B + '/wp-json/wc/store/v1/products?per_page=3', tag + '_woo.txt');
    await get(B + '/sitemap.xml', tag + '_sm.txt');
    await get(B + '/robots.txt', tag + '_robots.txt');
  }
  fs.writeFileSync(OUT + '/probe.txt', log.join('\n')); console.log(log.join('\n'));
  const r = spawnSync('node', ['tools/partners/build.js', OUT], { stdio: 'inherit', env: Object.assign({}, process.env, { ONLY: 'artal' }), timeout: 20 * 60 * 1000 });
  console.log('exit', r.status);
})();
