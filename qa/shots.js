// صفحة منتج في متجر Yield (Kyte)
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
(async () => {
  const log = [];
  for (const u of ['https://yield-oman.kyte.site/p/colombia-tulima/175921549952915dcfd-Zrnd', 'https://yield-oman.kyte.site/p/brazil-espresso-classic/1759343257980-Zrndv']) {
    const r = await fetch(u, { headers: { 'user-agent': UA } }); const t = await r.text();
    fs.writeFileSync(path.join(OUT, 'yield_p' + log.length + '.html'), t);
    log.push(`${r.status} ${u} len=${t.length} product_ld=${/\\?"@type\\?":\\?"Product/.test(t)} price=${(t.match(/salePrice|"price"|\\"price\\"/g) || []).length}`);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
})();
