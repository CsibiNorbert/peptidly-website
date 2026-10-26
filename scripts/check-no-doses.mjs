// The page shows no dose: the app replicas mask every amount (see .mask in home.css), and the
// calculator's dose field starts empty. Fails if a number followed by a dose unit appears in the page
// or its script, other than the two allowed phrases below.
// Run: node scripts/check-no-doses.mjs [file ...]
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const files = process.argv.length > 2 ? process.argv.slice(2) : ['index.html', 'home.js'].map(f => path.join(root, f));
// Allowed: the syringe the draw is read on, and the vial volume the level is drawn against.
const ALLOWED = [/\b1 ?ml insulin syringe/gi, /\b3 ml vial\b/gi];
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mcg|µg|mg|ml|units?|iu)\b/gi;

let bad = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  for (const a of ALLOWED) text = text.replace(a, '');
  // The calculator's own vial-size example (value="10" ... mg; the "10 mg" vial label) is a vial, not a dose.
  text = text.replace(/class="vial-label"[^>]*>10 mg</g, '');
  for (const m of text.matchAll(DOSE)) {
    bad++;
    const line = text.slice(0, m.index).split('\n').length;
    console.error(`${path.basename(f)}:${line}: "${m[0]}"`);
  }
}
if (bad) { console.error(`${bad} dose figure(s) found`); process.exit(1); }
console.log(`no dose figures in ${files.length} file(s)`);
