const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
(async () => {
  const B = 'https://www.bunalqassab.com';
  for (const p of ['/ar', '/shop', '/ar/shop', '/products.json?limit=5', '/wp-json/wc/store/products?per_page=3', '/api/products', '/sitemap.xml', '/robots.txt', '/en']) {
    try {
      const r = await fetch(B + p, { headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en' }, redirect: 'follow', signal: AbortSignal.timeout(25000) }); const t = await r.text();
      const sig = ['shopify', 'salla', 'zid.store', 'zid', 'woocommerce', 'odoo', 'wix', 'squarespace', 'next', 'nuxt', 'magento', 'expandcart', 'youcan', 'matjrah', 'webflow', 'framer'].filter(s => t.toLowerCase().includes(s));
      L('##', p, '→', r.status, r.url, 'len', t.length, '| title:', ((t.match(/<title[^>]*>([^<]{0,100})/i) || [])[1] || '').trim(), '| sig:', sig.join(','), '| server:', r.headers.get('server'), r.headers.get('x-powered-by') || '');
      if (/sitemap|robots|products|api|wp-json/.test(p)) L(t.slice(0, 1200));
      else { const links = [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => /product|shop|collection|categ|store|item/i.test(h)))].slice(0, 25); L('links:', links.join('  ')); L('scripts:', [...t.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).slice(0, 12).join('  ')); }
    } catch (e) { L('##', p, 'ERR', e.message); }
  }
})();
