// temp: probe Raydan (Zid), Al Majed, Ibraq
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const log = []; let n = 0;
async function get(u, save) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar' }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); const t = await r.text();
    const hints = ['shopify', 'woocommerce', 'wp-content', 'salla', 'zid', 'magento', 'odoo', 'OMR', 'AED', 'ر.ع', 'ld+json', '__NEXT_DATA__', 'nuxt', '"Product"', '"price"'].filter(h => t.includes(h));
    log.push(`${r.status} ${u} -> ${r.url} len=${t.length} [${hints}]`);
    if (save) fs.writeFileSync(OUT + '/' + save, t.slice(0, 600000));
    return t;
  } catch (e) { log.push('ERR ' + u + ' ' + e.message); return ''; }
}
(async () => {
  const sm = await get('https://raydanuae.com/sitemap_products.xml', 'r_sm.txt');
  const locs = [...sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  log.push('raydan products in sitemap: ' + locs.length + ' e.g. ' + locs.slice(0, 3).join(' '));
  if (locs[0]) { await get(locs[0], 'r_p1.txt'); const om = locs[0].replace('raydanuae.com/', 'raydanuae.com/ar-om/').replace('/ar-om/ar/', '/ar-om/').replace('/ar-om/en/', '/ar-om/'); await get(om, 'r_p1om.txt'); }
  for (const B of ['https://om.almajed4oud.com', 'https://oman.ibraqperfumes.com']) {
    const tag = B.includes('majed') ? 'm' : 'i';
    await get(B + '/ar', tag + '_home.txt');
    await get(B + '/products.json?limit=3', tag + '_pj.txt');
    await get(B + '/wp-json/wc/store/v1/products?per_page=3', tag + '_woo.txt');
    const s2 = await get(B + '/sitemap.xml', tag + '_sm.txt');
    const l2 = [...s2.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
    log.push(tag + ' sitemap locs: ' + l2.length + ' e.g. ' + l2.slice(0, 4).join(' '));
    await get(B + '/robots.txt', tag + '_robots.txt');
  }
  fs.writeFileSync(OUT + '/probe.txt', log.join('\n')); console.log(log.join('\n'));
})();
