// frontend/scripts/precompress.mjs
// Runs after `vite build` (see "build" in package.json). Writes a .gz and a .br copy next to
// every text asset in dist/ so Nginx can send them as-is (gzip_static / brotli_static)
// instead of compressing on every request. Files under 1 KB are skipped.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// folder to compress: argument, or dist/ (deploy/deploy.sh passes the release folder)
const DIST = path.resolve(process.argv[2] || 'dist');
const EXT = /\.(js|mjs|css|html|svg|json|txt|xml|map)$/i;
const MIN = 1024;

let files = 0;
let raw = 0;
let gz = 0;
let br = 0;

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!EXT.test(entry.name)) continue;
    const buf = fs.readFileSync(p);
    if (buf.length < MIN) continue;
    const g = zlib.gzipSync(buf, { level: 9 });
    const b = zlib.brotliCompressSync(buf, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    });
    fs.writeFileSync(`${p}.gz`, g);
    fs.writeFileSync(`${p}.br`, b);
    files += 1; raw += buf.length; gz += g.length; br += b.length;
  }
};

if (!fs.existsSync(DIST)) {
  console.error('precompress: dist/ not found - run vite build first');
  process.exit(1);
}
walk(DIST);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`precompress: ${files} files, ${kb(raw)} -> ${kb(gz)} gzip / ${kb(br)} brotli`);
