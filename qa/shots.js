// temp: live check of the perfume section on the real site
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPad (gen 7)'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const idx = await (await fetch('https://abtkar2011-bot.github.io/Qarin/data/p/index.json?x=' + Date.now())).json().catch(() => ({}));
  log.push('index: ' + Object.entries(idx).map(([k, v]) => k + '=' + v.n).join(' '));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#perfume'); await p.waitForTimeout(1500);
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(900); };
  const rep = async l => { const r = await p.evaluate(() => ({ best: (document.querySelector('.best-card') || {}).innerText || '-', rows: [...document.querySelectorAll('.pf-bar .cf-row')].slice(0, 2).map(r => r.innerText.replace(/\s+/g, ' ')), side: [...document.querySelectorAll('#platformChecks .check')].filter(x => x.offsetParent).length, st: (document.querySelector('.status') || {}).innerText })); log.push('## ' + l + ' | sidebar ' + r.side + ' | ' + (r.st || '').replace(/\s+/g, ' ').slice(0, 80), ' best: ' + r.best.replace(/\s+/g, ' ').slice(0, 160), ...r.rows.map(x => ' ' + x)); };
  await done(); await rep('home'); await p.screenshot({ path: OUT + '/perf_home.png' });
  for (const q of ['دهن عود', 'interlude', 'بخور']) { await p.fill('#pfQ', q); await p.press('#pfQ', 'Enter'); await done(); await rep(q); }
  await p.screenshot({ path: OUT + '/perf_bakhoor.png' });
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
