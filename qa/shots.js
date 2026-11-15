// temp: live check of coffee gear options
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 15 Pro'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#coffee'); await p.waitForTimeout(1500);
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(900); };
  const rep = async l => { const r = await p.evaluate(() => ({ head: (document.querySelector('.cf-head') || {}).innerText || '', rows: [...document.querySelectorAll('.cf-bar .cf-row')].map(r => r.innerText.replace(/\s+/g, ' ')), best: ((document.querySelector('.best-card') || {}).innerText || '-').replace(/\s+/g, ' ').slice(0, 110) })); log.push('## ' + l + ' | ' + r.head.replace(/\s+/g, ' '), ...r.rows.map(x => '  ' + x.slice(0, 180)), '  best: ' + r.best); };
  const tap = async t => { await p.locator('.cf-bar .cf-chip', { hasText: t }).first().click(); await done(); };
  await done(); await rep('home');
  await tap('مطاحن'); await rep('مطاحن'); await p.screenshot({ path: OUT + '/grinders.png' });
  await tap('ترس مخروطي'); await rep('ترس مخروطي');
  await tap('أقماع'); await rep('أقماع');
  await p.locator('.cf-bar .cf-row').first().locator('.cf-chip', { hasText: 'الكل' }).first().click(); await done(); await rep('الكل');
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
