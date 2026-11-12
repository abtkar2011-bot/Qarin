// لقطات فيديو التصميم الجديد + خط Almarai
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEV = { ...devices['iPhone 14 Pro'], deviceScaleFactor: 2, locale: 'ar-OM' };
const FAKE_SR = mode => {
  class FakeSR {
    start() {
      const mk = (t, fin) => { const r = [{ transcript: t }]; r.isFinal = fin; return r; };
      setTimeout(() => this.onresult && this.onresult({ results: [mk('سماعات', false)] }), 400);
      setTimeout(() => this.onresult && this.onresult({ results: [mk('سماعات لاسلكية', false)] }), 900);
      if (window.__srEnd) setTimeout(() => { this.onresult && this.onresult({ results: [mk('سماعات لاسلكية', true)] }); this.onend && this.onend(); }, 4500);
    }
    stop() { this.onend && this.onend(); } abort() {}
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = undefined; window.__srEnd = true;
};
(async () => {
  // الخط
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800')).text();
    fs.writeFileSync(path.join(OUT, 'fonts', 'almarai.css'), css);
    const re = /font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g; let m, n = 0;
    while ((m = re.exec(css))) { const buf = Buffer.from(await (await fetch(m[2])).arrayBuffer()); const ext = m[2].split('.').pop().split('?')[0]; fs.writeFileSync(path.join(OUT, 'fonts', `Almarai-${m[1]}-${n++}.${ext}`), buf); }
  } catch (e) { fs.writeFileSync(path.join(OUT, 'fonts', 'error.txt'), String(e)); }
  const b = await chromium.launch();
  const ctxFor = async theme => {
    const ctx = await b.newContext({ ...DEV, colorScheme: theme });
    await ctx.addInitScript(FAKE_SR);
    await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.removeItem('qarin.theme'); });
    return ctx;
  };
  for (const theme of ['light', 'dark']) {
    const ctx = await ctxFor(theme); const p = await ctx.newPage();
    await p.goto(SITE + '?v=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await sleep(4000);
    await p.screenshot({ path: path.join(OUT, `home_${theme}.png`) });
    if (theme === 'light') {
      await p.click('#micBtn'); await sleep(1600);
      await p.screenshot({ path: path.join(OUT, 'voice_listening.png') });
      await p.waitForFunction(() => /✓/.test(document.getElementById('status').innerText), null, { timeout: 60000 }).catch(() => {});
      await sleep(3000);
      await p.evaluate(() => Promise.all([...document.images].filter(i => i.getBoundingClientRect().top < 4000).map(i => i.decode().catch(() => {}))));
      await sleep(1500);
      await p.screenshot({ path: path.join(OUT, 'results_top.png') });
      await p.evaluate(() => { const e = document.querySelector('.best-card'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 16); }); await sleep(1500);
      await p.screenshot({ path: path.join(OUT, 'results_best.png') });
      await p.evaluate(() => { const e = document.querySelector('.grid'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 16); }); await sleep(2500);
      await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
      await p.screenshot({ path: path.join(OUT, 'results_grid.png') });
      await p.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
      await p.screenshot({ path: path.join(OUT, 'results_full.png'), fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
})();
