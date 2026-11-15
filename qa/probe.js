// probe: which small image model finds "the same product" best (camera-like photo → catalogue image)
const { execSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const log = []; const L = (...a) => { const s = a.join(' '); console.log(s); log.push(s); fs.writeFileSync(OUT + '/report.txt', log.join('\n')); };
execSync('npm i --no-save --no-package-lock @huggingface/transformers@3.7.1 sharp@0.33.5', { stdio: 'inherit' });
const sharp = require('sharp');
(async () => {
  const T = await import('@huggingface/transformers');
  T.env.allowLocalModels = false;
  // 1) candidate models: list onnx files + sizes
  const CANDS = ['Xenova/dinov2-small', 'onnx-community/dinov2-small', 'onnx-community/dinov2-small-ONNX', 'Xenova/mobileclip_s0', 'Xenova/clip-vit-base-patch32', 'onnx-community/dinov2-with-registers-small', 'Xenova/dino-vits16', 'Xenova/dino-vitb16', 'onnx-community/mobileclip2-s0', 'Xenova/vit-small-patch16-224'];
  const ok = [];
  for (const id of CANDS) {
    try { const r = await fetch(`https://huggingface.co/api/models/${id}/tree/main/onnx`); if (!r.ok) { L('MODEL', id, 'HTTP', r.status); continue; }
      const files = await r.json(); L('MODEL', id, files.map(f => f.path.replace('onnx/', '') + ':' + Math.round(f.size / 1e6) + 'MB').join(' ')); ok.push([id, files.map(f => f.path)]);
    } catch (e) { L('MODEL', id, 'ERR', e.message); }
  }
  // 2) catalogue: images from the live partner feeds
  const SITE = 'https://abtkar2011-bot.github.io/Qarin/data/p/';
  const stores = ['vperfumes', 'boulevard', 'swissarabian', 'mahaseel', 'souqalbon', 'epanda', 'copper', 'oudworlds', 'alhajis', 'bunalqassab'];
  let items = [];
  for (const k of stores) { try { const d = await (await fetch(SITE + k + '.json')).json(); d.items.slice(0, 40).forEach(it => items.push({ k, t: it[0], img: it[2] })); } catch (e) { L('feed', k, e.message); } }
  L('catalogue items', items.length);
  const bufs = [];
  await Promise.all(items.map(async (it, i) => { try { const r = await fetch(it.img); if (!r.ok) return; const b = Buffer.from(await r.arrayBuffer()); bufs[i] = await sharp(b).flatten({ background: '#ffffff' }).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer(); } catch (e) {} }));
  items = items.map((it, i) => ({ ...it, buf: bufs[i] })).filter(it => it.buf);
  L('downloaded', items.length);
  // camera-like queries: crop, rotate, coloured background, darker, blur, jpeg
  const BG = ['#8a7a66', '#d8d2c8', '#3b3b3b', '#c9b79c', '#e8e4dc'];
  const queries = [];
  for (let i = 0; i < items.length; i += 3) {
    const b = items[i].buf; const m = await sharp(b).metadata();
    const w = Math.round(m.width * 0.82), h = Math.round(m.height * 0.82);
    const crop = await sharp(b).extract({ left: Math.round(m.width * 0.09), top: Math.round(m.height * 0.06), width: w, height: h }).rotate(i % 2 ? 9 : -7, { background: BG[i % 5] }).toBuffer();
    const cm = await sharp(crop).metadata();
    const q = await sharp({ create: { width: cm.width + 160, height: cm.height + 220, channels: 3, background: BG[i % 5] } }).composite([{ input: crop, left: 60, top: 120 }]).modulate({ brightness: 0.85, saturation: 1.1 }).blur(1.2).jpeg({ quality: 70 }).toBuffer();
    queries.push({ i, buf: q });
  }
  fs.writeFileSync(OUT + '/q_example.jpg', queries[0].buf); fs.writeFileSync(OUT + '/c_example.jpg', items[0].buf);
  L('queries', queries.length);
  const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, x => x / s); };
  for (const [id, files] of ok) {
    for (const dtype of (/dinov2-small$|mobileclip_s0/.test(id) ? ['q8', 'fp32'] : ['q8'])) {
      const want = { q8: 'quantized', fp16: 'fp16', fp32: '' }[dtype];
      const vis = files.filter(f => /vision|model/.test(f));
      if (dtype !== 'fp32' && !vis.some(f => f.includes(want))) continue;
      try {
        const t0 = Date.now(); let embed;
        if (/clip/i.test(id)) { const proc = await T.AutoProcessor.from_pretrained(id); const model = await T.CLIPVisionModelWithProjection.from_pretrained(id, { dtype });
          embed = async buf => { const im = await T.RawImage.fromBlob(new Blob([buf])); const o = await model(await proc(im)); return norm(o.image_embeds.data); };
        } else { const pipe = await T.pipeline('image-feature-extraction', id, { dtype });
          embed = async buf => { const im = await T.RawImage.fromBlob(new Blob([buf])); const o = await pipe(im); const d = o.dims; const D = d[d.length - 1]; return norm(o.data.slice(0, D)); }; }
        const tl = Date.now() - t0; const t1 = Date.now();
        const cat = []; for (const it of items) cat.push(await embed(it.buf));
        const per = (Date.now() - t1) / items.length;
        let top1 = 0, top5 = 0; const sims = [];
        for (const q of queries) { const v = await embed(q.buf); const sc = cat.map((c, j) => { let s = 0; for (let x = 0; x < v.length; x++) s += v[x] * c[x]; return [s, j]; }).sort((a, b) => b[0] - a[0]);
          const r = sc.findIndex(s => s[1] === q.i); if (r === 0) top1++; if (r >= 0 && r < 5) top5++; sims.push([sc[0][0], sc[1][0], r]); }
        const avgTrue = sims.filter(s => s[2] === 0).map(s => s[0]); const avgNext = sims.filter(s => s[2] === 0).map(s => s[1]);
        L('RESULT', id, dtype, 'dim', cat[0].length, 'load', tl + 'ms', 'per-img', per.toFixed(0) + 'ms', 'top1', (top1 / queries.length * 100).toFixed(0) + '%', 'top5', (top5 / queries.length * 100).toFixed(0) + '%',
          'simTop', (avgTrue.reduce((a, b) => a + b, 0) / (avgTrue.length || 1)).toFixed(3), 'sim2nd', (avgNext.reduce((a, b) => a + b, 0) / (avgNext.length || 1)).toFixed(3));
      } catch (e) { L('RESULT', id, dtype, 'ERR', e.message.slice(0, 200)); }
    }
  }
  L('done');
})();
