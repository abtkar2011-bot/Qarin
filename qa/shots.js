// temp: live check — all coffee shown, priorities change best pick, perfume ok
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPad (gen 7)'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(900); };
  const best = () => p.evaluate(() => ((document.querySelector('.best-card') || {}).innerText || '-').replace(/\s+/g, ' ').slice(0, 130));
  const info = () => p.evaluate(() => ({ head: ((document.querySelector('.cf-head') || {}).innerText || '').replace(/\s+/g, ' '), kinds: ((document.querySelector('.cf-bar .cf-row') || {}).innerText || '').replace(/\s+/g, ' '), more: ((document.querySelector('[data-more]') || {}).innerText || '-').replace(/\s+/g, ' ') }));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#coffee'); await done();
  log.push('## coffee', JSON.stringify(await info()));
  for (const i of [0, 4]) { await p.click(`[data-prio="${i}"]`); await p.waitForTimeout(900); log.push(' prio ' + i + ': ' + await best()); }
  await p.fill('#cfQ', 'بن القصاب'); await p.press('#cfQ', 'Enter'); await done();
  log.push(' bq: ' + JSON.stringify(await info()));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#perfume'); await done();
  log.push('## perfume', JSON.stringify(await info()));
  for (const i of [0, 4]) { await p.click(`[data-prio="${i}"]`); await p.waitForTimeout(900); log.push(' prio ' + i + ': ' + await best()); }
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
