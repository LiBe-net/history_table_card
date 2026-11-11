/**
 * Dev loader for History Table Card – not part of the released card.
 *
 * Loads the unminified history-table-card.js from this repository under a
 * separate tag, so a development version runs side by side with the release
 * installed from HACS on the same Home Assistant instance:
 *
 *   custom:history-table-card       → installed release
 *   custom:history-table-card-dev   → this working copy
 *
 * The source is fetched without cache on every page load, so after editing
 * history-table-card.js a browser reload is enough (no ?v= bump, no build).
 *
 * Setup: clone the repository below <config>/www, then add this file as a
 * dashboard resource of type "JavaScript module", e.g.
 *   /local/dev/history_table_card/dev/dev-loader.js
 * and use `type: custom:history-table-card-dev` in a test card.
 */

const DEV_SUFFIX = '-dev';
const sourceUrl  = new URL('../history-table-card.js', import.meta.url);

function replaceOnce(text, pattern, replacement) {
  if (!pattern.test(text)) {
    throw new Error(`[history-table-card dev-loader] pattern not found in source: ${pattern}`);
  }
  return text.replace(pattern, replacement);
}

const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) {
  throw new Error(`[history-table-card dev-loader] ${sourceUrl} → HTTP ${response.status}`);
}

let source = await response.text();
source = replaceOnce(source, /^(const CARD_TAG\s*=\s*)'([^']+)';/m,  `$1'$2${DEV_SUFFIX}';`);
source = replaceOnce(source, /^(const CARD_NAME\s*=\s*)'([^']+)';/m, `$1'$2 (DEV)';`);
source += `\n//# sourceURL=${new URL('history-table-card.dev.js', sourceUrl).href}\n`;

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
