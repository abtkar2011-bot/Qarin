// temp: live check — start over button
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 15 Pro'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1200); };
  const st = l => p.evaluate(l => l + ': title=' + ((document.querySelector('.section-title h2') || {}).innerText || '') + ' resetVisible=' + [...document.querySelectorAll('[data-reset]')].filter(x => !x.hidden && x.offsetParent).length + ' activeChips=' + document.querySelectorAll('.cf-bar .cf-chip.on').length, l);
  for (const [hash, input, q] of [['#coffee', '#cfQ', 'قوجي'], ['#perfume', '#pfQ', 'عود']]) {
    await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + hash); await done(); log.push(await st(hash + ' open'));
    await p.fill(input, q); await p.press(input, 'Enter'); await done();
    await p.locator('.cf-bar .cf-row').nth(2).locator('.cf-chip').nth(1).click().catch(() => {}); await p.waitForTimeout(600); log.push(await st(hash + ' searched+filter'));
    await p.click('[data-reset]:not([hidden])'); await done(); log.push(await st(hash + ' after start over'));
  }
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n')); await b.close();
})();
