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
// Skrifter og produktbilder bakes inn i skriptene, så butikken ikke må hente dem
// som egne filer (unngår problemer med domener/CORS og «tainted» canvas).
const b64 = (p) => readFileSync(join(root, p)).toString('base64');
const fontFiles = { script: 'great-vibes-latin-400-normal.woff', dancing: 'dancing-script-latin-700-normal.woff',
  serif: 'playfair-display-latin-700-normal.woff', roman: 'cinzel-latin-700-normal.woff', sans: 'montserrat-latin-600-normal.woff' };
const fonts = Object.fromEntries(Object.entries(fontFiles).map(([k, f]) => [k, b64('fonts/' + f)]));
const embed = (name, images) => {
  const data = { fonts, images: Object.fromEntries(images.map((f) => [f, 'data:image/jpeg;base64,' + b64('shop/img/' + f)])) };
  writeFileSync(join(root, `js/embedded-${name}.generated.js`),
    '/* GENERERT av tools/build-shopify.mjs: skrifter (OFL, se fonts/LICENSE.md) og produktbilder. */\nwindow.TextEngraveEmbedded = ' + JSON.stringify(data) + ';\n');
  return `js/embedded-${name}.generated.js`;
};
const core = ['vendor/opentype.min.js', 'js/processing.js', 'js/textengrave.js'];
bundle('tekst-editor.js', [embed('tekst', ['korketrekker-tom.jpg']), ...core, 'shop/svg-eksport.js', 'shop/tekst-editor.js']);
bundle('familietre-editor.js', [embed('familietre', ['familietre-mdf.jpg', 'familietre-lakk.jpg']), ...core, 'js/familietre.js', 'shop/svg-eksport.js', 'shop/familietre-editor.js']);
bundle('dorskilt-editor.js', [embed('dorskilt', []), ...core, 'js/dorskilt-motiv-fjell.js', 'js/dorskilt-motiver.js', 'js/dorskilt.js', 'shop/svg-eksport.js', 'shop/dorskilt-editor.js']);
bundle('svg-eksport.js', [embed('eksport', ['korketrekker-tom.jpg']), ...core, 'js/familietre.js', 'js/dorskilt-motiv-fjell.js', 'js/dorskilt-motiver.js', 'js/dorskilt.js', 'shop/svg-eksport.js']);
writeFileSync(join(root, 'shopify/assets/flis-editor.css'), header + readFileSync(join(root, 'shop/editor.css'), 'utf8'));
for (const f of readdirSync(join(root, 'fonts')).filter((f) => f.endsWith('.woff'))) copyFileSync(join(root, 'fonts', f), join(root, 'shopify/assets', f));
copyFileSync(join(root, 'shop/img/korketrekker-tom.jpg'), join(root, 'shopify/assets/korketrekker-tom.jpg'));
console.log('Kopierte skrifter og produktbilde til shopify/assets/');
