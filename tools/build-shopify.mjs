// Bygger filene som lastes opp til Shopify-temaet:
//   shopify/assets/flis-editor.js   (bildegravering: bildebehandling + kunde-editor)
//   shopify/assets/flis-editor.css  (felles stil for begge editorene)
//   shopify/assets/tekst-editor.js  (tekstgravering: opentype.js + tekstoppsett + kunde-editor)
//   shopify/assets/<skrifter>.woff og korketrekker-tom.jpg
// Kjør: node tools/build-shopify.mjs
import { readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = '/* Myhr Tre og Design. GENERERT av tools/build-shopify.mjs – ikke rediger her. */\n';
const bundle = (out, parts) => {
  const js = header + parts.map((p) => `\n/* ---- ${p} ---- */\n` + readFileSync(join(root, p), 'utf8')).join('');
  writeFileSync(join(root, 'shopify/assets', out), js);
  console.log(`Skrev shopify/assets/${out} (${(js.length / 1024).toFixed(1)} kB)`);
};
bundle('flis-editor.js', ['js/presets.js', 'js/processing.js', 'js/crop.js', 'js/text.js', 'shop/editor.js']);
bundle('tekst-editor.js', ['vendor/opentype.min.js', 'js/processing.js', 'js/textengrave.js', 'shop/tekst-editor.js']);
writeFileSync(join(root, 'shopify/assets/flis-editor.css'), header + readFileSync(join(root, 'shop/editor.css'), 'utf8'));
for (const f of readdirSync(join(root, 'fonts')).filter((f) => f.endsWith('.woff'))) copyFileSync(join(root, 'fonts', f), join(root, 'shopify/assets', f));
copyFileSync(join(root, 'shop/img/korketrekker-tom.jpg'), join(root, 'shopify/assets/korketrekker-tom.jpg'));
console.log('Kopierte skrifter og produktbilde til shopify/assets/');
