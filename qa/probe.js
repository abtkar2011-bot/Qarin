const fs = require('fs'); const OUT = process.env.OUT || 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const S = { copper: 'https://copperroastery.com', souqalbon: 'https://souqalbon.com', bunalqassab: 'https://www.bunalqassab.com', epanda: 'https://www.epandaom.com', fooh: 'https://fooh.store',
  amouage: 'https://amouage.com', swissarabian: 'https://om.swissarabian.com', asgharali: 'https://om.asgharali.com', omanluxury: 'https://omanluxury.store', alhajis: 'https://alhajisoman.com',
  oudbank: 'https://oudbank.com', boulevard: 'https://boulevardperfumes.com', oudworlds: 'https://oudworlds.com', artal: 'https://artalofficial.com', nawader: 'https://nwaderoud.com',
  alkhanjar: 'https://www.alkhanjar.om', ibraq: 'https://oman.ibraqperfumes.com', almajed: 'https://om.almajed4oud.com', mahaseel: 'https://mahaseelalbon.com', muthalath: 'https://www.muthalathstore.com',
  barista: 'https://barista-oman.kushk.om', rawasi: 'https://www.rawasiom.com', sura: 'https://www.suraroastery.om', yield: 'https://yield-oman.kyte.site', spirithub: 'https://www.spirithubcafe.com' };
const PATHS = ['', '/contact', '/contact-us', '/contactus', '/pages/contact', '/pages/contact-us', '/policies/contact-information', '/ar/contactus', '/ar/contact-us', '/about-us', '/pages/about-us', '/policies/privacy-policy', '/policies/refund-policy'];
const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|sentry|example\.|wixpress|domain\.com|email\.com|yourdomain|@2x|godaddy|u003e|shopify\.com$|cloudflare/i;
(async () => {
  const out = {};
  await Promise.all(Object.entries(S).map(async ([k, B]) => {
    const found = {}; const phones = new Set();
    for (const p of PATHS) {
      try {
        const r = await fetch(B + p, { headers: { 'user-agent': UA, 'accept-language': 'ar,en' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
        if (!r.ok) continue; const t = (await r.text()).replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@');
        for (const m of t.matchAll(/mailto:([^"'?<>\s]+)/gi)) { const e = decodeURIComponent(m[1]).toLowerCase(); if (!BAD.test(e)) (found[e] = found[e] || new Set()).add(p || '/'); }
        for (const m of t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}/g)) { const e = m[0].toLowerCase(); if (!BAD.test(e)) (found[e] = found[e] || new Set()).add(p || '/'); }
        for (const m of t.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{8,15})/g)) phones.add(m[1]);
      } catch (e) { /* skip */ }
    }
    out[k] = { site: B, emails: Object.fromEntries(Object.entries(found).map(([e, s]) => [e, [...s].slice(0, 4)])), whatsapp: [...phones] };
  }));
  fs.writeFileSync(OUT + '/report.json', JSON.stringify(out, null, 1)); fs.writeFileSync(OUT + '/report.txt', 'ok');
  console.log(JSON.stringify(out).slice(0, 3000));
})();
