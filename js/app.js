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
    state.params = window.presetParams ? window.presetParams(p) : { ...p.params };  // Familie: hele flisen (ingen vignett)
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
    // Zoom der hele bildet får plass i den kvadratiske ruten (1 = fyller ruten).
    state.fitZoom = EngraveCrop.fitZoom(img);
    state.minZoom = Math.min(0.5, state.fitZoom * 0.8);
    $('zoom').min = state.minZoom.toFixed(3);
    $('aiStatus').textContent = '';
    document.body.classList.add('has-image');
    setZoom(state.fitZoom, true); // standard: vis hele bildet, ingenting kuttes
    if (state.pendingRecipe) applyRecipe(state.pendingRecipe);
  }

  // ---------- Bestilling fra nettbutikken ----------
  // «Oppskriften» lagres på ordrelinjen av butikk-editoren (shop/editor.js).
  function applyRecipe(r) {
    const presets = allPresets();
    if (r.preset && presets[r.preset]) selectPreset(r.preset);
    // Kant fra nettbutikken: 'full' = bildet over hele flisen (ingen vignett)
    if (r.edge) {
      state.params = window.presetParams(allPresets()[state.preset], r.edge);
      syncControls();
    }
    if (r.text) {
      Object.assign(state.text, r.text);
      syncText();
    }
    if (state.origImg) {
      state.zoom = r.zoom; state.cx = r.cx; state.cy = r.cy;
      EngraveCrop.clamp(state, state.origImg);
      $('zoom').value = state.zoom;
      state.pendingRecipe = null;
      $('orderStatus').textContent = '✔ Bestillingen er åpnet. Finjuster om nødvendig, og last ned.';
    } else {
      state.pendingRecipe = r;
      $('orderStatus').textContent = 'Oppskrift lest. Velg nå originalbildet fra ordren.';
    }
    schedule();
  }

  function readRecipe() {
    const raw = $('recipe').value.trim();
    if (!raw) return;
    try {
      const r = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      if (typeof r.zoom !== 'number') throw new Error('mangler zoom');
      applyRecipe(r);
    } catch (e) {
      $('orderStatus').textContent = '⚠ Klarte ikke å lese oppskriften. Kopier hele teksten fra «_Oppskrift» i ordren.';
    }
  }

  function setZoom(z, center) {
    state.zoom = Math.min(5, Math.max(state.minZoom || 0.5, z));
    if (center) { state.cx = 0.5; state.cy = 0.5; }
    clampCenter();
    $('zoom').value = state.zoom;
    schedule();
  }

  // Forteller om noe av bildet blir kuttet bort med valgt utsnitt.
  function updateCropInfo() {
    const img = state.origImg;
    if (!img) return;
    const { w: pw, h: ph } = EngraveCrop.coverage(state, img);
    const el = $('cropInfo');
    if (pw > 0.995 && ph > 0.995) {
      el.textContent = '✔ Hele bildet er med.';
      el.className = 'hint ok';
    } else {
      el.textContent = `⚠ Kantene kuttes: ${Math.round(pw * 100)} % av bredden og ${Math.round(ph * 100)} % av høyden er med.`;
      el.className = 'hint warn';
    }
  }

  // Tegn kvadratisk utsnitt (felles logikk i js/crop.js).
  function cropTo(size, img = state.img) {
    return EngraveCrop.cropTo(img, size, state);
  }

  // ---------- Behandling ----------
  let pending = false;
  function schedule() {
    if (pending || !state.img) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function render() {
    updateCropInfo();
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
  function clampCenter() {
    if (state.origImg) EngraveCrop.clamp(state, state.origImg);
  }

  function panBy(dx, dy, cssW) {
    EngraveCrop.pan(state, state.origImg, dx, dy, cssW);
    schedule();
  }

  function zoomAt(z, fx = 0.5, fy = 0.5) {
    if (!state.origImg) return;
    EngraveCrop.zoomAt(state, state.origImg, z, fx, fy, state.minZoom || 0.5);
    $('zoom').value = state.zoom;
    schedule();
  }

  function setupCrop() {
    // Både originalen og flis-forhåndsvisningen kan dras i og zoomes.
    for (const cv of [$('orig'), $('result')]) {
      cv.classList.add('draggable');
      const pointers = new Map();
      let pinch = null;
      cv.addEventListener('pointerdown', (e) => {
        if (!state.img) return;
        cv.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        cv.classList.add('dragging');
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom };
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev || !state.img) return;
        const cur = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, cur);
        const rect = cv.getBoundingClientRect();
        if (pointers.size === 2 && pinch) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const fx = ((a.x + b.x) / 2 - rect.left) / rect.width, fy = ((a.y + b.y) / 2 - rect.top) / rect.height;
          zoomAt(pinch.zoom * (d / pinch.dist), fx, fy);
          panBy((cur.x - prev.x) / 2, (cur.y - prev.y) / 2, rect.width);
        } else if (pointers.size === 1) {
          panBy(cur.x - prev.x, cur.y - prev.y, rect.width);
        }
      });
      const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) cv.classList.remove('dragging');
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', (e) => {
        if (!state.img) return;
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        zoomAt(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      }, { passive: false });
      cv.addEventListener('dblclick', () => setZoom(state.fitZoom || 1, true));
    }
    // Piltaster flytter utsnittet (Shift = større steg), når man ikke skriver i et felt.
    window.addEventListener('keydown', (e) => {
      if (!state.img || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
      const step = e.shiftKey ? 60 : 12;
      const map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (!map[e.key] || document.activeElement.type === 'range') return;
      e.preventDefault();
      panBy(map[e.key][0], map[e.key][1], 700);
    });
    $('zoom').addEventListener('input', (e) => zoomAt(parseFloat(e.target.value)));
    $('fitAll').onclick = () => setZoom(state.fitZoom || 1, true);
    $('fillTile').onclick = () => setZoom(1, true);
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
    $('orderFile').addEventListener('change', (e) => loadFile(e.target.files[0]));
    $('recipe').addEventListener('input', readRecipe);
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
