// Enkel kunde-editor for nettbutikken (Shopify).
// Kunden laster opp bilde, plasserer det og skriver navn. Med i handlekurven
// følger originalbildet, en forhåndsvisning og en «oppskrift» som admin-verktøyet
// kan åpne for å lage graveringsfilen i full kvalitet.
//
// Monteres på alle elementer med [data-flis-editor]. Data-attributter:
//   data-preset     hund | hytte
//   data-variants   JSON: [{ "id": 123, "title": "...", "price": "399,00 kr", "available": true }]
//   data-cart-url   hvor kunden sendes etter "Legg i handlekurv" (standard: /cart)
(function () {
  'use strict';

  const PREVIEW = 520;          // oppløsning på forhåndsvisningen i nettbutikken
  const ORIGINAL_MAX = 3000;    // originalbildet krympes til maks dette før opplasting
  const PROOF_SIZE = 1000;      // størrelse på forhåndsvisningsbildet som følger ordren
  const SHOP_FONTS = ['playfair', 'cinzel', 'script'];
  const FONT_NAMES = { playfair: 'Klassisk', cinzel: 'Romersk', script: 'Håndskrift' };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };

  const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

  class FlisEditor {
    constructor(root) {
      this.root = root;
      this.presetKey = window.PRESETS[root.dataset.preset] ? root.dataset.preset : 'hund';
      this.preset = window.PRESETS[this.presetKey];
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.img = null;
      this.file = null;
      this.view = { zoom: 1, cx: 0.5, cy: 0.5 };
      this.minZoom = 0.5;
      this.text = {
        enabled: false, name: '', subtitle: '',
        position: 'bottom', font: 'playfair', size: 0.11, ornament: true, shade: 0.85,
        ...(this.preset.text || {}),
      };
      this.build();
      EngraveText.loadFonts().then(() => this.schedule());
    }

    // ---------- Oppbygging ----------
    build() {
      const r = this.root;
      r.classList.add('flis-editor');
      r.innerHTML = '';
      const isHytte = this.presetKey === 'hytte';

      this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => this.load(e.target.files[0]) });
      this.canvas = h('canvas', { width: PREVIEW, height: PREVIEW, class: 'fe-canvas', 'aria-label': 'Forhåndsvisning av flisen' });
      this.empty = h('button', { type: 'button', class: 'fe-empty', onclick: () => this.fileInput.click() },
        h('span', { class: 'fe-empty-icon' }, '+'),
        h('strong', {}, isHytte ? 'Last opp bilde av hytta' : 'Last opp bilde av hunden'),
        h('small', {}, 'Velg et skarpt bilde med godt lys'));
      this.tile = h('div', { class: 'fe-tile' }, this.canvas, this.empty);

      this.zoomRange = h('input', { type: 'range', min: 0.5, max: 4, step: 0.01, value: 1, 'aria-label': 'Zoom',
        oninput: (e) => this.zoomTo(parseFloat(e.target.value)) });
      this.tools = h('div', { class: 'fe-tools', hidden: true },
        h('button', { type: 'button', class: 'fe-btn fe-icon', 'aria-label': 'Zoom ut', onclick: () => this.zoomTo(this.view.zoom / 1.2) }, '−'),
        this.zoomRange,
        h('button', { type: 'button', class: 'fe-btn fe-icon', 'aria-label': 'Zoom inn', onclick: () => this.zoomTo(this.view.zoom * 1.2) }, '+'),
        h('button', { type: 'button', class: 'fe-btn fe-small', onclick: () => this.fit() }, 'Vis hele'),
        h('button', { type: 'button', class: 'fe-btn fe-small', onclick: () => this.fileInput.click() }, 'Bytt bilde'));
      this.hint = h('p', { class: 'fe-hint', hidden: true }, 'Dra i bildet for å flytte det. Klyp eller bruk + og − for å zoome.');

      // Tekst
      this.nameInput = h('input', { type: 'text', maxlength: 30, placeholder: isHytte ? 'f.eks. Fjellro' : 'f.eks. Bella',
        oninput: (e) => this.setText({ name: e.target.value }) });
      this.subInput = h('input', { type: 'text', maxlength: 40, placeholder: isHytte ? 'f.eks. Est. 1987' : 'f.eks. 2014 – 2026',
        oninput: (e) => this.setText({ subtitle: e.target.value }) });
      this.posButtons = ['top', 'bottom'].map((pos) => h('button', { type: 'button', class: 'fe-chip', 'data-v': pos,
        onclick: () => this.setText({ position: pos }) }, pos === 'top' ? 'Over bildet' : 'Under bildet'));
      this.fontButtons = SHOP_FONTS.map((f) => {
        const font = EngraveText.FONTS[f];
        return h('button', { type: 'button', class: 'fe-chip fe-font', 'data-v': f, style: `font-family:${font.family};font-weight:${font.weight}`,
          onclick: () => this.setText({ font: f }) }, FONT_NAMES[f]);
      });

      // Variant (hvis produktet har flere, f.eks. størrelse)
      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant',
          h('select', { onchange: (e) => { this.variantId = +e.target.value; this.updateButton(); } },
            this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }

      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      r.append(...[
        this.fileInput,
        this.tile, this.tools, this.hint,
        h('div', { class: 'fe-section' },
          h('h3', {}, isHytte ? 'Navn på hytta (valgfritt)' : 'Navn på hunden (valgfritt)'),
          h('label', { class: 'fe-field' }, 'Navn', this.nameInput),
          h('label', { class: 'fe-field' }, 'Undertekst (valgfri)', this.subInput),
          h('div', { class: 'fe-row' }, this.posButtons),
          h('div', { class: 'fe-row' }, this.fontButtons)),
        variantEl,
        h('p', { class: 'fe-note' }, 'Vi går gjennom og finjusterer hvert bilde for hånd før gravering. Forhåndsvisningen viser omtrent hvordan flisen blir.'),
        this.addBtn, this.msg,
      ].filter(Boolean));

      this.setupGestures();
      this.syncText();
      this.updateButton();
    }

    // ---------- Bilde ----------
    async load(file) {
      if (!file || !file.type.startsWith('image/')) return;
      this.msg.textContent = '';
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try { await img.decode(); } catch (e) {
        this.msg.textContent = 'Klarte ikke å lese bildet. Prøv et JPG- eller PNG-bilde.';
        return;
      }
      this.img = img;
      this.file = file;
      const fz = EngraveCrop.fitZoom(img);
      this.minZoom = Math.min(0.5, fz * 0.8);
      this.zoomRange.min = this.minZoom.toFixed(3);
      this.fitZoomValue = fz;
      this.tile.classList.add('has-image');
      this.tools.hidden = false;
      this.hint.hidden = false;
      // Stående/kvadratiske bilder fyller ruten, brede bilder vises i sin helhet.
      this.view = { zoom: fz < 0.8 ? fz : 1, cx: 0.5, cy: 0.5 };
      this.afterView();
      this.updateButton();
    }

    fit() { if (!this.img) return; this.view = { zoom: this.fitZoomValue, cx: 0.5, cy: 0.5 }; this.afterView(); }

    zoomTo(z, fx, fy) {
      if (!this.img) return;
      EngraveCrop.zoomAt(this.view, this.img, z, fx, fy, this.minZoom, 4);
      this.afterView();
    }

    afterView() {
      EngraveCrop.clamp(this.view, this.img);
      this.zoomRange.value = this.view.zoom;
      this.schedule();
    }

    setupGestures() {
      const cv = this.canvas, pointers = new Map();
      let pinch = null;
      cv.addEventListener('pointerdown', (e) => {
        if (!this.img) return;
        cv.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom };
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev || !this.img) return;
        const cur = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, cur);
        const rect = cv.getBoundingClientRect();
        if (pointers.size === 2 && pinch) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          EngraveCrop.zoomAt(this.view, this.img, pinch.zoom * (d / pinch.dist),
            ((a.x + b.x) / 2 - rect.left) / rect.width, ((a.y + b.y) / 2 - rect.top) / rect.height, this.minZoom, 4);
          EngraveCrop.pan(this.view, this.img, (cur.x - prev.x) / 2, (cur.y - prev.y) / 2, rect.width);
        } else if (pointers.size === 1) {
          EngraveCrop.pan(this.view, this.img, cur.x - prev.x, cur.y - prev.y, rect.width);
        }
        this.afterView();
      });
      const end = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', (e) => {
        if (!this.img) return;
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        this.zoomTo(this.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      }, { passive: false });
      // Dra og slipp en fil på ruten
      this.tile.addEventListener('dragover', (e) => e.preventDefault());
      this.tile.addEventListener('drop', (e) => { e.preventDefault(); this.load(e.dataTransfer.files[0]); });
    }

    // ---------- Tekst ----------
    setText(patch) {
      Object.assign(this.text, patch);
      this.text.enabled = !!(this.text.name.trim() || this.text.subtitle.trim());
      this.syncText();
      this.schedule();
    }

    syncText() {
      for (const b of this.posButtons) b.classList.toggle('active', b.dataset.v === this.text.position);
      for (const b of this.fontButtons) b.classList.toggle('active', b.dataset.v === this.text.font);
    }

    // ---------- Tegning ----------
    schedule() {
      if (this.pending || !this.img) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.render(); });
    }

    renderGray(size) {
      const src = EngraveCrop.cropTo(this.img, size, this.view);
      const g = Engrave.process(src, size, this.preset.params, this.preset.target, size / 700);
      EngraveText.apply(g, size, this.text);
      return g;
    }

    render() {
      const g = this.renderGray(PREVIEW);
      this.canvas.getContext('2d').putImageData(Engrave.toImageData(g, PREVIEW, { tone: true }), 0, 0);
    }

    // ---------- Handlekurv ----------
    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      const price = v ? ` – ${v.price}` : '';
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = false;
      this.addBtn.textContent = this.img ? `Legg i handlekurven${price}` : 'Last opp et bilde først';
    }

    recipe() {
      const { enabled, name, subtitle, position, font } = this.text;
      const round = (x) => Math.round(x * 10000) / 10000;
      return { v: 1, preset: this.presetKey, zoom: round(this.view.zoom), cx: round(this.view.cx), cy: round(this.view.cy),
        text: { enabled, name: name.trim(), subtitle: subtitle.trim(), position, font } };
    }

    // Krymper originalbildet (beholder proporsjoner, så utsnittet stemmer fortsatt).
    async originalFile() {
      const w = this.img.naturalWidth, hgt = this.img.naturalHeight;
      const k = Math.min(1, ORIGINAL_MAX / Math.max(w, hgt));
      if (k === 1 && /jpe?g/i.test(this.file.type) && this.file.size < 15e6) return this.file;
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(hgt * k);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.img, 0, 0, c.width, c.height);
      return new File([await toBlob(c, 'image/jpeg', 0.92)], 'originalbilde.jpg', { type: 'image/jpeg' });
    }

    async proofFile() {
      const g = this.renderGray(PROOF_SIZE);
      const c = document.createElement('canvas');
      c.width = c.height = PROOF_SIZE;
      c.getContext('2d').putImageData(Engrave.toImageData(g, PROOF_SIZE, { tone: true }), 0, 0);
      return new File([await toBlob(c, 'image/jpeg', 0.85)], 'forhandsvisning.jpg', { type: 'image/jpeg' });
    }

    async addToCart() {
      if (!this.img) { this.fileInput.click(); return; }
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true;
      this.addBtn.textContent = 'Laster opp bildet …';
      this.msg.textContent = '';
      try {
        const r = this.recipe();
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        fd.append('properties[Motiv]', this.preset.label);
        if (r.text.name) fd.append('properties[Navn]', r.text.name);
        if (r.text.subtitle) fd.append('properties[Undertekst]', r.text.subtitle);
        if (r.text.enabled) {
          fd.append('properties[Tekst]', `${r.text.position === 'top' ? 'Over' : 'Under'} bildet, skrift: ${FONT_NAMES[r.text.font]}`);
        }
        fd.append('properties[Forhåndsvisning]', await this.proofFile());
        fd.append('properties[_Originalbilde]', await this.originalFile());
        fd.append('properties[_Oppskrift]', JSON.stringify(r));

        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const res = await fetch(root + 'cart/add.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) {
          let desc = '';
          try { desc = (await res.json()).description || ''; } catch (e) { /* ignorer */ }
          throw new Error(desc || `HTTP ${res.status}`);
        }
        this.addBtn.textContent = 'Lagt i handlekurven ✔';
        window.location.href = this.cartUrl;
      } catch (e) {
        console.error(e);
        this.msg.textContent = `Noe gikk galt: ${e.message}. Prøv igjen, eller kontakt oss.`;
        this.addBtn.disabled = false;
        this.updateButton();
      }
    }
  }

  function mountAll() {
    document.querySelectorAll('[data-flis-editor]:not(.flis-editor)').forEach((el) => {
      try {
        el._flisEditor = new FlisEditor(el);
      } catch (e) {
        console.error('Flis-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Bildeverktøyet kunne ikke starte: ' +
          String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  window.FlisEditor = FlisEditor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  // Shopify sin tema-editor laster seksjoner på nytt uten å laste siden.
  document.addEventListener('shopify:section:load', mountAll);
})();
