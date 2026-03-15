import { build as viteBuild } from 'vite';
import { build as esBuild } from 'esbuild';
import { cpSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// --- Icon Generation ---
function createPNG(size, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Generate RGBA pixel data with anti-aliased circle
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);
  const center = size / 2;
  const radius = size * 0.38;

  for (let y = 0; y < size; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 4;
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edge = dist - radius;

      if (edge < -1.0) {
        // Fully inside circle
        const brightness = 1.0 - Math.max(0, (dist / radius - 0.7)) * 0.15;
        raw[px] = Math.round(r * brightness);
        raw[px + 1] = Math.round(g * brightness);
        raw[px + 2] = Math.round(b * brightness);
        raw[px + 3] = 255;
      } else if (edge > 1.0) {
        // Fully outside
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
      } else {
        // Anti-aliased edge
        const alpha = Math.round((1.0 - (edge + 1.0) / 2.0) * 255);
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
        raw[px + 3] = alpha;
      }
    }
  }

  const compressed = deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// --- Main Build ---
async function main() {
  console.log('🔨 Building Signet...\n');

  // Clean dist
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true, force: true });
  }
  mkdirSync(dist, { recursive: true });

  // Generate icons
  console.log('🎨 Generating icons...');
  const iconsDir = resolve(dist, 'icons');
  mkdirSync(iconsDir, { recursive: true });
  for (const size of [16, 48, 128]) {
    const png = createPNG(size, 227, 19, 55); // Hive red #E31337
    writeFileSync(resolve(iconsDir, `icon-${size}.png`), png);
  }

  // Build popup with Vite
  console.log('\n📦 Building popup...');
  await viteBuild({
    configFile: resolve(root, 'vite.config.ts'),
    build: {
      outDir: dist,
      emptyOutDir: false,
    },
  });

  // Common esbuild options
  const commonOptions = {
    bundle: true,
    format: 'iife',
    target: 'chrome100',
    define: {
      global: 'globalThis',
    },
    logLevel: 'info',
  };

  // Build background service worker
  // NOTE: background must NOT include dhive or any eval()-using library
  console.log('\n⚙️  Building background service worker...');
  await esBuild({
    ...commonOptions,
    entryPoints: [resolve(root, 'src/background/index.ts')],
    outfile: resolve(dist, 'background.js'),
  });

  // Build content script
  console.log('\n📝 Building content script...');
  await esBuild({
    ...commonOptions,
    entryPoints: [resolve(root, 'src/content/index.ts')],
    outfile: resolve(dist, 'content.js'),
  });

  // Build inpage script
  console.log('\n🌐 Building inpage script...');
  await esBuild({
    ...commonOptions,
    entryPoints: [resolve(root, 'src/inpage/index.ts')],
    outfile: resolve(dist, 'inpage.js'),
  });

  // Copy manifest
  console.log('\n📋 Copying manifest...');
  cpSync(resolve(root, 'public/manifest.json'), resolve(dist, 'manifest.json'));

  console.log('\n✅ Build complete! Extension is in dist/\n');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
