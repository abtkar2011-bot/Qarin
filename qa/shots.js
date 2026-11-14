// نسحب ملفات المتاجر الشريكة من الموقع الحقيقي لتحليل العناوين
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://abtkar2011-bot.github.io/Qarin/';
(async () => {
  for (const f of ['vperfumes.json', 'dermazone.json', 'index.json']) {
    const r = await fetch(SITE + 'data/p/' + f + '?v=' + Date.now());
    fs.writeFileSync(path.join(OUT, f), Buffer.from(await r.arrayBuffer())); console.log(f, r.status);
  }
})();
