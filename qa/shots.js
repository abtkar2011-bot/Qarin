// قارِن — اختبار شامل للموقع الحقيقي (كل المميزات) قبل المعرض. يكتب report.txt + report.json + صور الأخطاء.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const R = []; let cur = '';
const log = (ok, name, info = '') => { R.push({ ok, step: cur, name, info: String(info).slice(0, 400) }); console.log((ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL'), cur, '|', name, '|', String(info).slice(0, 200)); };
const chk = (cond, name, info) => log(!!cond, name, info);
(async () => {
  const b = await chromium.launch();
  const mk = async (dev, lang = 'ar') => {
    const ctx = await b.newContext({ ...dev, deviceScaleFactor: 1 });
    await ctx.addInitScript(l => { if (!sessionStorage.getItem('qa.init')) { sessionStorage.setItem('qa.init', '1'); localStorage.setItem('qarin.lang', l); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); } }, lang);
    const p = await ctx.newPage(); p.errs = []; p.bad = [];
    p.on('pageerror', e => p.errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text().slice(0, 160)); });
    p.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i.test(u) && !/alicdn|ebayimg|etsystatic|cdn\.shopify|googletagmanager|google-analytics/.test(u)) p.bad.push(r.status() + ' ' + u.slice(0, 140)); });
    p.on('requestfailed', r => { const u = r.url(); if (!/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) && !/alicdn|ebayimg|etsystatic|googletagmanager|google-analytics/.test(u)) p.bad.push('FAILED ' + (r.failure() || {}).errorText + ' ' + u.slice(0, 140)); });
    return p;
  };
  const clr = p => p.evaluate(() => { const s = document.getElementById('status'); if (s) s.innerHTML = ''; }).catch(() => {});
  const done = async (p, to = 75000) => { await p.waitForTimeout(400); const t0 = Date.now(); const ok = await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: to }).then(() => true).catch(() => false); return { ok, ms: Date.now() - t0 }; };
  const status = p => p.evaluate(() => (document.getElementById('status') || {}).innerText || '').catch(() => '');
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const errsOf = (p, name) => { const e = p.errs.splice(0); const n = p.bad.splice(0); chk(!e.length, name + ': no JS errors', e.join(' || ')); if (n.length) log('warn', name + ': failed requests', n.slice(0, 6).join(' || ')); };
  const step = async (name, fn) => { cur = name; const t = Date.now(); try { await fn(); } catch (e) { log(false, 'crashed', e.message); } console.log('  (' + name + ' ' + Math.round((Date.now() - t) / 1000) + 's)'); };
  const snap = async (p, n) => { await p.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 60 }).catch(() => {}); };

  const p = await mk(devices['iPhone 13']);
  await step('home', async () => {
    const t0 = Date.now(); await p.goto(SITE + '?qa=' + Date.now()); await p.waitForLoadState('networkidle').catch(() => {});
    log(true, 'load time', (Date.now() - t0) + 'ms');
    chk(await p.locator('#q').isVisible(), 'search box visible');
    chk(await p.locator('#micBtn').isVisible() && await p.locator('#imgBtn').isVisible(), 'mic + camera buttons');
    const chips = await p.locator('#heroChips').innerText(); chk(/متجر عطور/.test(chips) && /قهوة/.test(chips), 'hero chips', chips.replace(/\n/g, ' '));
    chk(await overflow(p) <= 1, 'no horizontal overflow (iPhone)', await overflow(p));
    errsOf(p, 'home'); await snap(p, 'home');
  });
  let firstEbay = '';
  await step('search AR', async () => {
    await p.fill('#q', 'سماعات بلوتوث'); await p.press('#q', 'Enter'); const d = await done(p);
    chk(d.ok, 'search finished', d.ms + 'ms'); const st = await status(p); log(true, 'status', st);
    const n = await p.locator('.pcard').count(); chk(n >= 10, 'product cards', n);
    chk(await p.locator('.best-card').count() === 1, 'best card shown');
    const plats = await p.evaluate(() => [...new Set([...document.querySelectorAll('.pcard a[href]')].map(a => { try { return new URL(a.href).hostname.replace('www.', ''); } catch (e) { return ''; } }))].slice(0, 12));
    log(true, 'link hosts', plats.join(', '));
    firstEbay = await p.evaluate(() => { const a = [...document.querySelectorAll('.pcard a[href*="ebay"]')][0]; return a ? a.href : ''; });
    const badLinks = await p.evaluate(() => [...document.querySelectorAll('.pcard a.shop, .pcard a[href]')].filter(a => !/^https:\/\//.test(a.href)).length); chk(!badLinks, 'all product links https', badLinks);
    const noImg = await p.evaluate(() => [...document.querySelectorAll('.pcard img')].filter(i => i.complete && i.naturalWidth === 0).length); chk(noImg <= 3, 'broken product images', noImg);
    chk(await overflow(p) <= 1, 'no overflow on results', await overflow(p));
    errsOf(p, 'search'); await snap(p, 'search_ar');
  });
  await step('priorities', async () => {
    const picks = [];
    for (const v of [0, 1, 2, 3, 4]) { await p.click(`.prio-seg [data-prio="${v}"]`); await p.waitForTimeout(900); picks.push(await p.locator('.best-card h3').first().innerText().catch(() => '?')); }
    log(true, 'best per priority', picks.map(s => s.slice(0, 30)).join(' | '));
    chk(new Set(picks).size >= 2, 'priority changes the best pick', new Set(picks).size);
    await p.click('.prio-seg [data-prio="2"]'); await p.waitForTimeout(600); errsOf(p, 'prio');
  });
  await step('filters + sort', async () => {
    const before = await p.locator('.pcard').count();
    await p.click('#openFilters'); await p.waitForTimeout(500); chk(await p.locator('#sidebar').isVisible(), 'filters panel opens');
    await p.selectOption('#sortSel', { index: 1 }).catch(e => log(false, 'sort select', e.message)); await p.waitForTimeout(800);
    const sortName = await p.$eval('#sortSel', s => s.options[s.selectedIndex].text).catch(() => '');
    await p.locator('#freeOnly').check({ force: true }).catch(e => log(false, 'free toggle', e.message.slice(0, 80))); await p.waitForTimeout(800);
    const free = await p.locator('.pcard').count(); log(true, 'free shipping only', before + ' → ' + free);
    await p.locator('#freeOnly').uncheck({ force: true }).catch(() => {}); await p.waitForTimeout(500);
    await p.fill('#priceMax', '5'); await p.dispatchEvent('#priceMax', 'input'); await p.dispatchEvent('#priceMax', 'change'); await p.waitForTimeout(900);
    const cheap = await p.locator('.pcard').count(); log(true, 'price max 5', before + ' → ' + cheap);
    await p.click('#priceClear').catch(() => {}); await p.waitForTimeout(500);
    const plats = await p.locator('#platformChecks input').count(); chk(plats >= 3, 'store checkboxes', plats);
    log(true, 'sort option', sortName);
    await p.click('#closeFilters', { timeout: 5000 }).catch(() => p.click('#scrim', { timeout: 5000 }).catch(() => {})); await p.waitForTimeout(400);
    chk(!(await p.evaluate(() => document.getElementById('app').classList.contains('filters-open'))), 'filters panel closes');
    errsOf(p, 'filters');
  });
  await step('fav / compare / cart', async () => {
    await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => { document.getElementById('app').classList.remove('filters-open'); document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); });
    const cards = p.locator('.pcard'); await cards.nth(1).locator('[data-fav]').click(); await p.waitForTimeout(300);
    chk((await p.locator('#favCount').innerText().catch(() => '0')).trim() !== '0', 'favourite added', await p.locator('#favCount').innerText().catch(() => ''));
    await p.click('#favFab').catch(() => {}); await p.waitForTimeout(500); chk(await p.locator('#favModal.on').count(), 'favourites window opens');
    await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')));
    await cards.nth(1).locator('[data-cmp]').click(); await cards.nth(2).locator('[data-cmp]').click(); await p.waitForTimeout(400);
    chk(await p.locator('#cmpBar').isVisible(), 'compare bar shows');
    await p.click('#cmpGo').catch(() => {}); await p.waitForTimeout(600); chk(await p.locator('#cmpModal.on').count(), 'compare window opens');
    const rows = await p.locator('#cmpBody tr').count(); log(true, 'compare rows', rows);
    await p.evaluate(() => document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')));
    await p.click('#cmpClear').catch(() => {});
    await cards.nth(1).locator('[data-cart]').click().catch(() => p.locator('.pcard [data-cart]').first().click()); await p.waitForTimeout(400);
    chk((await p.locator('#cartCount').innerText().catch(() => '0')).trim() !== '0', 'cart added', await p.locator('#cartCount').innerText().catch(() => ''));
    await p.click('#cartFab').catch(() => {}); await p.waitForTimeout(500); chk(await p.locator('#cartModal.on').count(), 'cart window opens');
    await snap(p, 'cart'); await p.evaluate(() => document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')));
    errsOf(p, 'fav');
  });
  await step('search EN + link', async () => {
    await p.fill('#q', 'wireless mouse'); await p.press('#q', 'Enter'); let d = await done(p); chk(d.ok, 'english search', d.ms + 'ms ' + await status(p));
    chk(await p.locator('.pcard').count() >= 10, 'english cards', await p.locator('.pcard').count());
    if (firstEbay) { await p.fill('#q', firstEbay); await p.press('#q', 'Enter'); d = await done(p); const st = await status(p); chk(d.ok && await p.locator('.pcard').count() > 0, 'paste product link', st); await snap(p, 'link'); }
    else log('warn', 'paste link', 'no ebay link found');
    errsOf(p, 'en');
  });
  await step('image search (main)', async () => {
    await clr(p); await p.fill('#q', 'ساعة ذكية'); await p.press('#q', 'Enter'); await done(p);
    await p.locator('.best-card').scrollIntoViewIfNeeded().catch(() => {});
    const img = p.locator('.best-card img').first(); await img.screenshot({ path: '/tmp/qa_img.png' });
    await clr(p); await p.setInputFiles('#imgIn', '/tmp/qa_img.png'); const d = await done(p, 60000);
    await p.waitForSelector('.vs-box .vs-card', { timeout: 60000 }).then(() => log(true, 'same-look box (main)', '')).catch(() => log('warn', 'same-look box (main)', 'not shown'));
    const st = await status(p); const toast = await p.locator('#toast').innerText().catch(() => '');
    chk(d.ok && await p.locator('.pcard').count() > 0, 'image → results', toast + ' | ' + st); await snap(p, 'img_main'); errsOf(p, 'img');
  });
  await step('basket', async () => {
    await p.goto(SITE + '?qa=' + Date.now()); await p.waitForTimeout(1500);
    await p.click('#basketToggle'); await p.waitForTimeout(400);
    const ins = p.locator('#basketInputs input:not([type="file"])');
    if (await ins.count() < 3) await p.click('#basketAdd').catch(() => {});
    const n = await ins.count(); const items = ['شاحن ايفون', 'كفر ايفون', 'سماعات بلوتوث'];
    for (let i = 0; i < Math.min(3, n); i++) await ins.nth(i).fill(items[i]);
    await clr(p); await p.click('#basketGo'); const d = await done(p, 120000); chk(d.ok, 'basket finished', d.ms + 'ms ' + await status(p));
    const bk = await p.locator('.bk-card').count(); chk(bk >= 2, 'basket per store', bk);
    const sw = p.locator('[data-bk-swap]').first(); if (await sw.count()) { await sw.click(); await p.waitForTimeout(500); chk(await p.locator('#swapModal.on').count(), 'swap window opens'); await p.evaluate(() => document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on'))); }
    const c = p.locator('[data-bk-cart]').first(); if (await c.count()) { await c.click(); await p.waitForTimeout(400); log(true, 'basket → cart', await p.locator('#cartCount').innerText().catch(() => '')); }
    await snap(p, 'basket'); errsOf(p, 'basket');
  });
  await step('currency + theme', async () => {
    const opts = await p.$$eval('#curSel option', o => o.map(x => x.value)); log(true, 'currencies', opts.join(','));
    for (const c of ['USD', 'SAR', 'AED', 'OMR']) if (opts.includes(c)) { await p.selectOption('#curSel', c); await p.waitForTimeout(500); }
    const t1 = await p.evaluate(() => document.documentElement.dataset.theme || ''); await p.click('#themeBtn'); await p.waitForTimeout(300);
    const t2 = await p.evaluate(() => document.documentElement.dataset.theme || ''); chk(t1 !== t2, 'theme toggles', t1 + ' → ' + t2); await snap(p, 'dark'); await p.click('#themeBtn');
    errsOf(p, 'cur');
  });
  await step('languages', async () => {
    const langs = await p.$$eval('#langSel option', o => o.map(x => x.value)); log(true, 'languages', langs.join(','));
    for (const l of langs) {
      await p.selectOption('#langSel', l); await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const t = document.querySelector('header, .hero, main') ? [...document.querySelectorAll('.hero, .tools-row, .prio, footer, #heroChips, .tile')].map(e => e.innerText).join(' ') : document.body.innerText; const ar = (t.match(/[؀-ۿ]/g) || []).length; return { dir: document.documentElement.dir, ar, all: t.length, sample: (t.match(/[؀-ۿ][؀-ۿ\s]{3,30}/g) || []).slice(0, 4) }; });
      if (l === 'ar' || l === 'ur') chk(r.dir === 'rtl', l + ' dir rtl', r.dir);
      else { chk(r.dir === 'ltr', l + ' dir ltr', r.dir); chk(r.ar < 25, l + ' no leftover Arabic', r.ar + ' ' + r.sample.join(' / ')); }
      chk(await overflow(p) <= 1, l + ' no overflow', await overflow(p));
    }
    await p.selectOption('#langSel', 'ar'); await p.waitForTimeout(800); errsOf(p, 'lang');
  });
  await step('coffee', async () => {
    await p.goto(SITE + '?qa=' + Date.now() + '#coffee'); const d = await done(p); chk(d.ok, 'coffee loads', d.ms + 'ms ' + await status(p));
    const head = await p.locator('.cf-head').first().innerText().catch(() => ''); log(true, 'head', head.replace(/\n/g, ' '));
    const n0 = await p.locator('.pcard').count(); chk(n0 > 20, 'coffee cards', n0);
    const kinds = await p.locator('[data-cfk]').count(); let bad = [];
    for (let i = 0; i < kinds; i++) { const k = p.locator('[data-cfk]').nth(i); const lbl = (await k.innerText().catch(() => '')).replace(/\s+/g, ' '); await k.click().catch(() => {}); await done(p, 30000); const n = await p.locator('.pcard, .bk-row, .empty').count(); if (!n) bad.push(lbl); await p.goto(SITE + '?qa=' + Date.now() + '#coffee'); await done(p); }
    chk(!bad.length, 'every kind chip gives results (' + kinds + ')', bad.join(', '));
    const rows = await p.locator('.cf-bar .cf-row').count(); log(true, 'filter rows', rows);
    const ro = p.locator('.cf-bar .cf-row').filter({ hasText: 'المحمصة' }).locator('.cf-chip').nth(1); if (await ro.count()) { await ro.click(); await done(p, 20000); chk(await p.locator('.pcard').count() > 0, 'roaster filter', await ro.innerText().catch(() => '')); }
    const reset = p.locator('[data-reset]').first(); if (await reset.isVisible().catch(() => false)) { await reset.click(); await done(p, 30000); chk(await p.locator('.pcard').count() >= n0 * 0.8, 'reset button', await p.locator('.pcard').count()); } else log('warn', 'reset button', 'not visible');
    const more = p.locator('[data-more]').first(); if (await more.count()) { const a = await p.locator('.pcard').count(); await more.click(); await p.waitForTimeout(800); chk(await p.locator('.pcard').count() > a, 'show more', a + ' → ' + await p.locator('.pcard').count()); }
    const img = p.locator('.best-card img').first(); if (await img.count()) { await img.screenshot({ path: '/tmp/qa_cf.png' }); await clr(p); await p.setInputFiles('#cfImgIn', '/tmp/qa_cf.png'); const d2 = await done(p, 60000);
      await p.waitForSelector('.vs-box .vs-card', { timeout: 60000 }).then(async () => log(true, 'same-look box (coffee)', await p.locator('.vs-box .vs-t').first().innerText())).catch(() => log('warn', 'same-look box (coffee)', 'not shown')); chk(d2.ok && await p.locator('.pcard').count() > 0, 'coffee image search', (await p.locator('#toast').innerText().catch(() => '')) + ' | ' + await status(p)); }
    chk(await overflow(p) <= 1, 'no overflow', await overflow(p)); await snap(p, 'coffee'); errsOf(p, 'coffee');
  });
  await step('perfume', async () => {
    await p.goto(SITE + '?qa=' + Date.now() + '#perfume'); const d = await done(p); chk(d.ok, 'perfume loads', d.ms + 'ms ' + await status(p));
    const n0 = await p.locator('.pcard').count(); chk(n0 > 20, 'perfume cards', n0);
    const kinds = await p.locator('[data-pfk]').count(); let bad = [];
    for (let i = 0; i < kinds; i++) { const k = p.locator('[data-pfk]').nth(i); const lbl = (await k.innerText().catch(() => '')).replace(/\s+/g, ' '); await k.click().catch(() => {}); await done(p, 30000); if (!await p.locator('.pcard').count()) bad.push(lbl); await p.goto(SITE + '?qa=' + Date.now() + '#perfume'); await done(p); }
    chk(!bad.length, 'every perfume kind gives results (' + kinds + ')', bad.join(', '));
    const rowsN = await p.locator('.cf-bar .cf-row').count(); let rbad = [];
    for (let r = 0; r < rowsN; r++) { const row = p.locator('.cf-bar .cf-row').nth(r); const c = row.locator('[data-pff]').nth(1); if (!await c.count()) continue; const lbl = await c.innerText().catch(() => ''); await c.click().catch(() => {}); await p.waitForTimeout(900); if (!await p.locator('.pcard').count()) rbad.push(lbl.replace(/\s+/g, ' ')); const all = row.locator('[data-pff]').first(); await all.click().catch(() => {}); await p.waitForTimeout(500); }
    chk(!rbad.length, 'filter chips give results (' + rowsN + ' rows)', rbad.join(', '));
    const q = await p.locator('.pf .q').count(); log(true, 'global ratings shown on cards', q);
    await p.click('.prio-seg [data-prio="4"]').catch(() => {}); await p.waitForTimeout(900); log(true, 'quality pick', await p.locator('.best-card h3').first().innerText().catch(() => ''));
    await p.click('.prio-seg [data-prio="0"]').catch(() => {}); await p.waitForTimeout(900); log(true, 'cheap pick', await p.locator('.best-card h3').first().innerText().catch(() => ''));
    const img = p.locator('.best-card img').first(); if (await img.count()) { await img.screenshot({ path: '/tmp/qa_pf.png' }); await clr(p); await p.setInputFiles('#pfImgIn', '/tmp/qa_pf.png'); const d2 = await done(p, 60000);
      await p.waitForSelector('.vs-box .vs-card', { timeout: 60000 }).then(async () => log(true, 'same-look box (perfume)', await p.locator('.vs-box .vs-t').first().innerText())).catch(() => log('warn', 'same-look box (perfume)', 'not shown')); chk(d2.ok && await p.locator('.pcard').count() > 0, 'perfume image search', (await p.locator('#toast').innerText().catch(() => '')) + ' | ' + await status(p)); }
    chk(await overflow(p) <= 1, 'no overflow', await overflow(p)); await snap(p, 'perfume'); errsOf(p, 'perfume');
  });
  await step('coupons', async () => {
    await p.goto(SITE + 'coupons.html?qa=' + Date.now()); await p.waitForTimeout(4000);
    const cnt = await p.locator('#count').innerText().catch(() => ''); chk(/\d/.test(cnt), 'coupon count', cnt);
    const chips = await p.locator('button[data-f], [data-reg], [data-min], [data-type]').count(); log(true, 'filter chips', chips);
    const btns = p.locator('#fReg button, #fMin button, #fType button'); const nb = Math.min(await btns.count(), 14); let empty = [];
    for (let i = 0; i < nb; i++) { const bt = btns.nth(i); const l = await bt.innerText().catch(() => ''); await bt.click().catch(() => {}); await p.waitForTimeout(250); const c = await p.locator('#count').innerText().catch(() => ''); if (/^0\s/.test(c.trim())) empty.push(l.replace(/\s+/g, ' ')); }
    log(empty.length ? 'warn' : true, 'filters leading to 0 coupons', empty.join(', '));
    chk(await overflow(p) <= 1, 'no overflow', await overflow(p)); await snap(p, 'coupons'); errsOf(p, 'coupons');
  });
  await step('other pages', async () => {
    for (const pg of ['about.html', 'privacy.html', 'searches.html', 'stats.html']) { const r = await p.goto(SITE + pg).catch(() => null); chk(r && r.status() === 200, pg + ' 200', r && r.status()); await p.waitForTimeout(1200); chk(await overflow(p) <= 1, pg + ' no overflow', await overflow(p)); }
    errsOf(p, 'pages');
  });
  await step('desktop + iPad', async () => {
    for (const [nm, dev] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iPad', devices['iPad (gen 7)']]]) {
      const q = await mk(dev); await q.goto(SITE + '?qa=' + Date.now()); await q.waitForTimeout(1500);
      chk(await overflow(q) <= 1, nm + ' home no overflow', await overflow(q));
      await q.fill('#q', 'قهوة'); await q.press('#q', 'Enter'); const d = await done(q); chk(d.ok && await q.locator('.pcard').count() > 0, nm + ' search', d.ms + 'ms');
      chk(await overflow(q) <= 1, nm + ' results no overflow', await overflow(q)); await snap(q, nm); errsOf(q, nm); await q.context().close();
    }
  });
  const fails = R.filter(r => r.ok === false), warns = R.filter(r => r.ok === 'warn');
  const txt = `PASS ${R.filter(r => r.ok === true).length}  FAIL ${fails.length}  WARN ${warns.length}\n\n` + R.map(r => `${r.ok === true ? 'PASS' : r.ok === 'warn' ? 'WARN' : 'FAIL'} [${r.step}] ${r.name} :: ${r.info}`).join('\n');
  fs.writeFileSync(OUT + '/report.txt', txt); fs.writeFileSync(OUT + '/report.json', JSON.stringify(R, null, 1));
  console.log('\nSUMMARY', txt.split('\n')[0]); await b.close();
})();
