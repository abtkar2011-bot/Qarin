// لقطات من الموقع الحقيقي: قسم القهوة وأسماء المحاصيل
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const [name, q] of [['tile', null], ['adham', 'ادهم'], ['wguji', 'دبليو قوجي'], ['geisha', 'جيشا'], ['gucci', 'عطر قوجي'], ['grinder', 'مطحنة قهوة']]) {
    const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], deviceScaleFactor: 2, locale: 'ar-OM' });
    await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(SITE + '?qa=1&v=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(2500);
    if (!q) { await p.screenshot({ path: path.join(OUT, 'home.png') }); await p.click('#coffeeTile'); }
    else { await p.fill('#q', q); await p.press('#q', 'Enter'); }
    await p.waitForFunction(() => document.querySelector('.status.done'), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(5000);
    const r = await p.evaluate(() => ({ status: (document.getElementById('status') || {}).innerText || '',
      stores: [...document.querySelectorAll('#panel-cards .pcard .pstore span')].map(e => e.textContent).reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {}),
      bar: !!document.querySelector('.cf-bar'), best: ((document.querySelector('.best-card') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 260) }));
    log.push(`${q || 'coffee tile'}: ${r.status.replace(/\s+/g, ' ')} | bar=${r.bar} | ${JSON.stringify(r.stores)}\n   BEST: ${r.best}${errs.length ? '\n   ERR ' + errs.join('; ') : ''}`);
    if (!q) {
      const bar = await p.$('.cf-bar'); if (bar) { await bar.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(OUT, 'bar.png') }); }
      await p.click('.cf-chip[data-cf="pr"][data-v="natural"]').catch(() => {}); await p.waitForTimeout(800);
      const bc = await p.$('.best-card'); if (bc) await bc.screenshot({ path: path.join(OUT, 'natural_best.png') });
      const c = await p.$('#panel-cards .pcard'); if (c) { await c.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(OUT, 'natural_cards.png') }); }
    } else {
      const bc = await p.$('.best-card'); if (bc) await bc.screenshot({ path: path.join(OUT, name + '_best.png') });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
