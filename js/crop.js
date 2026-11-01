// Felles utsnitt-logikk (brukes av både admin-verktøyet og nettbutikk-editoren,
// så kundens utsnitt blir nøyaktig likt når du åpner bestillingen).
// En "view" er { zoom, cx, cy }: zoom 1 = bildet fyller ruten, cx/cy = midtpunkt (0..1).
(function () {
  'use strict';
  const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];

  // Zoom der hele bildet får plass i den kvadratiske ruten.
  function fitZoom(img) {
    const [w, h] = dims(img);
    return Math.min(w, h) / Math.max(w, h);
  }

  // Holder midtpunktet innenfor lovlig område for gjeldende zoom.
  function clamp(view, img) {
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    const lim = (v, m) => Math.min(Math.max(v, Math.min(m, 1 - m)), Math.max(m, 1 - m));
    view.cx = lim(view.cx, side / 2 / w);
    view.cy = lim(view.cy, side / 2 / h);
    return view;
  }

  // Flytt med (dx, dy) skjermpiksler på en rute som er `cssW` piksler bred.
  function pan(view, img, dx, dy, cssW) {
    const [w, h] = dims(img);
    const k = Math.min(w, h) / view.zoom / cssW;
    view.cx -= (dx * k) / w;
    view.cy -= (dy * k) / h;
    return clamp(view, img);
  }

  // Zoom slik at punktet (fx, fy) – andel 0..1 av ruten – blir stående stille.
  function zoomAt(view, img, z, fx = 0.5, fy = 0.5, minZoom = 0.5, maxZoom = 5) {
    const [w, h] = dims(img);
    const oldSide = Math.min(w, h) / view.zoom;
    const px = view.cx * w + (fx - 0.5) * oldSide, py = view.cy * h + (fy - 0.5) * oldSide;
    view.zoom = Math.min(maxZoom, Math.max(minZoom, z));
    const side = Math.min(w, h) / view.zoom;
    view.cx = (px - (fx - 0.5) * side) / w;
    view.cy = (py - (fy - 0.5) * side) / h;
    return clamp(view, img);
  }

  // Hvor stor del av bredden/høyden som er med (1 = alt).
  function coverage(view, img) {
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    return { w: Math.min(1, side / w), h: Math.min(1, side / h) };
  }

  // Tegn kvadratisk utsnitt i ønsket størrelse. Tomrom blir gjennomsiktig (= sort
  // på flisen), med myk overgang der bildekanten er synlig inne i ruten.
  function cropTo(img, size, view) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const [w, h] = dims(img);
    const side = Math.min(w, h) / view.zoom;
    const fit = (v, lim) => Math.min(Math.max(v, Math.min(0, lim)), Math.max(0, lim));
    const sx = fit(view.cx * w - side / 2, w - side);
    const sy = fit(view.cy * h - side / 2, h - side);
    const k = size / side;
    const dx = -sx * k, dy = -sy * k, dw = w * k, dh = h * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    const data = ctx.getImageData(0, 0, size, size);
    const band = size * 0.04;
    const edges = [dx > 0.5, dy > 0.5, dx + dw < size - 0.5, dy + dh < size - 0.5];
    if (edges.some(Boolean)) {
      const d = data.data;
      const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      for (let y = 0; y < size; y++) {
        let fy = 1;
        if (edges[1]) fy *= ss((y - dy) / band);
        if (edges[3]) fy *= ss((dy + dh - y) / band);
        for (let x = 0; x < size; x++) {
          let f = fy;
          if (edges[0]) f *= ss((x - dx) / band);
          if (edges[2]) f *= ss((dx + dw - x) / band);
          if (f < 1) d[(y * size + x) * 4 + 3] *= f;
        }
      }
    }
    return data;
  }

  window.EngraveCrop = { fitZoom, clamp, pan, zoomAt, coverage, cropTo };
})();
