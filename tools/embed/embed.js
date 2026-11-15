// قارِن — «بصمة شكل» لكل صورة منتج في المتاجر الشريكة، للبحث بنفس الشكل.
// كل صورة تتحول لأرقام (نموذج صور صغير)، والموقع يقارن صورة الزبون بهذي الأرقام في جواله.
//   node tools/embed/embed.js <partners> <cache> <out>
//   ← out/pe/<متجر>.bin  (صف لكل منتج بنفس ترتيب data/p/<متجر>.json، أرقام int8)
//   ← out/pe/index.json  (النموذج وعدد المنتجات)
//   ← out/models/<النموذج>/  (ملفات النموذج نفسه، عشان الموقع يحمّلها من عندنا)
// الصور اللي انحسبت قبل تنحفظ في <cache> وما تنعاد.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , PARTNERS = 'partners', CACHE = 'embcache', OUT = 'embout'] = process.argv;
const MODEL = process.env.EMB_MODEL || 'Xenova/dinov2-small';
const DTYPE = process.env.EMB_DTYPE || 'q8';
const MAX_MIN = +(process.env.EMB_MAX_MIN || 35);   // بعدها نوقف ونكمّل في التشغيل الجاي
const SIDE = 320;                                    // نفس المقاس اللي يصغّر له الموقع صورة الزبون
const t0 = Date.now();
const log = (...a) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

(async () => {
  const sharp = require('sharp');
  const T = await import('@huggingface/transformers');
  T.env.allowLocalModels = false;
  T.env.cacheDir = path.resolve(__dirname, '.models');
  const isClip = /clip/i.test(MODEL);
  let embedRaw;
  if (isClip) {
    const proc = await T.AutoProcessor.from_pretrained(MODEL);
    const model = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: DTYPE });
    embedRaw = async im => (await model(await proc(im))).image_embeds.data;
  } else {
    const pipe = await T.pipeline('image-feature-extraction', MODEL, { dtype: DTYPE });
    embedRaw = async im => { const o = await pipe(im); const D = o.dims[o.dims.length - 1]; return o.data.slice(0, D); };  // توكن CLS
  }
  log('model ready', MODEL, DTYPE);

  // ---- المحفوظ من قبل ----
  fs.mkdirSync(CACHE, { recursive: true });
  const cmeta = (() => { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'cache.json'), 'utf8')); } catch (e) { return null; } })();
  const cache = new Map();
  let DIM = 0;
  if (cmeta && cmeta.model === MODEL + ':' + DTYPE) {
    const buf = fs.readFileSync(path.join(CACHE, 'cache.bin')); DIM = cmeta.dim;
    cmeta.keys.forEach((k, i) => cache.set(k, new Int8Array(buf.buffer, buf.byteOffset + i * DIM, DIM)));
  }
  log('cached prints', cache.size);

  const q8 = v => { let m = 0; for (const x of v) m = Math.max(m, Math.abs(x)); const s = m ? 127 / m : 0; return Int8Array.from(v, x => Math.round(x * s)); };
  const key = u => crypto.createHash('sha1').update(String(u)).digest('base64').slice(0, 16);
  async function prep(url) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Qarin image prints)', Accept: 'image/*' } });
      if (!r.ok) return null;
      const b = Buffer.from(await r.arrayBuffer());
      return await sharp(b).flatten({ background: '#ffffff' }).resize(SIDE, SIDE, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
    } catch (e) { return null; } finally { clearTimeout(tm); }
  }
  async function embed(buf) { const im = await T.RawImage.fromBlob(new Blob([buf])); return q8(await embedRaw(im)); }
  // النموذج يشتغل على صورة وحدة كل مرة (التحميل بس هو اللي يمشي مع بعض)
  let chain = Promise.resolve();
  const embedOne = buf => { const p = chain.then(() => embed(buf)); chain = p.catch(() => {}); return p; };

  const stores = fs.readdirSync(PARTNERS).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5)).sort();
  fs.mkdirSync(path.join(OUT, 'pe'), { recursive: true });
  const index = { model: MODEL, dtype: DTYPE, side: SIDE, dim: 0, v: new Date().toISOString().slice(0, 16), stores: {} };
  const used = new Map();
  let made = 0, failed = 0, stopped = false;
  for (const k of stores) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(PARTNERS, k + '.json'), 'utf8')); } catch (e) { continue; }
    if (!d || !Array.isArray(d.items)) continue;
    const urls = d.items.map(it => it[2]);
    const todo = [...new Set(urls.filter(u => u && !cache.has(key(u))))];
    // نحمّل الصور ١٢ مع بعض، ونحسب البصمة وحدة وحدة
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        if ((Date.now() - t0) / 60000 > MAX_MIN) { stopped = true; return; }
        const u = todo[next++]; const buf = await prep(u);
        if (!buf) { failed++; continue; }
        try { const v = await embedOne(buf); if (!DIM) DIM = v.length; cache.set(key(u), v); made++; } catch (e) { failed++; }
        if (made && made % 250 === 0) log('prints made', made);
      }
    };
    await Promise.all(Array.from({ length: 12 }, worker));
    if (!DIM) continue;
    const out = new Int8Array(urls.length * DIM); let ok = 0;
    urls.forEach((u, i) => { const v = u && cache.get(key(u)); if (v) { out.set(v, i * DIM); used.set(key(u), v); ok++; } });
    fs.writeFileSync(path.join(OUT, 'pe', k + '.bin'), Buffer.from(out.buffer));
    index.stores[k] = { n: urls.length, ok };
    log(k, urls.length, 'items,', ok, 'with prints');
  }
  index.dim = DIM;
  fs.writeFileSync(path.join(OUT, 'pe', 'index.json'), JSON.stringify(index));
  // نحفظ بس البصمات المستخدمة الحين (الصور اللي انشالت من المتاجر تنمسح)
  const keys = [...used.keys()], all = new Int8Array(keys.length * DIM);
  keys.forEach((k, i) => all.set(used.get(k), i * DIM));
  fs.writeFileSync(path.join(CACHE, 'cache.bin'), Buffer.from(all.buffer));
  fs.writeFileSync(path.join(CACHE, 'cache.json'), JSON.stringify({ model: MODEL + ':' + DTYPE, dim: DIM, keys }));
  // ملفات النموذج ← out/models/<النموذج>/ (الموقع يحمّلها من عندنا بدل Hugging Face)
  const src = path.join(T.env.cacheDir, MODEL), dst = path.join(OUT, 'models', MODEL);
  if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.cpSync(src, dst, { recursive: true }); }
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  if (fs.existsSync(dst)) walk(dst).forEach(f => log('model file', path.relative(OUT, f), Math.round(fs.statSync(f).size / 1e5) / 10 + 'MB'));
  log('done: new', made, 'failed', failed, stopped ? '(time limit, will continue next run)' : '', 'total stores', Object.keys(index.stores).length);
})().catch(e => { console.error(e); process.exit(1); });
