// temp: live check — roastery/brand filters, global ratings, coupon filters
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 15 Pro'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500); };
  const row = n => p.evaluate(n => ([...document.querySelectorAll('.cf-bar .cf-row')].map(r => r.innerText.replace(/\s+/g, ' ')).find(x => x.startsWith(n)) || '-').slice(0, 220), n);
  const best = () => p.evaluate(() => ((document.querySelector('.best-card') || {}).innerText || '-').replace(/\s+/g, ' ').slice(0, 200));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#coffee'); await done();
  log.push('## coffee', ' ' + await row('المحمصة'));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#perfume'); await done();
  log.push('## perfume', ' ' + await row('الماركة'), ' note: ' + await p.evaluate(() => [...document.querySelectorAll('.pf-bar .cf-note')].map(x => x.innerText).join(' / ')));
  for (const i of [0, 4]) { await p.click(`[data-prio="${i}"]`); await p.waitForTimeout(900); log.push(' prio ' + i + ': ' + await best()); }
  await p.goto('https://abtkar2011-bot.github.io/Qarin/coupons.html?v=' + Date.now()); await p.waitForTimeout(2500);
  log.push('## coupons', await p.evaluate(() => [...document.querySelectorAll('.frow')].map(r => '  ' + r.innerText.replace(/\s+/g, ' ')).join('\n') + '\n  ' + document.getElementById('count').innerText));
  await p.screenshot({ path: OUT + '/coupons.png' });
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
