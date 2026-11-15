// temp: probe Raydan store + rebuild perfume feeds
const { spawnSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const log = [];
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
  for (const u of ['https://raydanuae.com/ar-om/', 'https://raydanuae.com/products.json?limit=3', 'https://raydanuae.com/ar-om/products.json?limit=3', 'https://raydanuae.com/wp-json/wc/store/v1/products?per_page=3', 'https://raydanuae.com/sitemap.xml', 'https://raydanuae.com/robots.txt']) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); const t = await r.text();
      const hints = ['shopify', 'woocommerce', 'wp-content', 'salla', 'zid.store', 'magento', 'odoo', 'OMR', 'AED', 'ر.ع', 'ld+json', 'next/static', '__NEXT_DATA__', 'nuxt'].filter(h => t.includes(h));
      log.push(`${r.status} ${u} -> ${r.url} len=${t.length} [${hints}]`);
      fs.writeFileSync(OUT + '/raydan_' + log.length + '.txt', t.slice(0, 400000));
    } catch (e) { log.push('ERR ' + u + ' ' + e.message); }
  }
  fs.writeFileSync(OUT + '/probe.txt', log.join('\n')); console.log(log.join('\n'));
  const r = spawnSync('node', ['tools/partners/build.js', OUT], { stdio: 'inherit', env: Object.assign({}, process.env, { ONLY: 'amouage,omanluxury,swissarabian' }), timeout: 15 * 60 * 1000 });
  console.log('exit', r.status);
})();
