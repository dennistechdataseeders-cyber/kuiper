// frontend/scripts/bundleReport.mjs
// After `npm run build`: what does the first page download, and which chunks are biggest?
//   node scripts/bundleReport.mjs            -> table
//   node scripts/bundleReport.mjs --json     -> JSON (for before/after comparisons)
// "Initial load" = the entry script from dist/index.html plus every chunk it imports
// statically (followed recursively), plus the CSS linked from index.html. Dynamic imports
// (lazy routes, import()) are not counted. Media files referenced by those chunks are listed
// separately because the browser fetches them only when an element renders them.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = path.resolve('dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const sizes = (file) => {
  const buf = fs.readFileSync(path.join(DIST, file));
  return { raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, br: zlib.brotliCompressSync(buf).length };
};
const kb = (n) => (n / 1024).toFixed(1);

const entry = [...html.matchAll(/<script[^>]+type="module"[^>]+src="\/?([^"]+)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+)"/g)].map((m) => m[1]);
const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/?(assets\/[^"]+)"/g)].map((m) => m[1]);

// follow static imports: import ... from "./x.js" / import "./x.js" (not import("./x.js"))
const staticImports = (file) => {
  const src = fs.readFileSync(path.join(DIST, file), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/(?:^|[;\s}])import\s*(?:[\w$*{}\s,]+from\s*)?["']\.\/([^"']+\.js)["']/g)) out.add(path.posix.join(path.posix.dirname(file), m[1]));
  for (const m of src.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)) out.add(path.posix.join(path.posix.dirname(file), m[1]));
  return [...out];
};
const initial = new Set();
const queue = [...entry, ...preloads];
while (queue.length) {
  const f = queue.shift();
  if (initial.has(f) || !fs.existsSync(path.join(DIST, f))) continue;
  initial.add(f);
  queue.push(...staticImports(f));
}

const initialJs = [...initial].map((f) => ({ file: f, ...sizes(f) }));
const initialCss = css.map((f) => ({ file: f, ...sizes(f) }));
const sum = (list, k) => list.reduce((a, x) => a + x[k], 0);

// media referenced by initial chunks
const media = new Set();
for (const f of initial) {
  const src = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of src.matchAll(/["'`]\/?(assets\/[^"'`]+\.(?:mp4|webm|png|jpe?g|webp|svg|gif))["'`]/g)) media.add(m[1]);
}
const mediaList = [...media].filter((f) => fs.existsSync(path.join(DIST, f))).map((f) => ({ file: f, raw: fs.statSync(path.join(DIST, f)).size }));
const publicImages = fs.existsSync(path.join(DIST, 'images'))
  ? fs.readdirSync(path.join(DIST, 'images')).map((f) => ({ file: `images/${f}`, raw: fs.statSync(path.join(DIST, 'images', f)).size }))
  : [];

const allJs = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js')).map((f) => ({ file: `assets/${f}`, ...sizes(`assets/${f}`) }));
const top10 = [...allJs].sort((a, b) => b.raw - a.raw).slice(0, 10);

const report = {
  initial: {
    jsFiles: initialJs.length, cssFiles: initialCss.length, requests: initialJs.length + initialCss.length,
    jsRaw: sum(initialJs, 'raw'), jsGzip: sum(initialJs, 'gzip'), jsBr: sum(initialJs, 'br'),
    cssRaw: sum(initialCss, 'raw'), cssGzip: sum(initialCss, 'gzip'),
  },
  totalJsChunks: allJs.length, totalJsRaw: sum(allJs, 'raw'),
  top10: top10.map((c) => ({ file: path.basename(c.file), raw: c.raw, gzip: c.gzip, initial: initial.has(c.file) })),
  mediaFromInitialChunks: mediaList, publicImages,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const i = report.initial;
  console.log(`Initial load: ${i.jsFiles} JS + ${i.cssFiles} CSS = ${i.requests} requests`);
  console.log(`  JS : ${kb(i.jsRaw)} KB raw | ${kb(i.jsGzip)} KB gzip | ${kb(i.jsBr)} KB brotli`);
  console.log(`  CSS: ${kb(i.cssRaw)} KB raw | ${kb(i.cssGzip)} KB gzip`);
  console.log(`All JS chunks: ${report.totalJsChunks} files, ${kb(report.totalJsRaw)} KB raw`);
  console.log('\nTop 10 chunks:');
  console.table(report.top10.map((c) => ({ chunk: c.file, 'raw KB': kb(c.raw), 'gzip KB': kb(c.gzip), 'in initial load': c.initial ? 'yes' : 'no' })));
  if (mediaList.length) { console.log('Media referenced by initial chunks:'); mediaList.forEach((m) => console.log(`  ${m.file}  ${kb(m.raw)} KB`)); }
  if (publicImages.length) { console.log('public/images:'); publicImages.forEach((m) => console.log(`  ${m.file}  ${kb(m.raw)} KB`)); }
}
