// لقطات سريعة للموقع الحقيقي بعد تغيير التصميم
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], locale: 'ar-OM', colorScheme: theme });
    await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); });
    const p = await ctx.newPage();
    await p.goto(SITE + '?v=' + Date.now(), { waitUntil: 'networkidle' }); await sleep(2500);
    const fam = await p.evaluate(() => ({ almarai: document.fonts.check('16px Almarai'), body: getComputedStyle(document.body).fontFamily }));
    fs.writeFileSync(path.join(OUT, 'font_' + theme + '.json'), JSON.stringify(fam));
    await p.screenshot({ path: path.join(OUT, theme + '_home.png') });
    if (theme === 'light') {
      await p.fill('#q', 'سماعات لاسلكية'); await p.press('#q', 'Enter');
      await p.waitForFunction(() => /✓/.test(document.getElementById('status').innerText), null, { timeout: 60000 }).catch(() => {});
      await sleep(4000);
      await p.screenshot({ path: path.join(OUT, 'light_results_top.png') });
      await p.evaluate(() => { const e = document.querySelector('.best-card'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 20); }); await sleep(1500);
      await p.screenshot({ path: path.join(OUT, 'light_results_best.png') });
      await p.evaluate(() => { const e = document.querySelector('.grid'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 20); }); await sleep(2000);
      await p.screenshot({ path: path.join(OUT, 'light_results_grid.png') });
    }
    await ctx.close();
  }
  await b.close();
})();
