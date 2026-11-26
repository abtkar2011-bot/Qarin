// probe: why 3 partner stores returned 0 items (bunalqassab, yield, raydan)
const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function show(u) {
  try { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en' }, redirect: 'follow' }); const t = await r.text();
    L('URL', u, '→', r.status, r.url, 'len', t.length, '| title:', (t.match(/<title[^>]*>([^<]*)/i) || [])[1] || '', '| products-ish:', (t.match(/oe_product|product_template|\/products\/|\/p\//g) || []).length);
    L('   head:', t.replace(/\s+/g, ' ').slice(0, 300)); return t;
  } catch (e) { L('URL', u, 'ERR', e.message); return ''; }
}
(async () => {
  await show('https://bunalqassab.com/shop?ppg=200'); await show('https://bunalqassab.com/'); await show('https://bunalqassab.com/sitemap.xml');
  const sm = await show('https://yield-oman.kyte.site/sitemap.xml'); L('yield /p/ links', (sm.match(/\/p\/[^<]+/g) || []).length, (sm.match(/<loc>[^<]+/g) || []).slice(0, 5).join(' '));
  await show('https://yield-oman.kyte.site/');
  const rs = await show('https://raydanuae.com/sitemap_products.xml'); L('raydan product locs', (rs.match(/<loc>[^<]+/g) || []).length, (rs.match(/<loc>[^<]+/g) || []).slice(0, 4).join(' '));
  await show('https://raydanuae.com/sitemap.xml'); await show('https://raydanuae.com/ar-om/');
  L('done');
})();
