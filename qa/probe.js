// probe: the newly approved Admitad stores — platform, product source, and our affiliate link base
const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const get = async (u, j) => { try { const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: j ? 'application/json' : '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) }); const t = await r.text(); return { s: r.status, u: r.url, t }; } catch (e) { return { s: 'ERR ' + e.message, u, t: '' }; } };
const STORES = { openhagen: 'https://openhagen.com', woodestic: 'https://www.woodestic.com', kickscrew: 'https://www.kickscrew.com', justfashionnow: 'https://www.justfashionnow.com', stylewe: 'https://www.stylewe.com', noracora: 'https://www.noracora.com', sedarglobal: 'https://www.sedarglobal.com' };
(async () => {
  const c = await get('https://abtkar2011-bot.github.io/Qarin/coupons.json', 1);
  try { const d = JSON.parse(c.t); const list = Array.isArray(d) ? d : (d.coupons || d.items || []); L('coupons', list.length, 'keys', Object.keys(list[0] || {}).join(','));
    const by = {}; for (const x of list) { const st = x.s || x.store || x.st || ''; const link = x.u || x.url || x.link || x.g || ''; (by[st] = by[st] || new Set()).add(String(link).replace(/\?.*$/, '')); }
    for (const [k, v] of Object.entries(by)) L('  link', k, '→', [...v].slice(0, 3).join(' , '));
  } catch (e) { L('coupons parse', e.message, c.s, c.t.slice(0, 200)); }
  for (const [k, B] of Object.entries(STORES)) {
    const h = await get(B); const sh = /cdn\.shopify|Shopify\.theme|shopify-section/i.test(h.t), woo = /woocommerce|wp-content/i.test(h.t);
    L('\n==', k, B, '→', h.s, h.u, 'len', h.t.length, sh ? 'SHOPIFY' : '', woo ? 'WOO' : '', '| title:', (h.t.match(/<title[^>]*>([^<]{0,80})/i) || [])[1] || '', '| cf:', /Just a moment|cf-chl/i.test(h.t));
    const pj = await get(B + '/products.json?limit=250', 1); let n = -1; try { n = JSON.parse(pj.t).products.length; } catch (e) {}
    L('  products.json', pj.s, 'products', n, n > 0 ? JSON.stringify(JSON.parse(pj.t).products[0]).slice(0, 220) : pj.t.slice(0, 120).replace(/\s+/g, ' '));
    const sm = await get(B + '/sitemap.xml'); L('  sitemap', sm.s, 'locs', (sm.t.match(/<loc>/g) || []).length, (sm.t.match(/<loc>[^<]+/g) || []).slice(0, 4).join(' '));
    const ld = (h.t.match(/application\/ld\+json/g) || []).length; L('  ld+json blocks on home', ld, '| ships to Oman hint:', /oman|عمان/i.test(h.t));
  }
  L('done');
})();
