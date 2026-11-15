// temp: search the coffee stores for Arabic/Omani/Turkish coffee to compare with our feeds
const fs = require('fs');
const { parseOdoo, parseWoo } = require('../tools/partners/build.js');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const get = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) }); return await r.text(); } catch (e) { return ''; } };
const log = [];
(async () => {
  const words = ['عمانية', 'عربية', 'تركية', 'omani', 'arabic', 'turkish', 'هيل', 'سعودية'];
  const odoo = [['bunalqassab', 'https://bunalqassab.com'], ['mahaseel', 'https://mahaseelalbon.com'], ['muthalath', 'https://www.muthalathstore.com'], ['epanda', 'https://www.epandaom.com'], ['rawasi', 'https://www.rawasiom.com'], ['sura', 'https://www.suraroastery.om']];
  for (const [k, B] of odoo) for (const w of words) {
    const items = parseOdoo(await get(`${B}/shop?search=${encodeURIComponent(w)}&ppg=200`), B, k);
    if (items.length) log.push(`${k} [${w}] ${items.length}: ` + items.map(x => x.t + ' ' + x.p).join(' ‖ ').slice(0, 600));
  }
  for (const [k, B] of [['souqalbon', 'https://souqalbon.com'], ['copper', 'https://copperroastery.com']]) for (const w of words) {
    let d = []; try { d = JSON.parse(await get(`${B}/wp-json/wc/store/v1/products?per_page=100&search=${encodeURIComponent(w)}`)); } catch (e) { }
    const items = parseWoo(Array.isArray(d) ? d : [], k, /^$/);
    if (Array.isArray(d) && d.length) log.push(`${k} [${w}] ${d.length} (in stock ${items.length}): ` + d.map(x => x.name + (x.is_in_stock ? '' : ' (نفد)')).join(' ‖ ').slice(0, 600));
  }
  for (const w of words) {
    let d = {}; try { d = JSON.parse(await get(`https://fooh.store/search/suggest.json?q=${encodeURIComponent(w)}&resources[type]=product&resources[limit]=10`)); } catch (e) { }
    const ps = (((d.resources || {}).results || {}).products || []);
    if (ps.length) log.push(`fooh [${w}] ${ps.length}: ` + ps.map(x => x.title).join(' ‖ '));
  }
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
})();
