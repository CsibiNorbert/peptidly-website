// Writes the injection-site body map into index.html, between the body-map markers, from the app's own
// geometry (helix/lib/dose-log/bodyGeometry.ts) and drawing (helix/components/dose-log/BodyMap.tsx,
// "depth" register, as the dose sheet shows it). Re-run after the app's map changes:
//   node --experimental-strip-types scripts/build-body-map.mjs
// It needs the sibling Peptides repo, like check-calculator.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const helix = path.join(root, '..', 'Peptides', 'helix');

// The app imports its TypeScript without extensions (Metro resolves them); Node does not.
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) {" +
  " if (e.code === 'ERR_MODULE_NOT_FOUND' && s.startsWith('.')) return next(s + '.ts', c); throw e; } }"
));
const g = await import(pathToFileURL(path.join(helix, 'lib', 'dose-log', 'bodyGeometry.ts')).href);
const s = await import(pathToFileURL(path.join(helix, 'lib', 'dose-log', 'sites.ts')).href);
// The demo's first state (the suggestion picked), so the map is right before any script runs.
const demo = await import(pathToFileURL(path.join(root, 'picker.js')).href);
const en = JSON.parse(fs.readFileSync(path.join(helix, 'locales', 'en.json'), 'utf8')).injectionSites;

const n = (v) => String(Math.round(v * 100) / 100);
const zone = (key, sh, label) => {
  // One tappable area. The badge is drawn for every area and shown only on the suggested one.
  const bw = Math.max(30, 12 + en.next.length * 5.2);
  const cx = sh.x + sh.w / 2;
  const next = key === demo.NEXT ? ' is-next' : '';
  return `<g class="zone${next}" data-site="${key}" data-state="${demo.zoneState(key, demo.NEXT)}" aria-label="${label}">` +
    `<rect x="${n(sh.x)}" y="${n(sh.y)}" width="${n(sh.w)}" height="${n(sh.h)}" rx="${sh.r}"/>` +
    `<g class="badge" aria-hidden="true"><rect x="${n(cx - bw / 2)}" y="${n(sh.y - 7)}" width="${n(bw)}" height="13" rx="6.5"/>` +
    `<text x="${n(cx)}" y="${n(sh.y + 2.5)}" text-anchor="middle">${en.next}</text></g></g>`;
};

const DEFS = (id) => `<defs>
  <linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26405F"/><stop offset=".55" stop-color="#1A2E49"/><stop offset="1" stop-color="#13233A"/></linearGradient>
  <radialGradient id="${id}-hi" cx=".5" cy=".3" r=".65"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-lo" cx=".5" cy=".7" r=".65"><stop offset="0" stop-color="#040A14" stop-opacity=".5"/><stop offset="1" stop-color="#040A14" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="${id}-mask"><rect x="0" y="-10" width="${g.VIEW_BOX.w}" height="${g.VIEW_BOX.h + 20}" fill="url(#${id}-fade)"/></mask>
</defs>`;

const FIGURE = (id) => `<g fill="url(#${id}-skin)">
  <rect x="117" y="-6" width="26" height="28" rx="9"/>
  <g transform="${g.ARM_TRANSFORM.L}"><rect x="-10" y="-14" width="20" height="104" rx="10"/></g>
  <g transform="${g.ARM_TRANSFORM.R}"><rect x="-10" y="-14" width="20" height="104" rx="10"/></g>
  <path d="M80,58 C79,36 96,22 116,19 L144,19 C164,22 181,36 180,58 C182,74 181,98 178,120 C176,140 173,152 174,166 C175,186 168,200 150,205 L110,205 C92,200 85,186 86,166 C87,152 84,140 82,120 C79,98 78,74 80,58 Z"/>
  <path d="M88,172 C80,192 78,206 84,224 C88,244 89,258 90,270 L121,270 C122,252 124,234 126,220 C127,214 133,214 134,220 C136,234 138,252 139,270 L170,270 C171,258 172,244 176,224 C182,206 180,192 172,172 C152,184 108,184 88,172 Z"/>
</g>
<ellipse cx="130" cy="52" rx="56" ry="30" fill="url(#${id}-hi)" opacity=".65"/>
<ellipse cx="130" cy="250" rx="70" ry="40" fill="url(#${id}-lo)" opacity=".5"/>
<path d="M80,58 C79,36 96,22 116,19 L144,19 C164,22 181,36 180,58" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`;

function view(v) {
  const id = `bm-${v}`;
  const parts = [];
  if (v === 'front') {
    parts.push(`<circle class="navel" cx="${g.NAVEL.cx}" cy="${g.NAVEL.cy}" r="${g.NAVEL.r}"/>`);
    for (const key of s.ZONE_KEYS) {
      const m = s.SITE_META[key];
      parts.push(zone(key, g.cell(m.row, m.col), en.name[key]));
    }
    for (const key of g.FRONT_REGIONS) parts.push(zone(key, g.FRONT[key], en.name[key]));
  } else {
    for (const key of g.BACK_REGIONS) parts.push(zone(key, g.BACK[key], en.name[key]));
    for (const key of g.BACK_ARM_KEYS) {
      const sh = g.BACK[key];
      parts.push(`<g transform="${g.ARM_TRANSFORM[sh.local]}">${zone(key, sh, en.name[key])}</g>`);
    }
  }
  // role=group, not the default img: children of an img are presentational, which would hide the buttons.
  const name = v === 'front' ? 'Front of the body' : 'Back of the body';
  return `<svg class="body-map" data-view="${v}" viewBox="0 0 ${g.VIEW_BOX.w} ${g.VIEW_BOX.h}" role="group" aria-label="${name}" focusable="false"${v === 'back' ? ' hidden' : ''}>
${DEFS(id)}
<g mask="url(#${id}-mask)">
${FIGURE(id)}
${parts.join('\n')}
</g>
<text class="side" x="52" y="142" text-anchor="middle" aria-hidden="true">${en.sideInitialLeft}</text>
<text class="side" x="208" y="142" text-anchor="middle" aria-hidden="true">${en.sideInitialRight}</text>
</svg>`;
}

const START = '<!-- body-map:start (generated by scripts/build-body-map.mjs; do not edit by hand) -->';
const END = '<!-- body-map:end -->';
const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error('index.html has no body-map markers');
const eol = html.includes('\r\n') ? '\r\n' : '\n';
const body = (view('front') + '\n' + view('back')).split('\n').join(eol);
fs.writeFileSync(file, html.slice(0, a + START.length) + eol + body + eol + html.slice(b));
console.log('body map written: front', s.ZONE_KEYS.length + g.FRONT_REGIONS.length, 'areas, back', g.BACK_REGIONS.length + g.BACK_ARM_KEYS.length);
