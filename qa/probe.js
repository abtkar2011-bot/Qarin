const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const get = async u => { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR', t: '' }; } };
(async () => {
  const h = await get('https://openhagen.com/'); L('openhagen currency', (h.t.match(/Shopify\.currency\s*=\s*(\{[^}]*\})/) || [])[1], (h.t.match(/"currency":"([A-Z]{3})"/) || [])[1]);
  const pj = await get('https://openhagen.com/products.json?limit=250'); const P = JSON.parse(pj.t).products; L('openhagen n', P.length, P.slice(0, 6).map(p => p.title + ' = ' + p.variants[0].price + ' | ' + p.product_type).join(' ;; '));
  const w = await get('https://woodestic.com/wp-json/wc/store/v1/products?per_page=100'); L('woodestic api', w.s);
  try { const d = JSON.parse(w.t); L('woodestic n', d.length, d.slice(0, 5).map(p => p.name + ' = ' + p.prices.price + ' ' + p.prices.currency_code + ' minor ' + p.prices.currency_minor_unit).join(' ;; ')); } catch (e) { L('woodestic parse', w.t.slice(0, 200)); }
  const s = await get('https://woodestic.com/shipping/'); L('woodestic shipping page', s.s, (s.t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/.{0,120}(Middle East|Oman|worldwide|international).{0,160}/i) || [''])[0]);
  const o = await get('https://openhagen.com/policies/shipping-policy'); L('openhagen shipping', o.s, (o.t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/.{0,120}(worldwide|international|countries|Oman|Middle East).{0,160}/i) || [''])[0]);
  L('done');
})();
