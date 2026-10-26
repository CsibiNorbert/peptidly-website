// Reconstitution arithmetic for the landing page, ported from the Peptidly app so the site computes what
// the app computes:
//   parseDecimal  <- helix/lib/parseDecimal.ts
//   reconstitute  <- helix/services/reconstitution.ts, plus the calculator screen's doses-per-vial
//   drawTo        <- formatDrawToUnits in helix/lib/dose/doseDisplay.ts
// scripts/check-calculator.mjs runs these against the app's own functions; run it after any change here.

// A comma or a dot may be the decimal separator; with both, the last one is.
export function parseDecimal(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return NaN;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  let n;
  if (lastComma !== -1 && lastDot !== -1) {
    n = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma !== -1) {
    n = t.replace(',', '.').replace(/,/g, '');
  } else {
    n = t;
  }
  return parseFloat(n);
}

export const positive = (x) => Number.isFinite(x) && x > 0;

// Syringe units to tenths, without a trailing ".0".
export function drawTo(units) {
  const tenths = units.toFixed(1);
  return tenths.endsWith('.0') ? tenths.slice(0, -2) : tenths;
}

// Each figure needs only its own inputs: concentration needs the vial and the water, doses per vial
// the vial and the dose, the draw all three. A figure whose inputs are missing, not positive or not
// finite is null, and the page prints an em dash. (The app's screen shows 0 for the draw and the
// concentration whenever any input is missing; wherever a figure's inputs are valid and the result is
// finite, it matches the app.)
export function reconstitute(vialMg, waterMl, doseMcg) {
  const ratio = positive(vialMg) && positive(waterMl) ? vialMg / waterMl : NaN;
  const conc = positive(ratio) ? ratio : null;
  const dosesPerVial = positive(vialMg) && positive(doseMcg) ? Math.floor((vialMg * 1000) / doseMcg) : null;
  if (conc === null || !positive(doseMcg)) return { conc, dosesPerVial, volume: null, units: null };
  const volume = doseMcg / 1000 / conc;
  return { conc, dosesPerVial, volume, units: volume * 100 };
}
