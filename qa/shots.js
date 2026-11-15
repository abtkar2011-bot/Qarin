// temp: download live coffee store feeds
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out';
fs.mkdirSync(OUT, { recursive: true });
const ks = ['copper','bunalqassab','spirithub','souqalbon','epanda','rawasi','yield','sura','fooh','mahaseel','muthalath','barista','index'];
(async () => {
  for (const k of ks) {
    try { const r = await fetch('https://abtkar2011-bot.github.io/Qarin/data/p/' + k + '.json?x=' + Date.now()); const t = await r.text(); fs.writeFileSync(OUT + '/' + k + '.json', t); console.log(k, r.status, t.length); }
    catch (e) { console.log(k, 'ERR', e.message); }
  }
})();
