// The site shows no dose. In the app replicas every dose and draw, and the low-stock banner's vial
// size, is a `.mask` chip whose stand-in digits come from CSS (data-d), so no figure is in the text.
// The calculator's dose field starts empty. This fails if a number followed by a dose unit appears in
// any page, script or stylesheet at the site root, or if a mask carries anything but stand-in 8s.
// Run: node scripts/check-no-doses.mjs [file ...]
// ponytail: matches literal text only; a figure built in JS by concatenation (n + ' mcg') gets past it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(root).filter(f => /\.(html|js|css)$/.test(f)).map(f => path.join(root, f));

// Allowed, each once per occurrence:
// - the syringe the draw is read on, and the vial volume the level is drawn against;
// - the hero calculator's example vial label: the visitor's own input, not a dose;
// - a concentration (mg/ml), which describes a mixed vial, not an amount to take;
// - the three unit definitions on the calculator page, exactly as written there (conversions, not amounts).
const ALLOWED = [
  /\b1 ?ml insulin syringe/gi,
  /\b3 ml vial\b/gi,
  /class="vial-label"[^>]*>10 mg</g,
  /\b\d+(?:\.\d+)?(?:\s*<[^>]*>)*\s*mg\s*\/\s*ml\b/gi,
  /\b1 mg = 1,?000 mcg\b/g,
  /\b100 units = 1 ml\b/g,
  /\b1 unit = 0\.01 ml\b/g,
];
const DOSE = /\b\d+(?:[.,]\d+)?\s*(?:mcg|µg|mg|ml|units?|iu|u)\b/gi;
const MASK = /class="mask"([^>]*)>([^<]*)</g;

let bad = 0;
const report = (f, text, i, what) => {
  bad++;
  console.error(`${path.basename(f)}:${text.slice(0, i).split('\n').length}: ${what}`);
};
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  for (const m of raw.matchAll(MASK)) {
    const d = (m[1].match(/data-d="([^"]*)"/) || [])[1];
    if (m[2].trim() !== '' || d === undefined || !/^[8.]+$/.test(d)) report(f, raw, m.index, `mask must be empty with data-d of 8s: ${m[0]}`);
  }
  let text = raw;
  for (const a of ALLOWED) text = text.replace(a, '');
  // In HTML, tags and &nbsp; between a number and its unit must not hide it. Not in scripts: a `<` there is
  // a comparison, and blanking to the next `>` would swallow whole lines.
  if (f.endsWith('.html')) {
    text = text.replace(/<[^>]*>/g, (t) => t.replace(/[^\n]/g, ' ')).replace(/&nbsp;|&#160;/g, '      ');
  }
  for (const m of text.matchAll(DOSE)) report(f, text, m.index, `"${m[0].replace(/\s+/g, ' ')}"`);
}
if (bad) { console.error(`${bad} problem(s) found`); process.exit(1); }
console.log(`no dose figures in ${files.length} file(s)`);
