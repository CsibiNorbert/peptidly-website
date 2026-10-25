// Reconstitution arithmetic for the landing page, ported from the Peptidly app so the site shows exactly
// what the app shows:
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

// Missing or non-positive inputs give null where the app shows zeros: the site prints an em dash.
export function reconstitute(vialMg, waterMl, doseMcg) {
  const conc = positive(vialMg) && positive(waterMl) ? vialMg / waterMl : NaN;
  if (!positive(conc)) return { conc: null, volume: null, units: null, dosesPerVial: null };
  if (!positive(doseMcg)) return { conc, volume: null, units: null, dosesPerVial: null };
  const volume = doseMcg / 1000 / conc;
  return { conc, volume, units: volume * 100, dosesPerVial: Math.floor((vialMg * 1000) / doseMcg) };
}
