// Peptidly — Legal HTML Builder
//
// Reads helix/legal/content.ts from the sibling Peptides repo and renders the
// three legal documents (Privacy, Terms, Health Disclaimer) to static HTML
// files at the website root.
//
// Source of truth lives in the app, not here. Run this script every time the
// in-app legal text changes:
//
//   cd C:\Users\norbe\source\repos\peptidly-website
//   node scripts/build-from-content.mjs
//
// Then commit and push the website repo to deploy via GitHub Pages.
//
// Zero dependencies — uses only built-in node modules. No package.json or
// node_modules in this repo by design.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const contentTsPath = resolve(projectRoot, '..', 'Peptides', 'helix', 'legal', 'content.ts');

// ─── Read the source ───────────────────────────────────

let source;
try {
  source = readFileSync(contentTsPath, 'utf8');
  // Normalize CRLF → LF: a Windows checkout of content.ts otherwise defeats
  // the \n\n paragraph split and the heading heuristic below (JS template
  // literals are LF-normalized at parse time, so the APP never sees CRLF —
  // only this raw-source reader does).
  source = source.replace(/\r\n/g, '\n');
} catch (err) {
  console.error('[Build] Could not read source file:', contentTsPath);
  console.error('[Build]', err.message);
  console.error('[Build] Expected the Peptides repo as a sibling of this one.');
  process.exit(1);
}

// ─── Extract LAST_UPDATED ──────────────────────────────

const lastUpdatedMatch = source.match(/export const LAST_UPDATED\s*=\s*'([^']+)'/);
if (!lastUpdatedMatch) {
  console.error('[Build] Could not find LAST_UPDATED in content.ts');
  process.exit(1);
}
const lastUpdated = lastUpdatedMatch[1];

// ─── Extract the three template-literal constants ──────

function extractConstant(name) {
  // Match: export const NAME = `body`;
  // Body can span multiple lines and contain anything except an unescaped backtick.
  const re = new RegExp(`export const ${name}\\s*=\\s*\`([\\s\\S]*?)\`;`, 'm');
  const match = source.match(re);
  if (!match) {
    console.error(`[Build] Could not find export const ${name} in content.ts`);
    process.exit(1);
  }
  return match[1];
}

const privacyBody = extractConstant('PRIVACY_POLICY');
const termsBody = extractConstant('TERMS_OF_SERVICE');
const healthBody = extractConstant('HEALTH_DISCLAIMER');

// ─── HTML helpers ──────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert plain text body to HTML body. Uses the same heading detection as
 * the in-app LegalDocumentScreen renderer: a paragraph is a heading if it's
 * a single line, short (<80 chars), and entirely uppercase.
 */
function bodyToHtml(body) {
  const paragraphs = body.split(/\n\n+/);
  const htmlParts = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const isHeading =
      !trimmed.includes('\n') &&
      trimmed.length < 80 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed);

    if (isHeading) {
      htmlParts.push(`      <h2>${escapeHtml(trimmed)}</h2>`);
    } else {
      // Preserve single line breaks within a paragraph as <br>.
      const escaped = escapeHtml(trimmed).replace(/\n/g, '<br>');
      htmlParts.push(`      <p>${escaped}</p>`);
    }
  }

  return htmlParts.join('\n');
}

/** Render a full HTML page for one legal document. */
function renderPage(title, body, slug) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} — Peptidly</title>
    <link rel="icon" type="image/png" href="/assets/favicon.png">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <header>
      <a href="/" class="brand">
        <img src="/assets/peptidly-mark-80.png" alt="" width="30" height="30">
        <span>Peptidly</span>
      </a>
    </header>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p class="last-updated">Last updated: ${escapeHtml(lastUpdated)}</p>
${bodyToHtml(body)}
    </main>
    <footer>
      <a href="/privacy">Privacy</a> ·
      <a href="/terms">Terms</a> ·
      <a href="/health-disclaimer">Health Disclaimer</a>
      <p class="copyright">© ${new Date().getFullYear()} Peptidly</p>
    </footer>
  </body>
</html>
`;
}

// ─── Render and write ──────────────────────────────────

const pages = [
  { title: 'Privacy Policy', body: privacyBody, file: 'privacy.html' },
  { title: 'Terms of Service', body: termsBody, file: 'terms.html' },
  { title: 'Health Disclaimer', body: healthBody, file: 'health-disclaimer.html' },
];

for (const page of pages) {
  const html = renderPage(page.title, page.body, page.file);
  const outPath = resolve(projectRoot, page.file);
  writeFileSync(outPath, html, 'utf8');
  console.log(`[Build] Wrote ${page.file}`);
}

console.log(`[Build] Generated ${pages.length} legal pages from helix/legal/content.ts (Last updated: ${lastUpdated})`);
