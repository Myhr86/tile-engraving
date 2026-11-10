// Kunde-editor for bilflisen: kunden velger stil, laster opp et bilde av bilen sin, og
// bildetjenesten (worker/bilflis) setter bilen inn i stilbildet. Det ferdige bildet legges
// på ordren som fil (Bilde), sammen med kundens originalfoto (Bilfoto).
// Monteres på [data-bilflis-editor] med data-variants, data-cart-url, data-api og data-styles.
(function () {
  'use strict';

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };
  const toBlob = (c, t, q) => new Promise((r) => c.toBlob(r, t, q));
  const b64ToBlob = (b64, type) => {
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  };
  const SAVE_KEY = 'bilflis-resultat';
  const MAX_SIDE = 1600;

  class BilflisEditor {
    constructor(root) {
      this.root = root;
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.api = (root.dataset.api || '').replace(/\/+$/, '');
      this.styles = JSON.parse(root.dataset.styles || '[]');
      this.style = (this.styles[0] || {}).id;
      this.photo = null;          // { blob, url }
      this.result = null;         // { b64, style, url }
      this.remaining = null;
      this.busy = false;
      this.build();
      this.restore();
      this.loadStatus();
    }

    build() {
      const r = this.root;
      r.classList.add('flis-editor', 'bilflis-editor');
      r.innerHTML = '';

      this.preview = h('img', { class: 'bf-result', alt: 'Bilen din i valgt stil' });
      this.placeholder = h('div', { class: 'bf-placeholder' },
        h('strong', {}, 'Her kommer bilen din'),
        h('small', {}, 'Velg stil og last opp et bilde av bilen'));
      this.progress = h('div', { class: 'bf-progress', hidden: true }, h('span', { class: 'bf-spinner' }), h('span', { class: 'bf-progress-text' }));
      this.tile = h('div', { class: 'fe-tile bf-tile' }, this.placeholder, this.preview, this.progress);

      this.styleChips = this.styles.map((s) => h('button', { type: 'button', class: 'fe-chip bf-style', 'data-v': s.id,
        onclick: () => { this.style = s.id; this.sync(); } },
        h('img', { src: s.thumb, alt: '', loading: 'lazy' }), h('span', {}, s.label)));

      this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => this.loadPhoto(e.target.files[0]) });
      this.photoThumb = h('img', { class: 'bf-photo', alt: 'Bildet av bilen din', hidden: true });
      this.photoBtn = h('button', { type: 'button', class: 'fe-btn bf-upload', onclick: () => this.fileInput.click() }, 'Last opp bilde av bilen');

      this.genBtn = h('button', { type: 'button', class: 'fe-add bf-generate', onclick: () => this.generate() });
      this.quota = h('p', { class: 'fe-hint bf-quota' });
      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant', h('select', { onchange: (e) => { this.variantId = +e.target.value; this.sync(); } },
          this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }

      r.append(...[
        this.tile,
        h('div', { class: 'fe-section' }, h('h3', {}, '1. Velg stil'), h('div', { class: 'fe-row bf-styles' }, this.styleChips)),
        h('div', { class: 'fe-section' }, h('h3', {}, '2. Last opp bilde av bilen'),
          h('div', { class: 'bf-photo-row' }, this.photoThumb, this.photoBtn),
          h('p', { class: 'fe-hint' }, 'Best resultat: hele bilen synlig, tatt litt skrått forfra, i dagslys. Skiltet fjernes på flisen.'),
          this.fileInput),
        h('div', { class: 'fe-section' }, h('h3', {}, '3. Lag bildet'), this.genBtn, this.quota),
        variantEl,
        h('p', { class: 'fe-note' }, 'Bildet lages med kunstig intelligens, så små detaljer kan avvike fra bilen din. Vi ser over hvert bilde før gravering og tar kontakt hvis noe bør justeres.'),
        this.addBtn, this.msg,
      ].filter(Boolean));
      this.sync();
    }

    styleLabel(id) { return (this.styles.find((s) => s.id === id) || {}).label || id; }

    sync() {
      for (const c of this.styleChips) c.classList.toggle('active', c.dataset.v === this.style);
      const hasPhoto = !!this.photo;
      this.photoBtn.textContent = hasPhoto ? 'Bytt bilde' : 'Last opp bilde av bilen';
      this.photoThumb.hidden = !hasPhoto;
      if (hasPhoto) this.photoThumb.src = this.photo.url;
      this.tile.classList.toggle('has-result', !!this.result);
      this.preview.hidden = !this.result;
      this.placeholder.hidden = !!this.result;
      if (this.result && this.preview.src !== this.result.url) this.preview.src = this.result.url;

      const out = this.remaining === 0;
      this.genBtn.disabled = this.busy || !hasPhoto || !this.style || out || !this.api;
      this.genBtn.textContent = this.busy ? 'Lager bildet …' : !hasPhoto ? 'Last opp et bilde først'
        : this.result ? 'Lag nytt bilde' : 'Lag bildet (tar ca. 1 minutt)';
      this.quota.textContent = !this.api ? 'Bildetjenesten er ikke satt opp ennå.'
        : this.remaining == null ? '' : out ? 'Du har brukt opp forsøkene for i dag. Prøv igjen i morgen, eller kontakt oss.'
        : `Du har ${this.remaining} forsøk igjen i dag.`;
      this.updateButton();
    }

    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = !this.result || this.busy;
      this.addBtn.textContent = this.result ? `Legg i handlekurven${v ? ' – ' + v.price : ''}` : 'Lag bildet først';
    }

    async loadStatus() {
      if (!this.api) return this.sync();
      try {
        const resp = await fetch(this.api + '/status');
        const d = await resp.json();
        if (typeof d.remaining === 'number') this.remaining = d.remaining;
      } catch (e) { /* tjenesten svarer kanskje ikke; knappen viser feil ved forsøk */ }
      this.sync();
    }

    // Les og forminsk bildet (sparer opplasting); EXIF-rotasjon håndteres av nettleseren.
    async loadPhoto(file) {
      if (!file) return;
      this.msg.textContent = '';
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const blob = await toBlob(c, 'image/jpeg', 0.9);
        if (this.photo) URL.revokeObjectURL(this.photo.url);
        this.photo = { blob, url: URL.createObjectURL(blob) };
      } catch (e) {
        console.error(e);
        this.msg.textContent = 'Klarte ikke å lese bildet. Prøv et JPG- eller PNG-bilde.';
      }
      this.fileInput.value = '';
      this.sync();
    }

    async generate() {
      if (this.busy || !this.photo) return;
      this.busy = true; this.msg.textContent = '';
      const started = Date.now();
      const text = this.progress.querySelector('.bf-progress-text');
      const tick = () => { text.textContent = `Lager bildet … ${Math.round((Date.now() - started) / 1000)} s`; };
      tick(); const timer = setInterval(tick, 1000);
      this.progress.hidden = false;
      this.sync();
      try {
        const fd = new FormData();
        fd.append('style', this.style);
        fd.append('photo', this.photo.blob, 'bil.jpg');
        const resp = await fetch(this.api + '/generate', { method: 'POST', body: fd });
        const rem = resp.headers.get('X-Remaining');
        if (rem != null) this.remaining = +rem;
        if (!resp.ok || !/event-stream/.test(resp.headers.get('Content-Type') || '')) {
          let err = ''; try { const d = await resp.json(); err = d.error; if (typeof d.remaining === 'number') this.remaining = d.remaining; } catch (e) { /* ignorer */ }
          throw new Error(err || `Bildetjenesten svarte ${resp.status}`);
        }
        const style = this.style;
        const final = await this.readStream(resp.body, (b64) => {      // delbilder underveis
          this.preview.src = 'data:image/png;base64,' + b64; this.preview.hidden = false; this.placeholder.hidden = true;
        });
        if (!final) throw new Error('Fikk ikke noe ferdig bilde. Prøv igjen.');
        this.setResult({ b64: final, style });
      } catch (e) {
        console.error(e);
        this.msg.textContent = e.message || 'Noe gikk galt. Prøv igjen.';
        if (this.result) this.preview.src = this.result.url; else { this.preview.hidden = true; this.placeholder.hidden = false; }
      } finally {
        clearInterval(timer);
        this.busy = false; this.progress.hidden = true;
        this.sync();
      }
    }

    // Leser Server-Sent Events fra OpenAI (via serveren). Returnerer det ferdige bildet (base64).
    async readStream(body, onPartial) {
      const reader = body.getReader(), dec = new TextDecoder();
      let buf = '', final = null;
      const handle = (chunk) => {
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data || data === '[DONE]') return;
        let d; try { d = JSON.parse(data); } catch (e) { return; }
        if (d.type === 'error' || d.error) throw new Error('Bildetjenesten kunne ikke lage bildet. Prøv et annet bilde av bilen.');
        if (!d.b64_json) return;
        if (/completed$/.test(d.type || '')) final = d.b64_json; else onPartial(d.b64_json);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2); }
      }
      if (buf.trim()) handle(buf);
      return final;
    }

    setResult(res) {
      this.result = { ...res, url: 'data:image/png;base64,' + res.b64 };
      try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ b64: res.b64, style: res.style })); } catch (e) { /* for stort eller blokkert */ }
      this.sync();
    }

    // Behold siste bilde hvis siden lastes på nytt (koster et forsøk å lage)
    restore() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null');
        if (saved && saved.b64) { this.setResult(saved); this.style = saved.style || this.style; this.sync(); }
      } catch (e) { /* ignorer */ }
    }

    async addToCart() {
      if (!this.result) return;
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true; this.addBtn.textContent = 'Legger i handlekurven …'; this.msg.textContent = '';
      try {
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        fd.append('properties[Stil]', this.styleLabel(this.result.style));
        fd.append('properties[Bilde]', new File([b64ToBlob(this.result.b64, 'image/png')], `bilflis-${this.result.style}.png`, { type: 'image/png' }));
        if (this.photo) fd.append('properties[Bilfoto]', new File([this.photo.blob], 'bilfoto.jpg', { type: 'image/jpeg' }));
        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const resp = await fetch(root + 'cart/add.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          let desc = ''; try { desc = (await resp.json()).description || ''; } catch (e) { /* ignorer */ }
          throw new Error(desc || `HTTP ${resp.status}`);
        }
        try { sessionStorage.removeItem(SAVE_KEY); } catch (e) { /* ignorer */ }
        this.addBtn.textContent = 'Lagt i handlekurven ✔';
        window.location.href = this.cartUrl;
      } catch (e) {
        console.error(e);
        this.msg.textContent = `Noe gikk galt: ${e.message}. Prøv igjen, eller kontakt oss.`;
        this.updateButton();
      }
    }
  }

  function mountAll() {
    document.querySelectorAll('[data-bilflis-editor]:not(.bilflis-editor)').forEach((el) => {
      try { el._bfEditor = new BilflisEditor(el); } catch (e) {
        console.error('Bilflis-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Verktøyet kunne ikke starte: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
