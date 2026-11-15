// temp: full build of all perfume stores (timing + counts)
const { spawnSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const r = spawnSync('node', ['tools/partners/build.js', OUT], { stdio: 'inherit', env: Object.assign({}, process.env, { ONLY: 'amouage,swissarabian,asgharali,omanluxury,alhajis,oudbank,boulevard,oudworlds,raydan,ibraq,almajed,artal,nawader,alkhanjar' }), timeout: 28 * 60 * 1000 });
fs.writeFileSync(OUT + '/probe.txt', 'exit ' + r.status + ' seconds ' + Math.round((Date.now() - t0) / 1000));
console.log('exit', r.status, 'seconds', Math.round((Date.now() - t0) / 1000));
