// قسم القهوة في الموقع الحقيقي
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  const b = await chromium.launch(); const log = [];
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], deviceScaleFactor: 2, locale: 'ar-OM' });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(SITE + '?v=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(2500);
  const done = () => p.waitForFunction(() => document.querySelector('.status.done'), null, { timeout: 120000 }).then(() => p.waitForTimeout(3000)).catch(() => {});
  const stores = () => p.$$eval('#panel-cards .pcard .pstore span', e => e.map(x => x.textContent).reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {}));
  await p.click('#coffeeTile'); await done();
  log.push('tile: ' + JSON.stringify(await stores()) + ' hash=' + await p.evaluate(() => location.hash));
  await p.screenshot({ path: path.join(OUT, 'cf_top.png') });
  log.push('kinds: ' + (await p.$$eval('.cf-chip[data-cf="kind"]', e => e.map(x => x.innerText.replace(/\s+/g, ' ')))).join(', '));
  log.push('procs: ' + (await p.$$eval('.cf-chip[data-cf="pr"]', e => e.map(x => x.innerText.replace(/\s+/g, ' ')))).join(', '));
  const bar = await p.$('.cf-bar'); if (bar) { await bar.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(OUT, 'cf_bar.png') }); }
  await p.fill('#cfQ', 'عقد'); await p.press('#cfQ', 'Enter'); await done();
  log.push('عقد: ' + JSON.stringify(await stores()) + ' | ' + (await p.$$eval('#panel-cards .pcard .ptitle', e => e.slice(0, 4).map(x => x.textContent.trim()))).join(' ¦ '));
  await p.click('.cf-quick [data-cfq="كبسولات"]'); await done();
  log.push('كبسولات: ' + JSON.stringify(await stores()));
  const bc = await p.$('.best-card'); if (bc) await bc.screenshot({ path: path.join(OUT, 'cf_caps.png') });
  await p.click('#cfBack'); await p.waitForTimeout(800);
  log.push('back: hero=' + await p.isVisible('.hero') + ' head=' + await p.isVisible('#coffeeHead'));
  log.push('errors: ' + errs.join(' | '));
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
