// temp: probe Salla storefront API (Al Majed, Ibraq)
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const log = [];
async function get(u, h, save) {
  try {
    const r = await fetch(u, { headers: Object.assign({ 'user-agent': UA, 'accept-language': 'ar', accept: 'application/json, text/html' }, h || {}), redirect: 'follow', signal: AbortSignal.timeout(30000) }); const t = await r.text();
    log.push(`${r.status} ${u} ${JSON.stringify(h || {})} len=${t.length} :: ${t.slice(0, 300).replace(/\s+/g, ' ')}`);
    if (save) fs.writeFileSync(OUT + '/' + save, t.slice(0, 800000));
    return t;
  } catch (e) { log.push('ERR ' + u + ' ' + e.message); return ''; }
}
(async () => {
  for (const [B, id, tag] of [['https://om.almajed4oud.com', '1049949872', 'm'], ['https://oman.ibraqperfumes.com', '618083196', 'i']]) {
    const H = { 'Store-Identifier': id, 'currency': 'OMR', 'accept-language': 'ar' };
    await get('https://api.salla.dev/store/v1/products?per_page=50&page=1', H, tag + '_api1.json');
    await get('https://api.salla.dev/store/v1/products?source=latest&per_page=50', H, tag + '_api2.json');
    await get(B + '/api/products?per_page=5', null, tag + '_api3.json');
  }
  const s1 = await get('https://om.almajed4oud.com/sitemap-1.xml', null, 'm_sm1.txt');
  const l1 = [...s1.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  const s2 = await get('https://om.almajed4oud.com/sitemap-2.xml', null, 'm_sm2.txt');
  const l2 = [...s2.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  log.push('majed sitemap1 ' + l1.length + ' ' + l1.slice(0, 3).join(' ') + ' | sitemap2 ' + l2.length + ' ' + l2.slice(0, 3).join(' '));
  const pu = [...l1, ...l2].find(u => /\/p\d+/.test(u));
  if (pu) await get(pu, null, 'm_p1.txt');
  await get('https://oman.ibraqperfumes.com/ar/sitemap.xml', null, 'i_sm2.txt');
  fs.writeFileSync(OUT + '/probe.txt', log.join('\n')); console.log(log.join('\n'));
})();
