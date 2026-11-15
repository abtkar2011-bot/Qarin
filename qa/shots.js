// temp: live check — all coffee shown, priorities change best pick, perfume ok
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPad (gen 7)'] });
  await ctx.addInitScript(() => { localStorage.setItem('qarin.lang', 'ar'); localStorage.setItem('qarin.instHide', String(Date.now())); localStorage.setItem('qarin.rated', '1'); });
  const p = await ctx.newPage(); const log = []; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const done = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.status.done') || document.querySelector('.status.warn'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(900); };
  const best = () => p.evaluate(() => ((document.querySelector('.best-card') || {}).innerText || '-').replace(/\s+/g, ' ').slice(0, 130));
  const info = () => p.evaluate(() => ({ head: ((document.querySelector('.cf-head') || {}).innerText || '').replace(/\s+/g, ' '), kinds: ((document.querySelector('.cf-bar .cf-row') || {}).innerText || '').replace(/\s+/g, ' '), more: ((document.querySelector('[data-more]') || {}).innerText || '-').replace(/\s+/g, ' ') }));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#coffee'); await done();
  log.push('## coffee', JSON.stringify(await info()));
  for (const i of [0, 4]) { await p.click(`[data-prio="${i}"]`); await p.waitForTimeout(900); log.push(' prio ' + i + ': ' + await best()); }
  await p.fill('#cfQ', 'بن القصاب'); await p.press('#cfQ', 'Enter'); await done();
  log.push(' bq: ' + JSON.stringify(await info()));
  await p.goto('https://abtkar2011-bot.github.io/Qarin/?v=' + Date.now() + '#perfume'); await done();
  log.push('## perfume', JSON.stringify(await info()));
  for (const i of [0, 4]) { await p.click(`[data-prio="${i}"]`); await p.waitForTimeout(900); log.push(' prio ' + i + ': ' + await best()); }
  try { const cj = await (await fetch('https://abtkar2011-bot.github.io/Qarin/coupons.json?x=' + Date.now())).text(); fs.writeFileSync(OUT + '/coupons.json', cj); log.push('coupons.json ' + cj.length); } catch (e) { log.push('coupons ERR ' + e.message); }

  // Parfumo (TidyTuesday 2024-12-10): تقييمات العطور العالمية → فهرس صغير للماركات اللي نبيعها
  try {
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    const BR = new Set('oriental oud|versace|carolina herrera|meraki|chanel|calvin klein|dior|paco rabanne|giorgio armani|armani|jean paul gaultier|givenchy|guerlain|guess|gucci|yves saint laurent|bvlgari|burberry|dolce gabbana|dolce & gabbana|gabriel denver|charles gilbert|montblanc|mont blanc|parfums de marly|valentino|dunhill|hugo boss|boss|roberto cavalli|hermes|elie saab|lancome|cartier|sultan al khaleeji|penhaligon s|penhaligons|christian di niro|azzaro|lacoste|cristiano ronaldo|davidoff|jimmy choo|armaf|chopard|mugler|thierry mugler|issey miyake|estee lauder|lalique|mancera|mercedes benz|bentley|moschino|narciso rodriguez|memo|memo paris|prada|lattafa|alchemist|aigner|tom ford|reef|coach|xerjoff|cacharel|escada|jaguar|ralph lauren|trussardi|lanvin|joop|baldessarini|carrera|ibrahim al qurashi|rasasi|kilian|by kilian|tommy hilfiger|benetton|elizabeth arden|creed|amouage|dkny|juicy couture|jacques bogart|boucheron|viktor rolf|chloe|kenzo|maison margiela|nishane|britney spears|diesel|missoni|nina ricci|tiziana terenzi|abercrombie fitch|rochas|marc jacobs|orto parisi|byredo|dsquared2|ferrari|cerruti|montale|jennifer lopez|initio|initio parfums prives|maison crivelli|loewe|guy laroche|maison francis kurkdjian|diptyque|nasomatto|lolita lempicka|s t dupont|ted lapidus|escentric molecules|fendi|michael kors|perry ellis|shiseido|swiss arabian|asghar ali|ajmal|arabian oud|al haramain|ard al zaafaran|afnan|abdul samad al qurashi|maison alhambra|rayhaan|le labo|jo malone|frederic malle|editions de parfums frederic malle|clive christian|roja parfums|roja dove|ex nihilo|louis vuitton|bond no 9|zara|al rehab|nabeel|khadlaj|french avenue|fragrance world|paris corner|mark des vince|manzana|mon destin|victor raymond|zenomov|bhpc'.split('|').map(norm));
    const csv = await (await fetch('https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2024/2024-12-10/parfumo_data_clean.csv')).text();
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < csv.length; i++) { const ch = csv[i];
      if (q) { if (ch === '"') { if (csv[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (ch !== '\r') f += ch; }
    const H = rows.shift(); const ix = n => H.indexOf(n);
    const iN = ix('Name'), iB = ix('Brand'), iC = ix('Concentration'), iR = ix('Rating_Value'), iK = ix('Rating_Count'), iY = ix('Release_Year');
    const out = {}; let kept = 0, maxR = 0;
    for (const r of rows) { const b = norm(r[iB]), rv = +r[iR], rc = +r[iK]; if (!BR.has(b) || !(rv > 0) || !(rc >= 5)) continue; maxR = Math.max(maxR, rv);
      const c = /extrait/i.test(r[iC]) ? 'x' : /parfum$|^parfum|perfume$/i.test(r[iC]) && !/eau/i.test(r[iC]) ? 'p' : /eau de parfum/i.test(r[iC]) ? 'edp' : /toilette/i.test(r[iC]) ? 'edt' : /cologne/i.test(r[iC]) ? 'edc' : /oil|attar/i.test(r[iC]) ? 'o' : '';
      (out[b] = out[b] || []).push([norm(r[iN]), Math.round(rv * 10) / 10, rc, c]); kept++; }
    fs.writeFileSync(OUT + '/pfrate.json', JSON.stringify(out));
    log.push('parfumo rows ' + rows.length + ' kept ' + kept + ' brands ' + Object.keys(out).length + ' maxRating ' + maxR + ' bytes ' + JSON.stringify(out).length + ' header ' + H.join(','));
    for (const [b, n] of [['amouage', 'interlude'], ['creed', 'aventus'], ['dior', 'sauvage'], ['lattafa', 'khamrah']]) log.push(' ' + b + ': ' + JSON.stringify((out[b] || []).filter(x => x[0].includes(n)).slice(0, 4)));
  } catch (e) { log.push('parfumo ERR ' + e.message); }

  // علي إكسبريس: هل البحث العربي يرجّع نتائج؟
  for (const q of ['wireless earbuds', 'سماعات لاسلكية', 'عباية سوداء', 'مبخرة كهربائية', 'abaya black']) {
    try { const d = await (await fetch('https://qarin-ebay.abtkar2011.workers.dev/ali?q=' + encodeURIComponent(q))).json(); const it = d.items || []; log.push('ali [' + q + '] ' + it.length + ': ' + it.slice(0, 4).map(x => x.title).join(' ‖ ').slice(0, 300)); }
    catch (e) { log.push('ali [' + q + '] ERR ' + e.message); }
  }
  log.push('errors: ' + JSON.stringify(errs));
  fs.writeFileSync(OUT + '/report.txt', log.join('\n')); console.log(log.join('\n'));
  await b.close();
})();
