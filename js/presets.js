// Forhåndsinnstillinger ("presets").
//
// `target` er tonekurven vi vil at motivet skal få: 17 kvantiler (0 %, 6.25 %, … 100 %)
// av gråtonene. De er målt fra midtpartiet av to graveringer som ble ekstra bra:
//   - Hund : puddel-portrettet (mye mellomtoner, lyse krøller, sort bakgrunn)
//   - Hytte: fiskeren ved elva (dype sorte, lyse høylys, mye lokal kontrast)
// Bildet til kunden "tvinges" mot denne fordelingen med histogram-matching.
window.PRESETS = {
  hund: {
    label: 'Hund',
    target: [0, 2, 10, 21, 33, 47, 61, 76, 91, 107, 124, 142, 160, 179, 200, 223, 255],
    params: {
      bgMode: 'vignette', vignetteSize: 0.92, vignetteFeather: 0.35,
      clahe: 0.55, claheClip: 2.5,
      match: 0.85,
      sharpen: 0.9, sharpenRadius: 1.2,
      brightness: 0, contrast: 0, gamma: 1.0,
      blackPoint: 8, whitePoint: 250,
    },
    // Standard tekstoppsett: navnet under hunden, i klassisk serif.
    text: { position: 'bottom', font: 'playfair', size: 0.11, ornament: true, shade: 0.85 },
  },
  hytte: {
    label: 'Hytte',
    target: [0, 0, 1, 2, 6, 9, 16, 24, 36, 49, 64, 82, 102, 127, 154, 187, 255],
    params: {
      bgMode: 'vignette', vignetteSize: 1.25, vignetteFeather: 0.5,
      clahe: 0.7, claheClip: 3.0,
      match: 0.8,
      sharpen: 1.1, sharpenRadius: 1.0,
      brightness: 0, contrast: 0, gamma: 1.0,
      blackPoint: 6, whitePoint: 248,
    },
    // Standard tekstoppsett: hyttenavnet øverst med romerske versaler og ornament.
    text: { position: 'top', font: 'cinzel', size: 0.1, ornament: true, shade: 0.9 },
  },
};
