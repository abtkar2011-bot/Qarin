// فحص متاجر العطور العمانية: المنصة، robots، العملة، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const sites = ['https://amouage.com', 'https://om.swissarabian.com', 'https://shop.alharamainperfumes.com/oman', 'https://om.asgharali.com', 'https://omanperfumery.com', 'https://omanluxury.store',
  'https://alhajisoman.com', 'https://boulevardperfumes.com', 'https://oudbank.com', 'https://alturathoud.com', 'https://oudworlds.com', 'https://www.arabianoud.com', 'https://oman.mojperfumes.com', 'https://www.ajmalperfume.com'];
const paths = ['/robots.txt', '/', '/products.json?limit=3', '/wp-json/wc/store/v1/products?per_page=3', '/sitemap.xml'];
const mk = t => ['cdn.shopify', 'Shopify.currency', 'salla', 'zid.store', 'zidcdn', 'woocommerce', 'wp-content', 'magento', 'Magento', 'odoo', 'Odoo', 'kushk', '__NEXT_DATA__', 'OMR', 'ر.ع', 'ld+json', 'oe_product_cart', 'expandcart', 'salesforce', 'demandware'].filter(m => t.includes(m));
(async () => {
  const log = [];
  for (const s of sites) for (const p of paths) {
    const u = s + p;
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' }, signal: AbortSignal.timeout(20000) }); const t = await r.text();
      fs.writeFileSync(path.join(OUT, u.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80) + '.txt'), t.slice(0, 3000000));
      let extra = '';
      if (p.startsWith('/products.json')) { try { const j = JSON.parse(t); extra = ' products=' + (j.products || []).length + ' ' + ((j.products || [])[0] || {}).title; } catch (e) {} }
      if (p.startsWith('/wp-json')) { try { const j = JSON.parse(t); extra = ' woo=' + (Array.isArray(j) ? j.length + ' ' + (j[0] || {}).name + ' ' + ((j[0] || {}).prices || {}).currency_code : 'no'); } catch (e) {} }
      log.push(`${r.status} ${u} -> ${r.url} len=${t.length} [${mk(t).join(',')}]${extra}`);
    } catch (e) { log.push(`ERR ${u} ${e.message}`); }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
