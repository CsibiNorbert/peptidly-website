#!/usr/bin/env node
// Checks the landing-page calculator (calc.js) against the Peptidly app's own functions, so the site
// can never show a different syringe draw from the app for the same numbers.
//
// Needs the Peptides repo as a sibling of this one, like build-from-content.mjs. Run:
//   node --experimental-strip-types scripts/check-calculator.mjs
// Exits 1 on any difference.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { parseDecimal, drawTo, reconstitute } from '../calc.js';

const helix = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'Peptides', 'helix');
const app = {
  ...(await import(pathToFileURL(resolve(helix, 'services', 'reconstitution.ts')).href)),
  ...(await import(pathToFileURL(resolve(helix, 'lib', 'parseDecimal.ts')).href)),
};

// doseDisplay.ts imports other TypeScript without extensions, which Node cannot load directly,
// so its two display functions are taken from the source and run as written.
const display = readFileSync(resolve(helix, 'lib', 'dose', 'doseDisplay.ts'), 'utf8');
const fns = ['formatSyringeUnits', 'formatDrawToUnits'].map((name) => {
  const m = display.match(new RegExp(`export function ${name}\\(units: number\\): string \\{[\\s\\S]*?\\r?\\n\\}`));
  if (!m) throw new Error(`${name} not found in doseDisplay.ts; update this check`);
  return m[0].replace('export ', '').replace('(units: number): string', '(units)');
});
const ctx = {};
vm.runInNewContext(`${fns.join('\n')}\nthis.formatDrawToUnits = formatDrawToUnits;`, ctx);

// The calculator screen (helix/app/(tabs)/calculator.tsx): non-positive input gives an all-zero result.
function appScreen(vs, ws, ds) {
  const v = app.parseDecimal(vs) || 0, b = app.parseDecimal(ws) || 0, d = app.parseDecimal(ds) || 0;
  if (v <= 0 || b <= 0 || d <= 0) return null;
  const r = app.calculateReconstitution(v, b, d);
  return {
    units: ctx.formatDrawToUnits(r.syringeUnits),
    ml: r.doseVolumeMl.toFixed(3),
    pct: ctx.formatDrawToUnits(Math.min(100, r.syringeUnits)),
    conc: r.concentrationMgMl.toFixed(2),
    doses: String(Math.floor((v * 1000) / d)),
  };
}

function site(vs, ws, ds) {
  const r = reconstitute(parseDecimal(vs), parseDecimal(ws), parseDecimal(ds));
  if (r.units === null) return null;
  return {
    units: drawTo(r.units),
    ml: r.volume.toFixed(3),
    pct: drawTo(Math.min(100, r.units)),
    conc: r.conc.toFixed(2),
    doses: String(r.dosesPerVial),
  };
}

const vials = ['0.5', '1', '2', '2.5', '5', '10', '15', '20', '30', '50', '2,5', '1.000,5', ' 10 '];
const waters = ['0.5', '1', '1.5', '2', '2.5', '3', '5', '0,25'];
const doses = ['25', '50', '100', '125', '250', '300', '333', '500', '617', '750', '1000', '2000', '2500', '5000', '0,5'];
const invalid = ['', '0', '-5', 'abc'];

let cases = 0;
const diffs = [];
for (const v of [...vials, ...invalid]) {
  for (const w of [...waters, ...invalid]) {
    for (const d of [...doses, ...invalid]) {
      cases++;
      const a = appScreen(v, w, d);
      const s = site(v, w, d);
      if (JSON.stringify(a) !== JSON.stringify(s)) diffs.push({ in: [v, w, d], app: a, site: s });
    }
  }
}

if (cases < 1000) throw new Error(`only ${cases} cases ran`);
if (diffs.length) {
  for (const x of diffs.slice(0, 10)) console.error('DIFF', JSON.stringify(x));
  console.error(`${diffs.length} of ${cases} cases differ from the app`);
  process.exit(1);
}
console.log(`calculator matches the app on all ${cases} cases`);
