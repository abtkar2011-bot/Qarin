const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-OM' });
  await ctx.addInitScript(() => localStorage.setItem('qarin.instHide', String(Date.now())));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const out = {};
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?t=' + Date.now() + '#perfume'); await p.waitForTimeout(3500);
  await p.fill('#pfQ', 'dior sauvage'); await p.press('#pfQ', 'Enter'); await p.waitForTimeout(8000);
  const links = await p.locator('.pcard a.shop-btn').evaluateAll(a => a.map(x => x.getAttribute('href')));
  for (const h of links) { const host = new URL(h).host; out[host] = out[host] || h.slice(0, 140); }
  await p.goto('https://abtkar2011-bot.github.io/Qarin/#coffee'); await p.waitForTimeout(3500);
  await p.fill('#cfQ', 'v60'); await p.press('#cfQ', 'Enter'); await p.waitForTimeout(7000);
  const l2 = await p.locator('.pcard a.shop-btn').evaluateAll(a => a.map(x => x.getAttribute('href')));
  for (const h of l2) { const host = new URL(h).host; out[host] = out[host] || h.slice(0, 140); }
  const txt = JSON.stringify({ links: out, perfumeCards: links.length, coffeeCards: l2.length, errs }, null, 1);
  fs.writeFileSync(OUT + '/report.txt', txt); console.log(txt); await b.close(); })();
