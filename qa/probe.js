const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
(async () => {
  const log = [];
  for (const [f, u, lang] of [['shop.html', 'https://bunalqassab.com/shop?ppg=200', 'en'], ['shop_ar.html', 'https://www.bunalqassab.com/ar/shop?ppg=200', 'ar'], ['shopnew.html', 'https://www.bunalqassab.com/ar/shop-new', 'ar'], ['cat1.html', 'https://bunalqassab.com/shop/category/omani-coffee-1?ppg=200', 'en']]) {
    try { const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': lang }, signal: AbortSignal.timeout(30000) }); const t = await r.text(); fs.writeFileSync(OUT + '/' + f, t); log.push([f, r.status, r.url, t.length].join(' ')); }
    catch (e) { log.push(f + ' ERR ' + e.message); }
  }
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
})();
