/* The site-rotation demo's rules, kept apart from the page so scripts/check-sites.mjs can run them against
   the app's own rotation and body-map code (strict rule, default settings). */

// The app's default rest window: three days.
export const REST_HOURS = 72;
// The shoulders are off in the app's default site set.
export const OFF = ['left_delt', 'right_delt'];
// Hours since each area was last used. The last dose went in the lower-right square, so rotation moves on
// to the left thigh; that was used two days ago and is still resting, so it is passed over and the right
// thigh is suggested.
export const USES = { abdomen_lr: 22, left_thigh: 50, left_abdomen: 100, right_glute: 130 };
export const NEXT = 'right_thigh';

// Abdomen squares and their side; the centre squares have none.
const ABDO = { abdomen_ul: 'L', abdomen_uc: null, abdomen_ur: 'R', abdomen_ll: 'L', abdomen_lc: null, abdomen_lr: 'R' };
const SQUARE = {
  abdomen_ul: 'upper left', abdomen_uc: 'upper center', abdomen_ur: 'upper right',
  abdomen_ll: 'lower left', abdomen_lc: 'lower center', abdomen_lr: 'lower right'
};

// The app's formatHoursAgo.
export function ago(h) {
  return h < 1 ? 'just now' : h < 24 ? Math.round(h) + 'h ago' : Math.round(h / 24) + 'd ago';
}

// The app's rollup: inside the abdomen, a square shares skin with the other squares on its side and with
// that side's half; a centre square counts for both sides. Elsewhere an area answers for itself.
function sharedSkin(key) {
  const isAbdo = key in ABDO || key === 'left_abdomen' || key === 'right_abdomen';
  if (!isAbdo) return [key];
  const side = key in ABDO ? ABDO[key] : key === 'left_abdomen' ? 'L' : 'R';
  const sides = side ? [side] : ['L', 'R'];
  const out = [key];
  Object.keys(ABDO).forEach((z) => { if (z !== key && (ABDO[z] === null || sides.includes(ABDO[z]))) out.push(z); });
  sides.forEach((s) => { const half = s === 'L' ? 'left_abdomen' : 'right_abdomen'; if (half !== key) out.push(half); });
  return out;
}

/** The freshest use of this area's skin, and which key it came from. */
export function lastUse(key) {
  let hours = null;
  let source = null;
  sharedSkin(key).forEach((k) => {
    const h = USES[k];
    if (h != null && (hours === null || h < hours)) { hours = h; source = k; }
  });
  return { hours, source };
}

const ownRest = (key) => USES[key] != null && USES[key] < REST_HOURS;

/**
 * The colour state of one area, the app's zoneState: the picked area warns on its shared skin, every other
 * area shows only its own recency.
 */
export function zoneState(key, picked) {
  if (OFF.includes(key)) return 'off';
  if (key === picked) {
    const u = lastUse(key);
    return u.hours !== null && u.hours < REST_HOURS ? 'selWarn' : 'selected';
  }
  if (key === NEXT) return 'suggested';
  return ownRest(key) ? 'resting' : 'idle';
}

/** The warning under the map when the picked area is still resting, or '' (the app's warnBanner, shortened). */
export function warning(picked) {
  const u = lastUse(picked);
  if (u.hours === null || u.hours >= REST_HOURS) return '';
  const spot = u.source !== picked && u.source in ABDO ? ' (' + SQUARE[u.source] + ' spot)' : '';
  return 'This area was used ' + ago(u.hours) + spot + ' — pick another area, or log here anyway.';
}

/** What a screen reader hears for an area besides its name. */
export function describe(key) {
  if (OFF.includes(key)) return ', switched off';
  return (key === NEXT ? ', suggested next' : '') + (ownRest(key) ? ', used ' + ago(USES[key]) : '');
}
