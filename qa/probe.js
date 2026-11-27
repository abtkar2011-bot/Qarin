const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const S = 'https://abtkar2011-bot.github.io/Qarin/';
const get = async (u, json = true) => { try { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: AbortSignal.timeout(30000) }); if (!r.ok) return { err: r.status }; return json ? await r.json() : await r.text(); } catch (e) { return { err: e.message }; } };
(async () => {
  const stats = await get('https://qarin-ebay.abtkar2011.workers.dev/stats');
  const idx = await get(S + 'data/p/index.json');
  const coupons = await get(S + 'coupons.json');
  const deals = await get(S + 'data/deals.json');
  const sitemap = await get(S + 'sitemap.xml', false);
  const ali = await get(S + 'data/s/meta.json');
  const out = {
    at: new Date().toISOString(), stats,
    stores: idx && !idx.err ? Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, { n: v.n, updated: v.updated }])) : idx,
    coupons: coupons && coupons.coupons ? { n: coupons.coupons.length, updated: coupons.updated, pinned: coupons.coupons.filter(c => c.p).length } : coupons,
    deals: deals && deals.items ? deals.items.length : deals,
    sitemapUrls: typeof sitemap === 'string' ? (sitemap.match(/<loc>/g) || []).length : sitemap,
    comparePages: typeof sitemap === 'string' ? (sitemap.match(/\/compare\//g) || []).length : 0,
    ali: ali && !ali.err ? { keys: Object.keys(ali).slice(0, 20), total: ali.total || ali.n || null, updated: ali.updated || null } : ali,
  };
  fs.writeFileSync(OUT + '/report.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out).slice(0, 2000));
})();
