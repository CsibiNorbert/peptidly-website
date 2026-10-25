#!/usr/bin/env node
// Checks the landing-page calculator (calc.js) against the Peptidly app's own functions, so the site
// can never show a different syringe draw from the app for the same numbers.
//
// Needs the Peptides repo as a sibling of this one, like build-from-content.mjs. Run:
//   node --experimental-strip-types scripts/check-calculator.mjs
// Exits 1 on any difference.
//
// Figure by figure: where a figure's inputs are valid, the site must print what the app's own
// functions compute; where they are not, the site must print nothing (an em dash). The app's calculator
// screen prints something else in those states: zeros, a concentration of 0.00 while the dose is empty,
// or a negative count for a negative vial size. Those display differences are deliberate.

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

const ok = (x) => Number.isFinite(x) && x > 0;

// What the app computes for each figure, using its own functions, or null where the figure's inputs
// are not valid. Doses per vial is the calculator screen's own expression (helix/app/(tabs)/calculator.tsx).
function appFigures(vs, ws, ds) {
  const v = app.parseDecimal(vs), w = app.parseDecimal(ws), d = app.parseDecimal(ds);
  const conc = ok(v) && ok(w) ? app.calculateReconstitution(v, w, 1000).concentrationMgMl : NaN;
  const out = { conc: null, doses: null, units: null, ml: null, pct: null };
  if (ok(conc)) out.conc = conc.toFixed(2);
  if (ok(v) && ok(d)) out.doses = String(Math.floor((v * 1000) / d));
  if (ok(conc) && ok(d)) {
    const r = app.calculateReconstitution(v, w, d);
    if (Number.isFinite(r.syringeUnits)) {
      out.units = ctx.formatDrawToUnits(r.syringeUnits);
      out.ml = r.doseVolumeMl.toFixed(3);
      out.pct = ctx.formatDrawToUnits(Math.min(100, r.syringeUnits));
    }
  }
  return out;
}

function siteFigures(vs, ws, ds) {
  const r = reconstitute(parseDecimal(vs), parseDecimal(ws), parseDecimal(ds));
  return {
    conc: r.conc === null ? null : r.conc.toFixed(2),
    doses: r.dosesPerVial === null ? null : String(r.dosesPerVial),
    units: r.units === null ? null : drawTo(r.units),
    ml: r.volume === null ? null : r.volume.toFixed(3),
    pct: r.units === null ? null : drawTo(Math.min(100, r.units)),
  };
}

const vials = ['0.5', '1', '2', '2.5', '5', '10', '15', '20', '30', '50', '2,5', '1.000,5', '1,000.5', ' 10 '];
const waters = ['0.5', '1', '1.5', '2', '2.5', '3', '5', '0,25'];
const doses = ['25', '50', '100', '125', '250', '300', '333', '500', '617', '750', '1000', '2000', '2500', '5000', '0,5'];
const invalid = ['', '0', '-5', 'abc', '1e999'];

let cases = 0;
const seen = { conc: 0, doses: 0, units: 0, concOnly: 0, dosesOnly: 0 };
const diffs = [];
for (const v of [...vials, ...invalid]) {
  for (const w of [...waters, ...invalid]) {
    for (const d of [...doses, ...invalid]) {
      cases++;
      const a = appFigures(v, w, d);
      const s = siteFigures(v, w, d);
      if (JSON.stringify(a) !== JSON.stringify(s)) diffs.push({ in: [v, w, d], app: a, site: s });
      if (a.conc !== null) seen.conc++;
      if (a.doses !== null) seen.doses++;
      if (a.units !== null) seen.units++;
      if (a.conc !== null && a.doses === null) seen.concOnly++;
      if (a.doses !== null && a.conc === null) seen.dosesOnly++;
    }
  }
}

// Every kind of state must actually have been compared, or a pass means nothing.
for (const [k, n] of Object.entries(seen)) if (n === 0) throw new Error(`no case exercised ${k}`);
if (diffs.length) {
  for (const x of diffs.slice(0, 10)) console.error('DIFF', JSON.stringify(x));
  console.error(`${diffs.length} of ${cases} cases differ from the app`);
  process.exit(1);
}
console.log(`calculator matches the app on all ${cases} cases (${JSON.stringify(seen)})`);
