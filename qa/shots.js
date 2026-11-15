// temp: live check of coffee kinds on the real site
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPad (gen 7)'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#coffee'); await p.waitForTimeout(1500);
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(800); };
  const rep = async l => { const r = await p.evaluate(() => ({ best: (document.querySelector('.best-card') || {}).innerText || '-', rows: [...document.querySelectorAll('.cf-row')].slice(0, 2).map(r => r.innerText.replace(/\s+/g, ' ')) })); log.push('## ' + l, ' best: ' + r.best.replace(/\s+/g, ' ').slice(0, 160), ...r.rows.map(x => ' ' + x)); };
  await done(); await rep('home');
  await p.fill('#cfQ', 'كيس قهوة'); await p.press('#cfQ', 'Enter'); await done(); await rep('كيس قهوة');
  await p.screenshot({ path: OUT + '/bag.png' });
  await p.locator('.cf-bar .cf-chip', { hasText: 'مطاحن' }).first().click(); await done(); await rep('مطاحن');
  await p.locator('.cf-bar .cf-chip', { hasText: 'قهوة تركية' }).first().click(); await done(); await rep('قهوة تركية');
  await p.screenshot({ path: OUT + '/turkish.png' });
  log.push('camera: ' + (await p.$('#cfImgBtn') ? 'yes' : 'no'), 'errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
