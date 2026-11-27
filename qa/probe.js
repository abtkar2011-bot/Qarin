const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const lines = []; const L = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); fs.writeFileSync(OUT + '/report.txt', lines.join('\n')); };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async () => {
  for (const u of ['https://om.opensooq.com/ar/find?term=' + encodeURIComponent('ايفون 15'), 'https://om.opensooq.com/ar/find?have_images=&allposts_cb=true&term=iphone', 'https://om.opensooq.com/ar', 'https://om.opensooq.com/robots.txt']) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ar' }, redirect: 'follow', signal: AbortSignal.timeout(25000) }); const t = await r.text();
      L(u, '→', r.status, r.url, 'len', t.length, '| title:', (t.match(/<title[^>]*>([^<]{0,120})/i) || [])[1] || '', '| cf:', /Just a moment|cf-chl|captcha/i.test(t));
      if (/robots/.test(u)) L(t.slice(0, 1500)); } catch (e) { L(u, 'ERR', e.message); }
  }
})();
