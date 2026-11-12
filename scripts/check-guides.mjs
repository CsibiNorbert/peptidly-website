// Checks the three app-guide pages: head, schema, sitemap, link and step/region wiring, no dose figure in any
// attribute, and that the shared Calculator-screen replica is identical on the two pages that carry it.
// Run: node scripts/check-guides.mjs [file ...]    Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUGS = ['syringe-units', 'water-volume-and-concentration', 'injection-site-rotation'];
const files = process.argv.length > 2 ? process.argv.slice(2) : SLUGS.map((s) => `${s}.html`);
// Same expression as check-no-doses.mjs (that script reads text with tags stripped, so it never sees attributes).
const DOSE = /\b\d+(?:[.,]\d+)?\s*(?:mcg|µg|mg|ml|units?|iu|u)\b/gi;
// The unit definitions check-no-doses.mjs allows, exactly.
const ALLOWED = [/\b1 ?ml insulin syringe/gi, /\b100 units = 1 ml\b/g, /\b1 mg = 1,?000 mcg\b/g, /\b1 unit = 0\.01 ml\b/g];

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
let bad = 0;
const fail = (f, msg) => { bad++; console.error(`${f}: ${msg}`); };

// Titles of every other page, for the uniqueness check.
const titleOf = (h) => (h.match(/<title>([^<]*)<\/title>/) || [])[1];
const others = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !files.includes(f));
const taken = new Map(others.map((f) => [titleOf(read(f)), f]));

// The tag the policy describes, copied from the calculator page so the guides cannot drift from it.
const UMAMI_TAG = (read('peptide-calculator.html').match(/<script defer src="https:\/\/cloud\.umami\.is[^>]*><\/script>/) || [])[0];
if (!UMAMI_TAG) { console.error('peptide-calculator.html has no Umami tag to compare against'); process.exit(1); }

const sitemap = read('sitemap.xml');
const css = read('home.css');
if (!fs.existsSync(path.join(root, 'guide.js'))) fail('guide.js', 'missing');
if (!css.includes('.guide-stage') || !css.includes('.is-focus')) fail('home.css', 'guide layout (.guide-stage, .is-focus) missing');

for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) { fail(f, 'missing'); continue; }
  const h = read(f);
  const slug = f.replace(/\.html$/, '');
  // The privacy policy (PRIVACY_LAST_UPDATED 2026-11-12) names the home page, the calculator page and the guide
  // pages as the pages that load Umami, and says Play-link clicks are reported. So a guide loads Umami exactly as
  // the calculator page does, and nothing else third-party; has the opt-out button; and tags every Play link.
  if (!h.includes(UMAMI_TAG)) fail(f, 'does not carry the Umami tag exactly as peptide-calculator.html does');
  for (const m of h.matchAll(/<script[^>]*\ssrc="(https?:[^"]+)"/g)) {
    if (!m[1].startsWith('https://cloud.umami.is/')) fail(f, `third-party script ${m[1]} (the policy names only Umami)`);
  }
  if (!h.includes('data-count-toggle')) fail(f, 'no "Don\'t count my visits" button (data-count-toggle)');
  const play = [...h.matchAll(/<a [^>]*href="https:\/\/play\.google\.com[^>]*>/g)].map((m) => m[0]);
  if (play.length === 0) fail(f, 'no Google Play link');
  for (const a of play) {
    if (!a.includes('data-umami-event="Google Play"') || !/data-umami-event-placement="[a-z]+"/.test(a)) fail(f, `Play link without its Umami event: ${a.slice(0, 80)}`);
  }
  const n1 = (h.match(/<h1[\s>]/g) || []).length;
  if (n1 !== 1) fail(f, `${n1} h1 elements, want 1`);
  const title = titleOf(h) || '';
  if (!title || title.length > 60) fail(f, `title missing or over 60 chars (${title.length})`);
  if (taken.has(title)) fail(f, `title duplicates ${taken.get(title)}`);
  taken.set(title, f);
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (desc.length < 120 || desc.length > 160) fail(f, `description is ${desc.length} chars, want 120-160`);
  // The title already ends in the brand; repeating it in the description spends the snippet on our own name.
  if (/peptidly/i.test(desc)) fail(f, 'the description repeats the brand name (the title carries it)');
  const url = `https://peptidly.co.uk/${slug}`;
  if (!h.includes(`<link rel="canonical" href="${url}">`)) fail(f, `canonical is not ${url}`);
  if (!h.includes(`<meta property="og:url" content="${url}">`)) fail(f, 'og:url is not the canonical');
  const ld = (h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  try {
    const types = JSON.stringify(JSON.parse(ld));
    for (const t of ['WebPage', 'BreadcrumbList']) if (!types.includes(`"${t}"`)) fail(f, `JSON-LD lacks ${t}`);
    if (types.includes('FAQPage')) fail(f, 'FAQPage schema (retired rich result)');
  } catch { fail(f, 'JSON-LD missing or not valid JSON'); }
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail(f, 'not in sitemap.xml');

  const steps = [...h.matchAll(/data-step="([^"]+)"/g)].map((m) => m[1]);
  if (steps.length < 3) fail(f, `${steps.length} steps, want at least 3`);
  for (const s of steps) if (!h.includes(`data-region="${s}"`)) fail(f, `step "${s}" has no data-region`);

  for (const m of h.matchAll(/<a [^>]*href="([^"#?]*)/g)) {
    const href = m[1];
    if (!href.startsWith('/')) continue;
    const target = href === '/' ? 'index.html' : href.slice(1);
    if (!fs.existsSync(path.join(root, target)) && !fs.existsSync(path.join(root, `${target}.html`))) fail(f, `link ${href} does not resolve`);
  }

  // Every attribute value (aria-label, alt, title, content, data-where): check-no-doses never reads these.
  for (const m of h.matchAll(/\s(?:aria-label|alt|title|content|data-where|aria-description)="([^"]*)"/g)) {
    let v = m[1];
    for (const a of ALLOWED) v = v.replace(a, '');
    const hit = v.match(DOSE);
    if (hit) fail(f, `dose-like figure in an attribute: "${hit[0]}"`);
  }
}

// The Calculator-screen replica must not drift between the two pages that show it.
const block = (f) => fs.existsSync(path.join(root, f)) && (read(f).match(/<!-- app-calc:start -->[\s\S]*?<!-- app-calc:end -->/) || [])[0];
if (files.includes('syringe-units.html') && files.includes('water-volume-and-concentration.html')) {
  const a = block('syringe-units.html');
  const b = block('water-volume-and-concentration.html');
  if (!a || !b) fail('app-calc', 'a page lacks the app-calc:start / app-calc:end block');
  else if (a !== b) fail('app-calc', 'the Calculator replica differs between syringe-units and water-volume-and-concentration');
}

// The header's Guides menu: on the home page, the calculator page and each guide, a <details> with the three guide
// links in this order, and on a guide its own link marked aria-current="page".
for (const f of ['index.html', 'peptide-calculator.html', ...SLUGS.map((s) => `${s}.html`)]) {
  if (!fs.existsSync(path.join(root, f))) { fail(f, 'missing'); continue; }
  const menu = (read(f).match(/<details class="nav-menu" data-nav-menu>[\s\S]*?<\/details>/) || [])[0];
  if (!menu) { fail(f, 'no Guides menu (<details class="nav-menu" data-nav-menu>) in the header'); continue; }
  if (!/<summary>Guides<\/summary>/.test(menu)) fail(f, 'the Guides menu has no <summary>Guides</summary>');
  const hrefs = [...menu.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  if (hrefs.join() !== SLUGS.map((s) => `/${s}`).join()) fail(f, `the Guides menu links ${hrefs.join(', ')}, want ${SLUGS.map((s) => `/${s}`).join(', ')}`);
  const own = `/${f.replace(/\.html$/, '')}`;
  const current = [...menu.matchAll(/<a [^>]*href="([^"]+)"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="([^"]+)"/g)].map((m) => m[1] || m[2]);
  if (SLUGS.map((s) => `/${s}`).includes(own) ? current.join() !== own : current.length) fail(f, `aria-current in the Guides menu is [${current.join(', ')}] on ${own}`);

  // Below 1100px the header nav is hidden, so a Menu button (a <details>) carries the same links in the same
  // order, the guides listed flat. The footer carries the three guides too, for crawlers and for the end of a page.
  const html = read(f);
  const topNav = (html.match(/<nav class="top-nav"[\s\S]*?<\/nav>/) || [])[0] || '';
  const mobile = (html.match(/<details class="m-menu" data-nav-menu>[\s\S]*?<\/details>/) || [])[0];
  if (!mobile) fail(f, 'no mobile menu (<details class="m-menu" data-nav-menu>)');
  else {
    if (!/<summary[^>]*>[\s\S]*?Menu[\s\S]*?<\/summary>/.test(mobile)) fail(f, 'the mobile menu button does not say Menu');
    const want = [...topNav.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const got = [...mobile.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    if (want.join() !== got.join()) fail(f, `the mobile menu links [${got.join(', ')}] differ from the header nav [${want.join(', ')}]`);
    const mobileCurrent = [...mobile.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)].length;
    const navCurrent = [...topNav.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)].length;
    if (mobileCurrent !== navCurrent) fail(f, `aria-current appears ${mobileCurrent} times in the mobile menu, ${navCurrent} in the header nav`);
  }
  const foot = (html.match(/<nav class="foot-nav foot-guides" aria-label="Guides">[\s\S]*?<\/nav>/) || [])[0];
  if (!foot) fail(f, 'no Guides links in the footer (<nav class="foot-nav foot-guides" aria-label="Guides">)');
  else if ([...foot.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]).join() !== SLUGS.map((s) => `/${s}`).join()) fail(f, 'the footer Guides links are not the three guides, in order');
}

if (bad) { console.error(`${bad} problem(s) found`); process.exit(1); }
console.log(`guides ok: ${files.length} page(s)`);
