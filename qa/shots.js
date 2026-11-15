// Barista Oman (Kushk): خريطة المنتجات وصفحتين منتج
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) }); return [r.status, await r.text()]; };
(async () => {
  const log = [];
  const [st, sm] = await get('https://barista-oman.kushk.om/sitemap-products.xml');
  fs.writeFileSync(path.join(OUT, 'kushk_products.xml'), sm);
  const locs = [...sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  log.push(`sitemap ${st} ${locs.length} ${locs.slice(0, 3).join(' ')}`);
  for (const [i, u] of locs.slice(0, 2).entries()) {
    const [s2, t] = await get(u); fs.writeFileSync(path.join(OUT, 'kushk_p' + i + '.html'), t);
    log.push(`${s2} ${u} len=${t.length} ld_product=${/"@type"\s*:\s*"Product"/.test(t)}`);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
