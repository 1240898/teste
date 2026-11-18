import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const bundle = new URL('../dist/', import.meta.url);
const forbidden =
  /\b(?:JWT_SECRET|GOOGLE_CLIENT_SECRET|PGPASSWORD|BOOTSTRAP_MANAGER_PASSWORD)\b|-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;
const files = await readdir(bundle, { recursive: true });
const assets = files.filter((file) => /\.(?:html|js|css|map|json)$/.test(file));

if (!assets.includes('index.html'))
  throw new Error('Build the SPA before scanning the bundle.');

for (const asset of assets) {
  const source = await readFile(
    new URL(asset.replaceAll('\\', '/'), bundle),
    'utf8',
  );
  if (forbidden.test(source))
    throw new Error(`Server-only credential marker in ${join('dist', asset)}.`);
}

console.log(`Checked ${assets.length} public bundle files.`);
