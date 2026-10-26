// The site-rotation demo must show what the app would show for the same history. This runs the app's own
// rotation and body-map logic (helix/lib/dose-log) on the demo's history in picker.js and fails if the
// page's suggestion, skipped line, switched-off areas, rest window or zone states disagree.
// Run: node --experimental-strip-types scripts/check-sites.mjs   (needs the sibling Peptides repo)
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const helix = path.join(root, '..', 'Peptides', 'helix');
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) {" +
  " if (e.code === 'ERR_MODULE_NOT_FOUND' && s.startsWith('.')) return next(s + '.ts', c); throw e; } }"
));
const lib = (f) => import(pathToFileURL(path.join(helix, 'lib', 'dose-log', f)).href);
const rot = await lib('rotation.ts');
const geo = await lib('bodyGeometry.ts');
const sites = await lib('sites.ts');
const en = JSON.parse(fs.readFileSync(path.join(helix, 'locales', 'en.json'), 'utf8'));

// What the page uses: its own rules module, the same file home.js imports.
const page = await import(pathToFileURL(path.join(root, 'picker.js')).href);
const { USES, NEXT, OFF, REST_HOURS } = page;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// The app's defaults, read from its schema: the enabled site set and the rest window in days.
const schema = fs.readFileSync(path.join(helix, 'db', 'schema.ts'), 'utf8');
const enabledBlock = schema.match(/enabledSites: text\('enabled_sites'\)[\s\S]*?JSON\.stringify\((\[[\s\S]*?\])\)/);
const ENABLED = Function(`return (${enabledBlock[1]})`)();
const WARN_DAYS = Number(schema.match(/rotationWarnDays: integer\('rotation_warn_days'\)\.notNull\(\)\.default\((\d+)\)/)[1]);
const RULE = schema.match(/rotationRule: text\('rotation_rule'\)\.notNull\(\)\.default\('(\w+)'\)/)[1];

const fails = [];
const expect = (ok, msg) => { if (!ok) fails.push(msg); };

expect(REST_HOURS === WARN_DAYS * 24, `rest window: page ${REST_HOURS} h, app default ${WARN_DAYS} days`);
expect(RULE === 'strict', `the page shows the strict rule; the app default is now '${RULE}'`);
const appOff = sites.ROTATION_WHEEL.filter((k) => !ENABLED.includes(k));
expect(JSON.stringify([...OFF].sort()) === JSON.stringify([...appOff].sort()),
  `switched-off areas: page ${OFF.join(',')}, app default ${appOff.join(',')}`);

const anchor = rot.anchorFromRecentUses(USES, ENABLED);
const steer = rot.steerFromAnchor(anchor, ENABLED, USES, REST_HOURS);
if (!steer) { console.error(`the app suggests nothing for this history (anchor ${anchor})`); process.exit(1); }
expect(steer.key === NEXT, `suggestion: page ${NEXT}, app ${steer.key}`);
// The app's formatHoursAgo (db/queries/injectionSiteLog.ts, which needs the database, so not importable here),
// worded from its own catalogue so a change of wording in the app turns this red.
const fmtAgo = (h) => {
  if (h < 1) return en.time.ago.justNow;
  const [n, k] = h < 24 ? [Math.round(h), 'hours'] : [Math.round(h / 24), 'days'];
  return en.time.ago[`${k}_${n === 1 ? 'one' : 'other'}`].replace('{count}', n);
};
for (const h of [0.5, 22, 50, 26]) expect(page.ago(h) === fmtAgo(h), `ago(${h}): page "${page.ago(h)}", app "${fmtAgo(h)}"`);
const skippedLine = en.injectionSites.steerSkipped.replace('{list}',
  steer.skipped.map((s) => `${en.injectionSites.short[s.key]} ${s.hoursAgo != null ? fmtAgo(s.hoursAgo) : ''}`.trim()).join(' · '));
expect(html.includes(`<p class="pick-steer">${skippedLine}</p>`), `skipped line: the app says "${skippedLine}"`);

// Zone states and the warning, picked = each pickable area in turn, against the app's zoneState and rollup.
// The hint under the map, before the script runs, is the app's.
expect(html.includes(`<p class="pick-hint" data-pick-hint>${en.injectionSites.bodyHintFront}</p>`), `hint: the app says "${en.injectionSites.bodyHintFront}"`);
expect(html.includes(`data-view="back"`) && html.includes(`data-hint="${en.injectionSites.bodyHintBack}"`), `back hint: the app says "${en.injectionSites.bodyHintBack}"`);
const keys = [...html.matchAll(/class="zone[^"]*" data-site="([a-z_]+)"/g)].map((m) => m[1]);
expect(keys.length === 14, `expected 14 areas in the body map, found ${keys.length}`);
// The map baked into index.html (scripts/build-body-map.mjs) must start where the script would.
for (const m of html.matchAll(/data-site="([a-z_]+)" data-state="([a-zA-Z]+)"/g)) {
  expect(m[2] === page.zoneState(m[1], NEXT), `index.html: ${m[1]} starts '${m[2]}', picker.js says '${page.zoneState(m[1], NEXT)}' (re-run build-body-map)`);
}
for (const picked of keys.filter((k) => !OFF.includes(k))) {
  const input = { value: picked, suggestion: NEXT, enabled: ENABLED, recentUses: USES, warnHours: REST_HOURS, rule: RULE };
  const appRest = rot.readiness(picked, USES, REST_HOURS);
  const src = rot.rollupSource(picked, USES);
  const warned = page.warning(picked) !== '';
  expect(warned === (appRest.state === 'resting'), `picked ${picked}: page warns ${warned}, app readiness ${appRest.state}`);
  if (warned) {
    const spot = src !== picked && sites.SITE_META[src]?.kind === 'zone' ? ` (${en.injectionSites.zone[src].toLowerCase()} spot)` : '';
    expect(page.warning(picked).startsWith(`This area was used ${fmtAgo(appRest.hoursAgo)}${spot} —`), `picked ${picked}: warning "${page.warning(picked)}"`);
  }
  for (const key of keys) {
    const app = geo.zoneState(key, input);
    const shown = page.zoneState(key, picked);
    expect(app === shown, `picked ${picked}: ${key} is '${shown}' on the page, '${app}' in the app`);
  }
}

if (fails.length) { console.error(fails.join('\n')); console.error(`${fails.length} difference(s)`); process.exit(1); }
console.log(`site picker matches the app: suggestion ${NEXT}, ${keys.length} areas, ${keys.length - OFF.length} pickable, every pick checked`);
