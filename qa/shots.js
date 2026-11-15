// temp: build perfume store feeds and publish them for review
const { spawnSync } = require('child_process');
const OUT = process.env.OUT || 'shots-out';
const r = spawnSync('node', ['tools/partners/build.js', OUT], { stdio: 'inherit', env: Object.assign({}, process.env, { ONLY: 'amouage,swissarabian,asgharali,omanluxury,alhajis,oudbank,boulevard,oudworlds' }), timeout: 25 * 60 * 1000 });
console.log('exit', r.status);
