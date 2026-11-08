// قارِن — يصوّر الموقع الحقيقي (للفيديو): بحث، طرق العرض، السلة، البحث بالصورة، الأقسام، اللغات، الكوبونات
//   node qa/shots.js   (OUT=shots-out)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE || 'https://abtkar2011-bot.github.io/Qarin/';
const OUT = process.env.OUT || 'shots-out';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push([k, v]); console.log(k, typeof v === 'string' ? v.slice(0, 200) : v); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PHONE = { ...devices['iPhone 14 Pro Max'], locale: 'ar-OM', timezoneId: 'Asia/Muscat' };

async function step(name, fn) {
  try { await fn(); note('ok', name); } catch (e) { note('FAIL ' + name, String(e && e.message || e)); }
}
async function waitDone(page, ms = 60000) {
  await page.waitForFunction(() => window.__qa && !window.__qa.state.loading && window.__qa.state.products.length > 0, null, { timeout: ms });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].filter(i => i.getBoundingClientRect().top < 3000).map(i => i.decode().catch(() => {}))));
  await sleep(800);
}
async function shot(page, name, opts = {}) {
  await page.screenshot({ path: path.join(OUT, name), ...opts });
  note('shot', name);
}
async function toResults(page, off = 0) {
  await page.evaluate(o => { const r = document.getElementById('status') || document.getElementById('results'); window.scrollTo(0, r.getBoundingClientRect().top + window.scrollY - 20 + o); }, off);
  await sleep(500);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => {
    try { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); } catch (e) {}
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => note('pageerror', e.message));

  await step('home', async () => {
    await page.goto(SITE + '?qa=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__qa);
    await sleep(1200);
    await shot(page, '01_home.png');
    await shot(page, '01b_home_full.png', { fullPage: true });
  });

  await step('typed', async () => {
    await page.click('#q');
    await page.fill('#q', 'سماعات لاسلكية');
    await sleep(400);
    await shot(page, '02_typed.png');
  });

  let firstImg = '';
  await step('results', async () => {
    await page.press('#q', 'Enter');
    await waitDone(page);
    await toResults(page);
    await shot(page, '03_results.png');
    await toResults(page, 700);
    await shot(page, '03c_cards.png');
    const top = await page.evaluate(() => document.getElementById('status').getBoundingClientRect().top + window.scrollY);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await shot(page, '03b_results_long.png', { fullPage: true, clip: { x: 0, y: top - 10, width: 430, height: 3200 } });
    firstImg = await page.evaluate(() => { const i = [...document.querySelectorAll('#results img')].find(x => x.naturalWidth > 200 && /alicdn|ebayimg|etsystatic/.test(x.src)); return i ? i.src : ''; });
    note('count', await page.evaluate(() => window.__qa.state.products.length + ' products; ' + document.getElementById('status').innerText.replace(/\s+/g, ' ').slice(0, 200)));
  });

  for (const [tab, file] of [['compare', '04_compare.png'], ['table', '05_table.png'], ['cards', '']]) {
    await step('tab ' + tab, async () => {
      await page.click(`[data-tab="${tab}"]`);
      await sleep(900);
      if (!file) return;
      await toResults(page);
      await shot(page, file);
      if (tab === 'table') { await toResults(page, 500); await shot(page, '05b_table2.png'); }
    });
  }

  await step('share', async () => {
    await toResults(page, 700);
    const b = page.locator('#results [data-share]').first();
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await sleep(600);
    const u = await page.evaluate(() => window.__opened.slice(-1)[0] || '');
    const text = u ? decodeURIComponent((u.split('text=')[1] || '').replace(/\+/g, ' ')) : '';
    fs.writeFileSync(path.join(OUT, 'share.txt'), text);
    note('share', text);
    const card = page.locator('#results article').first();
    await card.screenshot({ path: path.join(OUT, '06_card.png') });
  });

  await step('basket', async () => {
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await page.click('#basketToggle');
    await sleep(400);
    const ins = page.locator('.bb-in');
    const vals = ['سماعات لاسلكية', 'شاحن ايفون', 'كفر جوال'];
    for (let i = 0; i < vals.length; i++) await ins.nth(i).fill(vals[i]);
    await sleep(300);
    await page.locator('#basketBox').scrollIntoViewIfNeeded();
    await shot(page, '07_basket_in.png');
    await page.click('#basketGo');
    await page.waitForFunction(() => !window.__qa.state.loading && document.querySelector('.bsk, .bk-grid'), null, { timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    await toResults(page);
    await shot(page, '08_basket_out.png');
    await toResults(page, 650);
    await shot(page, '08b_basket_out2.png');
  });

  await step('image search', async () => {
    let buf = null;
    const fixed = process.env.IMG_URL || firstImg;
    if (fixed) { const r = await page.request.get(fixed); if (r.ok()) buf = await r.body(); }
    if (!buf) throw new Error('no image');
    const f = path.join(OUT, 'img_input.jpg');
    fs.writeFileSync(f, buf);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await page.locator('#imgIn').setInputFiles(f);
    await sleep(2500);
    await shot(page, '09a_img_wait.png');
    await page.waitForFunction(() => window.__qa.state.mode !== 'basket' && !window.__qa.state.loading && window.__qa.state.products.length > 0, null, { timeout: 90000 });
    await waitDone(page);
    note('img query', await page.evaluate(() => window.__qa.state.query));
    await toResults(page);
    await shot(page, '09_img_results.png');
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await shot(page, '09c_img_top.png');
  });

  await step('categories', async () => {
    await page.goto(SITE + '?qa=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__qa);
    await page.locator('#cats').scrollIntoViewIfNeeded();
    await sleep(500);
    await shot(page, '10_cats.png');
    const tab = page.locator('#cats [data-cat]').filter({ hasText: '☕' });
    await tab.click();
    await sleep(600);
    await page.evaluate(() => { const c = document.getElementById('cats'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 40); });
    await sleep(400);
    await shot(page, '10b_cats_coffee.png');
    await page.locator('#cats [data-catq]').filter({ hasText: 'دلال' }).first().click();
    await waitDone(page);
    await toResults(page);
    await shot(page, '11_dallah.png');
    await toResults(page, 700);
    await shot(page, '11b_dallah2.png');
  });

  await step('english', async () => {
    await page.selectOption('#langSel', 'en');
    await sleep(1500);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await shot(page, '12_en_top.png');
    await toResults(page);
    await shot(page, '12b_en_results.png');
    await page.selectOption('#langSel', 'ar');
    await sleep(800);
  });

  await step('currency', async () => {
    const opts = await page.evaluate(() => [...document.querySelectorAll('#curSel option')].map(o => o.textContent));
    note('currencies', opts.join(' | '));
  });

  await step('coupons', async () => {
    await page.goto(SITE + 'coupons.html', { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot(page, '13_coupons.png');
    await page.evaluate(() => window.scrollTo(0, 600)); await sleep(500);
    await shot(page, '13b_coupons2.png');
  });

  await step('install', async () => {
    const c2 = await browser.newContext(PHONE);
    await c2.addInitScript(() => { try { localStorage.setItem('qarin.lang', 'ar'); } catch (e) {} });
    const p2 = await c2.newPage();
    await p2.goto(SITE, { waitUntil: 'networkidle' });
    await sleep(3500);
    await shot(p2, '14_install.png');
    const hero = p2.locator('#installHero');
    if (await hero.count() && await hero.isVisible()) { await hero.click(); await sleep(800); await shot(p2, '14b_install_modal.png'); }
    await c2.close();
  });

  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 1));
  await browser.close();
})();
