// فحص الموقع المنشور الحقيقي: أخطاء، CSP، بحث، أقسام، صفحات
const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const { chromium, devices } = require('playwright');
const S = 'https://abtkar2011-bot.github.io/Qarin/';
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
(async () => {
  const b = await chromium.launch();
  for (const dev of ['iPhone 13', 'Desktop Chrome']) {
    const ctx = await b.newContext({ ...devices[dev], locale: 'ar-OM' });
    await ctx.addInitScript(() => { localStorage.setItem('qarin.instHide', String(Date.now())); });
    const p = await ctx.newPage(); p.setDefaultTimeout(9000);
    const errs = [], csp = [], bad = []; let i18n = false;
    p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    p.on('console', m => { const t = m.text(); if (/Content.Security.Policy|Refused to/i.test(t)) csp.push(t.slice(0, 220)); });
    p.on('response', r => { if (r.url().startsWith(S) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(S, '').slice(0, 80)); });
    p.on('request', r => { if (r.url().includes('i18n.js')) i18n = true; });
    p.on('popup', pp => pp.close().catch(() => { }));
    const step = async (name, fn) => { const t0 = Date.now(); try { const r = await fn(); L(dev, 'OK', name, JSON.stringify(r || ''), (Date.now() - t0) + 'ms'); } catch (e) { L(dev, 'FAIL', name, e.message.split('\n')[0].slice(0, 150)); } };
    await step('home', async () => { await p.goto(S + '?t=' + Date.now()); await p.waitForTimeout(3000); const csp1 = await p.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')); return { csp: csp1, i18nLoaded: i18n }; });
    for (const q of ['سماعات لاسلكية', 'ايفون 15', 'dji neo 2 combo']) await step('search ' + q, async () => { await p.fill('#q', q); await p.press('#q', 'Enter'); await p.waitForTimeout(9000); const n = await p.locator('.pcard').count(); const stores = await p.locator('.pcard .pstore span').evaluateAll(a => [...new Set(a.map(x => x.textContent))].slice(0, 6)); if (!n) throw new Error('no results'); return { n, stores }; });
    await step('perfume', async () => { await p.goto(S + '#perfume'); await p.waitForTimeout(3000); await p.fill('#pfQ', 'dior sauvage'); await p.press('#pfQ', 'Enter'); await p.waitForTimeout(7000); const n = await p.locator('.pcard').count(); if (!n) throw new Error('no perfume'); return { n, codes: await p.locator('.xcode').count(), hist: await p.locator('.hist').count() }; });
    await step('coffee', async () => { await p.goto(S + '#coffee'); await p.waitForTimeout(3000); await p.fill('#cfQ', 'قهوة اثيوبية'); await p.press('#cfQ', 'Enter'); await p.waitForTimeout(7000); const n = await p.locator('.pcard').count(); const bq = await p.locator('.pcard .pstore span', { hasText: 'بن القصاب' }).count(); if (!n) throw new Error('no coffee'); return { n, bunalqassab: bq }; });
    await step('coupons', async () => { await p.goto(S + 'coupons.html'); await p.waitForTimeout(2500); return { n: await p.locator('.cp').count(), pinned: await p.locator('.cp.pin').count() }; });
    await step('deals', async () => { await p.goto(S + 'deals.html'); await p.waitForTimeout(1500); return { n: await p.locator('.c').count() }; });
    await step('compare', async () => { await p.goto(S + 'compare/'); await p.waitForTimeout(1500); return { links: await p.locator('a[href$=".html"]').count() }; });
    await step('admin', async () => { await p.goto(S + 'admin/'); await p.waitForTimeout(1500); await p.fill('#pass', 'x'); await p.click('#go'); await p.waitForTimeout(3000); return { msg: (await p.locator('#err').innerText()).slice(0, 60) }; });
    await step('stats', async () => { await p.goto(S + 'stats.html'); await p.waitForTimeout(2500); return { top: await p.locator('#top .hrow').count() }; });
    L(dev, 'pageerrors', JSON.stringify(errs.slice(0, 6)));
    L(dev, 'csp', JSON.stringify([...new Set(csp)].slice(0, 6)));
    L(dev, 'http>=400', JSON.stringify([...new Set(bad)].slice(0, 8)));
    await ctx.close();
  }
  await b.close();
})();
