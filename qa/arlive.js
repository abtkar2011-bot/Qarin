// بحث عربي حقيقي على الموقع المنشور: يطبع الترجمة وأول النتائج
const { chromium, devices } = require('playwright');
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const QS = (process.env.QS || 'مساحات سيارة|زينة سيارة|سماعات ابل|كفر ايفون 15 شفاف|كيبورد ميكانيكي|حلوى عمانية|زيت محرك|لعبة سيارة|ساعة ذكية|شاحن ايفون').split('|');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro Max'], locale: 'ar-OM', timezoneId: 'Asia/Muscat' });
  await ctx.addInitScript(() => { try { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = []; p.on('request', r => { const u = r.url(); if (/workers\.dev\/(tr|\?q=|etsy)/.test(u)) calls.push(decodeURIComponent(u)); });
  await p.goto(SITE + '?qa=1&v=' + Date.now(), { waitUntil: 'load' }); await p.waitForFunction(() => !!window.__qa);
  for (const q of QS) {
    const t0 = Date.now(), c0 = calls.length;
    await p.evaluate(async q => { await window.__qa.search(q, true); for (let k = 0; k < 600 && window.__qa.state.loading; k++) await new Promise(r => setTimeout(r, 50)); }, q);
    const r = await p.evaluate(() => ({ n: window.__qa.state.products.length, top: window.__qa.state.products.slice(0, 5).map(x => x.platform.slice(0, 4) + ' ' + x.title.slice(0, 70)) }));
    const ebay = calls.slice(c0).find(u => /\?q=/.test(u) && !/\/tr\?/.test(u)) || '';
    console.log('==', q, '→', (ebay.split('?q=')[1] || '').split('&')[0], '|', r.n, 'results |', Date.now() - t0, 'ms', calls.slice(c0).some(u => /\/tr\?/.test(u)) ? '(AI)' : '(dictionary)');
    r.top.forEach(t => console.log('    ', t));
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
