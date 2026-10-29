// Tells Bing (and the other IndexNow engines) that pages changed, instead of waiting for a crawl.
// Run after a deploy is live:  node scripts/indexnow.mjs            (every URL in sitemap.xml)
//                              node scripts/indexnow.mjs /peptide-calculator   (just these paths)
// The key is public by design: IndexNow proves ownership by fetching https://peptidly.co.uk/<key>.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'peptidly.co.uk';
const keyFile = fs.readdirSync(root).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('no IndexNow key file (<32 hex>.txt) at the site root');
const key = keyFile.slice(0, -4);

const args = process.argv.slice(2);
const urlList = args.length
  ? args.map((p) => `https://${HOST}${p.startsWith('/') ? p : '/' + p}`)
  : [...fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const live = await fetch(`https://${HOST}/${keyFile}`);
if (!live.ok || (await live.text()).trim() !== key) throw new Error(`key file not live at https://${HOST}/${keyFile} (${live.status}); deploy first`);

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});
// 200 = accepted, 202 = accepted, key validation pending. Anything else is a failure.
console.log(r.status, r.statusText, `${urlList.length} URL(s):`, urlList.join(' '));
if (r.status !== 200 && r.status !== 202) process.exit(1);
