// copy the live partner product lists (data/p) so the SEO/deals builder can be tested offline
const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT + '/p', { recursive: true });
const S = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  const idx = await (await fetch(S + 'data/p/index.json')).json(); fs.writeFileSync(OUT + '/p/index.json', JSON.stringify(idx));
  for (const k of Object.keys(idx)) { const r = await fetch(S + 'data/p/' + k + '.json'); if (r.ok) fs.writeFileSync(OUT + '/p/' + k + '.json', await r.text()); }
  const c = await fetch(S + 'coupons.json'); if (c.ok) fs.writeFileSync(OUT + '/coupons.json', await c.text());
  fs.writeFileSync(OUT + '/report.txt', 'stores ' + Object.keys(idx).join(','));
})();
