// لقطة سريعة: بحث عطر وبحث بشرة في الموقع الحقيقي
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const [name, q] of [['perfume', 'عطر رجالي'], ['oud', 'دهن عود'], ['skin', 'سيروم'], ['earbuds', 'سماعات لاسلكية']]) {
    const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], deviceScaleFactor: 2, locale: 'ar-OM' });
    await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); });
    const p = await ctx.newPage();
    await p.goto(SITE + '?qa=1&v=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(2500);
    await p.fill('#q', q); await p.press('#q', 'Enter');
    await p.waitForFunction(() => document.querySelector('.status.done') && document.querySelector('#panel-cards .pcard'), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => ({ status: document.getElementById('status').innerText.replace(/\s+/g, ' '), stores: [...document.querySelectorAll('#panel-cards .pcard .pstore span')].map(e => e.textContent) }));
    log.push(`${q}: ${r.status} | ${JSON.stringify(r.stores.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {}))}`);
    await p.evaluate(() => { const g = document.querySelector('#panel-cards'); if (g) window.scrollTo(0, g.getBoundingClientRect().top + scrollY - 10); });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
