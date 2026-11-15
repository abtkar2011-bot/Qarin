// فحص رواسي و Yield: المنصة، robots، وعينة منتجات
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const BUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const urls = ['https://www.rawasiom.com/robots.txt', 'https://www.rawasiom.com/ar', 'https://www.rawasiom.com/products.json?limit=3', 'https://www.rawasiom.com/wp-json/wc/store/v1/products?per_page=3',
  'https://www.rawasiom.com/sitemap.xml', 'https://www.rawasiom.com/ar/shop?ppg=200', 'https://www.rawasiom.com/shop?ppg=200', 'https://linktr.ee/yieldoman'];
const mk = t => ['cdn.shopify', 'salla', 'zid.store', 'zidcdn', 'woocommerce', 'wp-content', 'wix', 'magento', 'expandcart', 'odoo', 'Odoo', '__NEXT_DATA__', 'nuxt', 'OMR', 'ر.ع', 'ld+json', 'oe_product_cart'].filter(m => t.includes(m));
async function probe(u, ua) {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(u, { headers: { 'user-agent': ua || UA, 'accept-language': 'ar,en' }, signal: ctl.signal }); clearTimeout(tm);
    const t = await r.text();
    const f = u.replace(/^https:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80);
    fs.writeFileSync(path.join(OUT, f + '.txt'), t.slice(0, 4000000));
    return { line: `${r.status} ${u} -> ${r.url} len=${t.length} carts=${(t.match(/oe_product_cart/g) || []).length} [${mk(t).join(',')}]`, t };
  } catch (e) { return { line: `ERR ${u} ${e.message}`, t: '' }; }
}
(async () => {
  const log = [];
  for (const u of urls) { const { line, t } = await probe(u, /linktr/.test(u) ? BUA : UA); log.push(line); console.log(line);
    if (/linktr/.test(u)) {
      const links = [...new Set([...t.matchAll(/"url":"(https?:[^"]+)"/g)].map(m => m[1].replace(/\\u002F/g, '/')))].filter(x => !/linktr\.ee|linktree/.test(x));
      log.push('LINKS ' + links.join(' '));
      for (const l of links.filter(x => !/instagram|tiktok|wa\.me|whatsapp|facebook|twitter|x\.com|snapchat|youtube|google\.com\/maps|maps\.app/.test(x)).slice(0, 4)) {
        const base = new URL(l).origin;
        for (const p of [l, base + '/robots.txt', base + '/products.json?limit=3', base + '/wp-json/wc/store/v1/products?per_page=3', base + '/sitemap.xml']) { const x = await probe(p); log.push(x.line); }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
