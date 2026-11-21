// Build a standalone benchmark in a temporary directory. Serve that directory
// over loopback HTTP and open index.html in a foreground WebGL browser.
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const repo = path.dirname(path.resolve(frontend));
const assets = path.join(repo, 'backend/assets/kitchen');
const out = await mkdtemp(path.join(tmpdir(), 'laprizza-materials-'));
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

// Shipped models contain one internal buffer. Drop only image buffer views,
// keeping the geometry, material factors, hierarchy and vertex data identical.
function withoutImages(glb) {
  const jsonLength = glb.readUInt32LE(12);
  const doc = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
  if (!doc.images?.length) return glb;
  const data = glb.subarray(28 + jsonLength);
  const images = new Set(doc.images.map((image) => image.bufferView));
  const views = [];
  const remap = new Map();
  const chunks = [];
  let offset = 0;
  doc.bufferViews.forEach((view, index) => {
    if (images.has(index)) return;
    const length = (view.byteLength + 3) & ~3;
    const start = view.byteOffset ?? 0;
    chunks.push(data.subarray(start, start + length));
    remap.set(index, views.length);
    views.push({ ...view, byteOffset: offset });
    offset += length;
  });
  doc.bufferViews = views;
  doc.buffers[0].byteLength = offset;
  for (const accessor of doc.accessors)
    accessor.bufferView = remap.get(accessor.bufferView);
  for (const material of doc.materials) {
    delete material.normalTexture;
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
  delete doc.images;
  delete doc.textures;
  delete doc.samplers;
  const json = Buffer.from(JSON.stringify(doc));
  const jsonSize = (json.length + 3) & ~3;
  const header = Buffer.from(glb.subarray(0, 20));
  header.writeUInt32LE(28 + jsonSize + offset, 8);
  header.writeUInt32LE(jsonSize, 12);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(offset);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([
    header,
    json,
    Buffer.alloc(jsonSize - json.length, 32),
    binaryHeader,
    ...chunks,
  ]);
}

await build({
  configFile: false,
  root: frontend,
  logLevel: 'warn',
  build: {
    outDir: out,
    lib: {
      entry: path.join(frontend, 'test/performance/kitchenMaterialsProfile.js'),
      name: 'KitchenProfile',
      formats: ['iife'],
      fileName: () => 'profile.js',
    },
  },
});
const { assets: manifest } = await readJson(path.join(assets, 'manifest.json'));
for (const folder of ['assets', 'bare']) await mkdir(path.join(out, folder));
for (const layout of ['compact', 'extended']) {
  const content = await readJson(
    path.join(
      repo,
      'docs/user_stories/web06/samples/kitchen-' + layout + '.json',
    ),
  );
  const ids = new Set(
    JSON.stringify(content).match(/AST-(?:MDL|TEX)-[A-Z0-9-]+/g),
  );
  const entries = {};
  for (const { id, kind, format, path: source } of manifest.filter((item) =>
    ids.has(item.id),
  )) {
    const filename = id + '.' + format;
    await copyFile(
      path.join(assets, 'files', source),
      path.join(out, 'assets', filename),
    );
    if (kind === 'MODEL')
      await writeFile(
        path.join(out, 'bare', filename),
        withoutImages(await readFile(path.join(assets, 'files', source))),
      );
    entries[id] = { kind, format, filename };
  }
  await writeFile(
    path.join(out, layout + '.json'),
    JSON.stringify({
      id: 'KCF-00001',
      name: layout,
      status: 'ACTIVE',
      version: 1,
      content,
      assets: entries,
    }),
  );
}
await writeFile(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>VIS04 material profile</title>
<style>body{font:16px system-ui}#host{width:640px;height:360px}canvas{width:100%;height:100%}pre{white-space:pre-wrap}</style>
<h1>Kitchen material profile</h1><div id="host"></div><pre id="results">Running…</pre><script src="profile.js"></script>`,
);
console.log(out);
