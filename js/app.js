(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PREVIEW = 700;
  const STORE = 'flisgravering.customPresets';

  const SLIDERS = [
    // id, etikett, min, max, steg
    ['vignetteSize', 'Vignett – størrelse', 0.5, 1.5, 0.01],
    ['vignetteFeather', 'Vignett – myk kant', 0.05, 0.8, 0.01],
    ['match', 'Stil-styrke (tonekurve)', 0, 1, 0.01],
    ['clahe', 'Lokal kontrast / struktur', 0, 1, 0.01],
    ['claheClip', 'Struktur – intensitet', 1, 6, 0.1],
    ['sharpen', 'Skarphet', 0, 3, 0.05],
    ['sharpenRadius', 'Skarphet – radius', 0.5, 4, 0.1],
    ['brightness', 'Lysstyrke', -50, 50, 1],
    ['contrast', 'Kontrast', -100, 100, 1],
    ['gamma', 'Gamma (mellomtoner)', 0.4, 2.5, 0.01],
    ['blackPoint', 'Sortpunkt', 0, 120, 1],
    ['whitePoint', 'Hvitpunkt', 130, 255, 1],
  ];

  const state = {
    img: null,          // HTMLImageElement / ImageBitmap (evt. uten bakgrunn)
    origImg: null,
    zoom: 1, cx: 0.5, cy: 0.5,
    preset: 'hund',
    params: null,
    custom: JSON.parse(localStorage.getItem(STORE) || '{}'),
    text: { enabled: false, name: '', subtitle: '', position: 'bottom', font: 'playfair', size: 0.11, ornament: true, shade: 0.85 },
  };

  function allPresets() {
    const out = { ...window.PRESETS };
    for (const [k, v] of Object.entries(state.custom)) out[k] = v;
    return out;
  }

  // ---------- UI-oppbygging ----------
  function buildPresetButtons() {
    const box = $('presets');
    box.innerHTML = '';
    for (const [key, p] of Object.entries(allPresets())) {
      const b = document.createElement('button');
      b.textContent = p.label;
      b.className = key === state.preset ? 'active' : '';
      b.onclick = () => selectPreset(key);
      if (key.startsWith('custom_')) {
        b.title = 'Egen stil (høyreklikk for å slette)';
        b.oncontextmenu = (e) => {
          e.preventDefault();
          if (confirm(`Slette stilen «${p.label}»?`)) {
            delete state.custom[key];
            localStorage.setItem(STORE, JSON.stringify(state.custom));
            if (state.preset === key) selectPreset('hund'); else buildPresetButtons();
          }
        };
      }
      box.appendChild(b);
    }
  }

  function buildSliders() {
    const box = $('sliders');
    box.innerHTML = '';
    for (const [id, label, min, max, step] of SLIDERS) {
      const row = document.createElement('label');
      row.className = 'slider';
      row.innerHTML = `<span>${label}<output id="o_${id}"></output></span>
        <input type="range" id="s_${id}" min="${min}" max="${max}" step="${step}">`;
      box.appendChild(row);
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        state.params[id] = parseFloat(input.value);
        $('o_' + id).textContent = input.value;
        schedule();
      });
    }
  }

  function syncControls() {
    for (const [id] of SLIDERS) {
      $('s_' + id).value = state.params[id];
      $('o_' + id).textContent = state.params[id];
    }
    for (const r of document.querySelectorAll('input[name=bg]')) r.checked = r.value === state.params.bgMode;
    document.querySelectorAll('.vig').forEach((el) => (el.style.display = state.params.bgMode === 'vignette' ? '' : 'none'));
  }

  function selectPreset(key) {
    state.preset = key;
    const p = allPresets()[key];
    state.params = { ...p.params };
    if (p.text) {
      Object.assign(state.text, p.text);
      syncText();
    }
    buildPresetButtons();
    syncControls();
    schedule();
  }

  // ---------- Bilde inn ----------
  async function loadFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    state.img = state.origImg = img;
    state.zoom = 1; state.cx = 0.5; state.cy = 0.5;
    $('zoom').value = 1;
    $('aiStatus').textContent = '';
    document.body.classList.add('has-image');
    schedule();
  }

  // Tegn kvadratisk utsnitt (beskjæring) i ønsket størrelse.
  function cropTo(size, img = state.img) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const side = Math.min(w, h) / state.zoom;
    const fit = (v, lim) => Math.min(Math.max(v, Math.min(0, lim)), Math.max(0, lim));
    const sx = fit(state.cx * w - side / 2, w - side);
    const sy = fit(state.cy * h - side / 2, h - side);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size);
  }

  // ---------- Behandling ----------
  let pending = false;
  function schedule() {
    if (pending || !state.img) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function render() {
    const orig = cropTo(PREVIEW, state.origImg);
    $('orig').getContext('2d').putImageData(orig, 0, 0);
    const src = state.img === state.origImg ? orig : cropTo(PREVIEW);
    const target = allPresets()[state.preset].target;
    const g = Engrave.process(src, PREVIEW, state.params, target, 1);
    EngraveText.apply(g, PREVIEW, state.text);
    $('result').getContext('2d').putImageData(Engrave.toImageData(g, PREVIEW, { tone: $('warm').checked }), 0, 0);
  }

  async function exportPng() {
    if (!state.img) return;
    const dpi = parseInt($('dpi').value, 10);
    const cm = parseFloat($('size').value);
    const size = Math.round((cm / 2.54) * dpi);
    $('exportBtn').disabled = true;
    $('exportBtn').textContent = 'Lager fil…';
    await new Promise((r) => setTimeout(r, 30));
    try {
      const src = cropTo(size);
      const target = allPresets()[state.preset].target;
      let g = Engrave.process(src, size, state.params, target, size / PREVIEW);
      EngraveText.apply(g, size, state.text);
      if ($('dither').checked) g = Engrave.dither(g, size);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').putImageData(Engrave.toImageData(g, size, { invert: $('invert').checked }), 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const out = await Engrave.pngWithDpi(blob, dpi);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `flis_${allPresets()[state.preset].label.toLowerCase()}_${cm}cm_${dpi}dpi${$('invert').checked ? '_invertert' : ''}.png`;
      a.click();
    } finally {
      $('exportBtn').disabled = false;
      $('exportBtn').textContent = 'Last ned PNG';
    }
  }

  // ---------- AI-bakgrunnsfjerning (valgfri, lastes fra nett) ----------
  async function removeBackground() {
    if (!state.origImg) return;
    const status = $('aiStatus');
    status.textContent = 'Laster AI-modell (første gang kan ta et minutt)…';
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
      const fn = mod.removeBackground || mod.default;
      const c = document.createElement('canvas');
      c.width = state.origImg.naturalWidth; c.height = state.origImg.naturalHeight;
      c.getContext('2d').drawImage(state.origImg, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const outBlob = await fn(blob, {
        progress: (k, cur, tot) => { status.textContent = `Jobber… ${tot ? Math.round((cur / tot) * 100) + ' %' : ''}`; },
      });
      const img = new Image();
      img.src = URL.createObjectURL(outBlob);
      await img.decode();
      state.img = img;
      status.textContent = 'Bakgrunn fjernet ✔';
      schedule();
    } catch (e) {
      console.error(e);
      status.textContent = 'Klarte ikke å fjerne bakgrunn (krever internett). Bruk vignett i stedet.';
    }
  }

  // ---------- Egen stil fra et vellykket bilde ----------
  async function addReference(file) {
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const c = document.createElement('canvas');
    const size = 600;
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    const target = Engrave.targetFromImageData(ctx.getImageData(0, 0, size, size), size);
    const name = prompt('Navn på den nye stilen (f.eks. «Katt» eller «Portrett»):', file.name.replace(/\.[^.]+$/, ''));
    if (!name) return;
    const key = 'custom_' + Date.now();
    state.custom[key] = { label: name, target, params: { ...state.params } };
    localStorage.setItem(STORE, JSON.stringify(state.custom));
    selectPreset(key);
  }

  function saveCurrentAsStyle() {
    const name = prompt('Lagre nåværende innstillinger som ny stil. Navn:');
    if (!name) return;
    const key = 'custom_' + Date.now();
    const { position, font, size, ornament, shade } = state.text;
    state.custom[key] = { label: name, target: allPresets()[state.preset].target, params: { ...state.params }, text: { position, font, size, ornament, shade } };
    localStorage.setItem(STORE, JSON.stringify(state.custom));
    selectPreset(key);
  }

  // ---------- Beskjæring med mus/finger ----------
  function setupCrop() {
    const cv = $('orig');
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: state.cx, cy: state.cy }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag || !state.img) return;
      const img = state.origImg, w = img.naturalWidth, h = img.naturalHeight;
      const side = Math.min(w, h) / state.zoom, k = side / cv.getBoundingClientRect().width;
      state.cx = drag.cx - ((e.clientX - drag.x) * k) / w;
      state.cy = drag.cy - ((e.clientY - drag.y) * k) / h;
      const hw = side / 2 / w, hh = side / 2 / h;
      const lim = (v, m) => Math.min(Math.max(v, Math.min(m, 1 - m)), Math.max(m, 1 - m));
      state.cx = lim(state.cx, hw);
      state.cy = lim(state.cy, hh);
      schedule();
    });
    cv.addEventListener('pointerup', () => (drag = null));
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoom = Math.min(5, Math.max(0.5, state.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      $('zoom').value = state.zoom;
      schedule();
    }, { passive: false });
    $('zoom').addEventListener('input', (e) => { state.zoom = parseFloat(e.target.value); schedule(); });
  }

  // ---------- Tekst / navn ----------
  function syncText() {
    const t = state.text;
    $('tEnabled').checked = t.enabled;
    $('tName').value = t.name;
    $('tSub').value = t.subtitle;
    $('tPos').value = t.position;
    $('tFont').value = t.font;
    $('tSize').value = t.size;
    $('tOrn').checked = t.ornament;
    $('tShade').value = t.shade;
    $('textOpts').style.display = t.enabled ? '' : 'none';
  }

  function setupText() {
    $('tFont').innerHTML = Object.entries(EngraveText.FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
    const bind = (id, key, get) => $(id).addEventListener('input', () => {
      state.text[key] = get($(id));
      if (key === 'name' && state.text.name && !state.text.enabled) state.text.enabled = true;
      syncText();
      schedule();
    });
    bind('tEnabled', 'enabled', (e) => e.checked);
    bind('tName', 'name', (e) => e.value);
    bind('tSub', 'subtitle', (e) => e.value);
    bind('tPos', 'position', (e) => e.value);
    bind('tFont', 'font', (e) => e.value);
    bind('tSize', 'size', (e) => parseFloat(e.value));
    bind('tOrn', 'ornament', (e) => e.checked);
    bind('tShade', 'shade', (e) => parseFloat(e.value));
    syncText();
    EngraveText.loadFonts().then(schedule);
  }

  // ---------- Oppstart ----------
  function init() {
    for (const id of ['orig', 'result']) { $(id).width = $(id).height = PREVIEW; }
    buildSliders();
    setupText();
    selectPreset('hund');
    setupCrop();
    $('file').addEventListener('change', (e) => loadFile(e.target.files[0]));
    $('refFile').addEventListener('change', (e) => { addReference(e.target.files[0]); e.target.value = ''; });
    $('saveStyle').onclick = saveCurrentAsStyle;
    $('reset').onclick = () => selectPreset(state.preset);
    $('aiBtn').onclick = removeBackground;
    $('aiUndo').onclick = () => { state.img = state.origImg; $('aiStatus').textContent = ''; schedule(); };
    $('exportBtn').onclick = exportPng;
    $('warm').onchange = schedule;
    for (const r of document.querySelectorAll('input[name=bg]')) {
      r.addEventListener('change', () => { state.params.bgMode = r.value; syncControls(); schedule(); });
    }
    const updSize = () => {
      const px = Math.round((parseFloat($('size').value) / 2.54) * parseInt($('dpi').value, 10));
      $('pxInfo').textContent = `${px} × ${px} px`;
    };
    $('dpi').onchange = updSize; $('size').oninput = updSize; updSize();

    // Dra og slipp hvor som helst
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });
    // Lim inn fra utklippstavla
    window.addEventListener('paste', (e) => {
      const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
      if (item) loadFile(item.getAsFile());
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
