const { chromium, devices } = require('playwright'); const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true }); const lines = []; const log = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Desktop Chrome'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); });
  
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  for (const q of ['قهوة', 'كبسولات', 'coffee']) {
    await p.goto('https://abtkar2011-bot.github.io/Qarin/index.html#coffee'); await p.waitForTimeout(2500);
    await p.fill('#cfQ', q); await p.press('#cfQ', 'Enter'); await p.waitForTimeout(6000);
    const chip = p.locator('[data-cf="kind"][data-v="beans"]'); if (!(await chip.count())) { log(q, 'no beans chip'); continue; }
    await chip.click(); await p.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) { const more = p.locator('#moreBtn, .more-btn'); if (await more.count() && await more.first().isVisible()) { await more.first().click(); await p.waitForTimeout(500); } }
    const titles = await p.locator('.pcard').evaluateAll(a => a.map(x => ((x.querySelector('h3, .ptitle, .title') || {}).textContent || '').trim() + ' @ ' + ((x.querySelector('.pstore span') || {}).textContent || '')));
    const caps = titles.filter(t => /capsul|caps\b|pods?\b|nespresso|dolce|gusto|vertuo|k-?cup|tassimo|lungo|ristretto|a modo|كبسول|كابسول|نسبريسو|نيسبريسو|نسبرسو|نيسبرسو|دولتشي|دولشي|جوستو|غوستو|بودز/i.test(t)); log('sample', JSON.stringify(titles.slice(0,5)));
    log(q, '| beans cards', titles.length, '| capsule-like', caps.length); caps.slice(0, 40).forEach(t => log('   ', t.slice(0, 110)));
  }
  await b.close(); })();
