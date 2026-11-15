// temp: screenshots of the live site (light theme) for the explainer video
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.theme', 'light'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; const POS = {};
  p.on('pageerror', e => errs.push(e.message));
  const done = async (ms = 1500) => { await p.waitForTimeout(500); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 70000 }).catch(() => log.push('timeout')); await p.waitForTimeout(ms); };
  const box = async (name, sel) => { POS[name] = await p.evaluate(s => [...document.querySelectorAll(s)].slice(0, 12).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, t: (e.innerText || '').slice(0, 60) }; }), sel).catch(() => []); };
  const shot = async (name, full) => { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full }).catch(e => log.push(name + ' ' + e.message)); log.push('shot ' + name); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { log.push('FAIL ' + name + ': ' + e.message); } };

  await step('home', async () => {
    await p.goto(SITE + '?v=' + Date.now()); await p.waitForTimeout(2500);
    await shot('home'); await shot('home_full', true);
    for (const [n, s] of [['q', '#q'], ['mic', '#micBtn'], ['img', '#imgBtn'], ['tools', '.tools-row .tool-btn'], ['prio', '.prio-seg button'], ['chips', '#heroChips span'], ['hero', '.hero'], ['search', '#searchForm']]) await box('home_' + n, s);
  });
  await step('results', async () => {
    await p.fill('#q', 'سماعات بلوتوث'); await p.press('#q', 'Enter'); await done(2500);
    await p.evaluate(() => scrollTo(0, 0)); await shot('res_top'); await shot('res_full', true);
    for (const [n, s] of [['best', '.best-card'], ['prio', '.prio-seg button'], ['status', '#status'], ['groups', '#results > *']]) await box('res_' + n, s);
    await p.click('.prio-seg [data-prio="4"]'); await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0));
    await shot('res_quality'); await shot('res_quality_full', true); await box('resq_best', '.best-card');
    await p.click('.prio-seg [data-prio="0"]'); await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0));
    await shot('res_cheap'); await shot('res_cheap_full', true); await box('resc_best', '.best-card');
  });
  await step('basket', async () => {
    await p.goto(SITE + '?v=' + Date.now()); await p.waitForTimeout(2000);
    await p.click('#basketToggle'); await p.waitForTimeout(800);
    const ins = p.locator('#basketInputs input[type="search"], #basketInputs input[type="text"], #basketInputs input:not([type="file"])');
    const n = await ins.count(); log.push('basket inputs ' + n);
    if (n > 0) await ins.nth(0).fill('شاحن ايفون');
    if (n > 1) await ins.nth(1).fill('كفر ايفون');
    await shot('basket_box', true); await box('basket', '#basketBox');
    await p.click('#basketGo'); await done(3000); await p.evaluate(() => scrollTo(0, 0));
    await shot('basket_res', true);
  });
  await step('coffee', async () => {
    await p.goto(SITE + '?v=' + Date.now() + '#coffee'); await done(2500);
    await shot('cf_top'); await shot('cf_full', true);
    await box('cf_rows', '.cf-bar .cf-row'); await box('cf_head', '.cf-head');
    await p.locator('.cf-bar .cf-row').nth(1).locator('.cf-chip').nth(1).click(); await done(2500);
    await p.evaluate(() => scrollTo(0, 0)); await shot('cf_tool'); await shot('cf_tool_full', true); await box('cft_rows', '.cf-bar .cf-row');
  });
  await step('perfume', async () => {
    await p.goto(SITE + '?v=' + Date.now() + '#perfume'); await done(3000);
    await shot('pf_top'); await shot('pf_full', true);
    await box('pf_rows', '.cf-bar .cf-row'); await box('pf_q', '.pf .q'); await box('pf_dupe', '.pf .dupe');
  });
  await step('coupons', async () => {
    await p.goto(SITE + 'coupons.html?v=' + Date.now()); await p.waitForTimeout(5000);
    await shot('cp_top'); await shot('cp_full', true);
  });
  fs.writeFileSync(OUT + '/pos.json', JSON.stringify(POS));
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n')); await b.close();
})();
