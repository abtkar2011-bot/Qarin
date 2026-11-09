// يجرّب ترجمة البحث الذكية في السيرفر الحقيقي (/tr) على بحوث عربية منتشرة
const fs = require('fs');
const API = 'https://qarin-ebay.abtkar2011.workers.dev/tr?q=';
const qs = fs.readFileSync(__dirname + '/natural_ar.txt', 'utf8').trim().split('\n');
(async () => {
  const out = [];
  for (let i = 0; i < qs.length; i += 6) {
    await Promise.all(qs.slice(i, i + 6).map(async q => {
      const t0 = Date.now();
      try { const r = await fetch(API + encodeURIComponent(q)); const d = await r.json(); out.push([q, d.en || ('ERR ' + (d.error || r.status)), d.model || (d.cached ? 'cache' : ''), Date.now() - t0]); }
      catch (e) { out.push([q, 'NETERR ' + e.message, '', Date.now() - t0]); }
    }));
  }
  out.forEach(r => console.log(r.join(' | ')));
  const ok = out.filter(r => !/^(ERR|NETERR)/.test(r[1])).length;
  console.log(JSON.stringify({ total: out.length, ok, avgMs: Math.round(out.reduce((a, r) => a + r[3], 0) / out.length) }));
})();
