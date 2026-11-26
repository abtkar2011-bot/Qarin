const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const get = async u => { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR', t: '' }; } };
(async () => {
  const P = JSON.parse((await get('https://openhagen.com/products.json?limit=250')).t).products;
  for (const p of P.slice(0, 3).concat(P.filter(x => /mount|hang/i.test(x.title)).slice(0, 2))) {
    const h = await get('https://openhagen.com/products/' + p.handle);
    const ld = [...h.t.matchAll(/"price"\s*:\s*"?([\d.]+)"?[^}]*?"priceCurrency"\s*:\s*"([A-Z]{3})"|"priceCurrency"\s*:\s*"([A-Z]{3})"[^}]*?"price"\s*:\s*"?([\d.]+)/g)].slice(0, 2).map(m => (m[1] || m[4]) + ' ' + (m[2] || m[3]));
    const js = JSON.parse((await get('https://openhagen.com/products/' + p.handle + '.js')).t || '{}');
    L(p.title, '| products.json', p.variants[0].price, '| page ld', ld.join(','), '| .js price', js.price, '| meta', (h.t.match(/og:price:amount" content="([^"]+)/) || [])[1], (h.t.match(/og:price:currency" content="([^"]+)/) || [])[1]);
  }
  L('done');
})();
