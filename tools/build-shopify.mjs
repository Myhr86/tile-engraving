// Bygger filene som lastes opp til Shopify-temaet:
//   shopify/assets/flis-editor.js  (felles bildebehandling + kunde-editor i én fil)
//   shopify/assets/flis-editor.css
// Kjør: node tools/build-shopify.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parts = ['js/presets.js', 'js/processing.js', 'js/crop.js', 'js/text.js', 'shop/editor.js'];
const header = '/* Flis-editor for Myhr Tre og Design. GENERERT av tools/build-shopify.mjs – ikke rediger her. */\n';
const js = header + parts.map((p) => `\n/* ---- ${p} ---- */\n` + readFileSync(join(root, p), 'utf8')).join('');
writeFileSync(join(root, 'shopify/assets/flis-editor.js'), js);
writeFileSync(join(root, 'shopify/assets/flis-editor.css'), header + readFileSync(join(root, 'shop/editor.css'), 'utf8'));
console.log(`Skrev shopify/assets/flis-editor.js (${(js.length / 1024).toFixed(1)} kB) og flis-editor.css`);
