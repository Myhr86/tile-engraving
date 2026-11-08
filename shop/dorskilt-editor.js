// Kunde-editor for dørskilt i akryl: topptekst (+ valgfri linje 2), motiv i midten
// og navn i bunnen (to linjer). Monteres på [data-dorskilt-editor].
(function () {
  'use strict';
  const TE = window.TextEngrave, DS = window.DoorSign;
  const EXAMPLE = { top1: 'Velkommen', top2: 'til vårt hjem', names: ['Ola • Kari', 'Emma • Jonas'] };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v; else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  };
  const toBlob = (c, t, q) => new Promise((r) => c.toBlob(r, t, q));
  const insertAt = (input, txt) => {
    const pos = input.selectionStart ?? input.value.length;
    input.value = (input.value.slice(0, pos) + txt + input.value.slice(input.selectionEnd ?? pos)).replace(/\s{2,}/g, ' ').trimStart();
    input.focus();
  };

  class DorskiltEditor {
    constructor(root) {
      this.root = root;
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.exportUrl = root.dataset.exportUrl || '';
      this.font = 'dancing';
      this.motif = 'fjell';
      this.build();
      this.loadFontFaces();
      this.schedule();
    }

    loadFontFaces() {
      if (!window.FontFace) return;
      for (const k of Object.keys(TE.FONTS)) TE.fontBuffer(k).then((b) => new FontFace('te-' + k, b).load()).then((f) => document.fonts.add(f)).catch(() => {});
    }

    build() {
      const r = this.root;
      r.classList.add('flis-editor', 'tekst-editor', 'dorskilt-editor');
      r.innerHTML = '';
      this.canvas = h('canvas', { class: 'te-canvas', 'aria-label': 'Forhåndsvisning av dørskiltet' });
      this.badge = h('span', { class: 'te-badge' }, 'Eksempel');
      const input = (ph, max) => h('input', { type: 'text', maxlength: max, placeholder: ph, oninput: () => this.schedule() });
      this.top1 = input('f.eks. Velkommen', 24);
      this.top2 = input('f.eks. til vårt hjem (valgfri)', 30);
      this.name1 = input('f.eks. Ola • Kari', 32);
      this.name2 = input('f.eks. Emma • Jonas (valgfri)', 32);
      this.fontChips = Object.entries(TE.FONTS).map(([k, f]) => h('button', { type: 'button', class: 'fe-chip te-font', 'data-v': k,
        style: `font-family:'te-${k}',serif`, onclick: () => { this.font = k; this.sync(); this.schedule(); } }, f.label));
      this.motifChips = Object.entries(DS.MOTIFS).map(([k, m]) => h('button', { type: 'button', class: 'fe-chip ds-motif', 'data-v': k, title: m.label,
        onclick: () => { this.motif = k; this.sync(); this.schedule(); } }, h('span', { class: 'ds-icon', html: DS.motifIcon(k) || '–' }), h('span', {}, m.label)));
      const dotBtn = (inp) => h('button', { type: 'button', class: 'fe-btn te-heart', title: 'Sett inn prikk mellom navn', onclick: () => { insertAt(inp, ' • '); this.schedule(); } }, '•');
      this.info = h('p', { class: 'fe-hint' });
      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant', h('select', { onchange: (e) => { this.variantId = +e.target.value; this.updateButton(); } },
          this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }

      r.append(...[
        h('div', { class: 'te-preview' }, this.canvas, this.badge),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Tekst øverst'),
          h('label', { class: 'fe-field' }, 'Topptekst', this.top1),
          h('div', { class: 'fe-row te-fonts' }, this.fontChips),
          h('label', { class: 'fe-field' }, 'Linje 2 (valgfri)', this.top2)),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Motiv'), h('div', { class: 'fe-row ds-motifs' }, this.motifChips)),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Navn'),
          h('label', { class: 'fe-field' }, 'Linje 1', h('div', { class: 'te-inputrow' }, this.name1, dotBtn(this.name1))),
          h('label', { class: 'fe-field' }, 'Linje 2 (valgfri)', h('div', { class: 'te-inputrow' }, this.name2, dotBtn(this.name2))),
          h('p', { class: 'fe-hint' }, 'Linje 2 under topptekst og navnene graveres med store bokstaver. Bruk • for å skille navn.')),
        variantEl, this.info,
        h('p', { class: 'fe-note' }, `Sort akryl med hvit gravering, ${DS.SIGN.w} × ${DS.SIGN.h} mm. Vi sjekker hver tekst før gravering.`),
        this.addBtn, this.msg,
      ].filter(Boolean));
      this.sync();
    }

    sync() {
      for (const c of this.fontChips) c.classList.toggle('active', c.dataset.v === this.font);
      for (const c of this.motifChips) c.classList.toggle('active', c.dataset.v === this.motif);
      this.updateButton();
    }

    isEmpty() { return ![this.top1, this.top2, this.name1, this.name2].some((x) => x.value.trim()); }

    recipe(example) {
      return { v: 1, type: 'dorskilt', product: 'dorskilt', motif: this.motif,
        top1: { text: example ? EXAMPLE.top1 : this.top1.value.trim(), font: this.font },
        top2: example ? EXAMPLE.top2 : this.top2.value.trim(),
        names: example ? EXAMPLE.names : [this.name1.value.trim(), this.name2.value.trim()] };
    }

    schedule() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(async () => { this.pending = false; await this.render(); });
    }

    async render() {
      const example = this.isEmpty();
      try { this.lay = await DS.layout(this.recipe(example)); } catch (e) {
        console.error(e); this.msg.textContent = `Klarte ikke å laste skriftene (${e.message}). Last siden på nytt.`; return;
      }
      this.badge.hidden = !example;
      DS.render(this.canvas, this.lay, { ppm: 5 });
      const small = !example && this.lay.names && this.lay.names.sizes.some((s) => s.heightMm < 4.5);
      this.info.textContent = small ? 'Navnene blir ganske små. Kortere linjer gir større bokstaver.' : '';
      this.updateButton();
    }

    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      this.addBtn.disabled = false;
      this.addBtn.textContent = this.isEmpty() ? 'Skriv teksten først' : `Legg i handlekurven${v ? ' – ' + v.price : ''}`;
    }

    async addToCart() {
      if (this.isEmpty()) { this.top1.focus(); return; }
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true; this.addBtn.textContent = 'Legger i handlekurven …'; this.msg.textContent = '';
      try {
        const r = this.recipe(false);
        const lay = await DS.layout(r);
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        if (r.top1.text) fd.append('properties[Topptekst]', r.top1.text);
        if (r.top2) fd.append('properties[Linje 2]', r.top2.toUpperCase());
        fd.append('properties[Motiv]', DS.MOTIFS[r.motif].label);
        const nm = r.names.filter(Boolean).map((n) => n.toUpperCase());
        if (nm.length) fd.append('properties[Navn]', nm.join(' / '));
        fd.append('properties[Skrift]', TE.FONTS[r.top1.font].label);
        const c = document.createElement('canvas');
        DS.render(c, lay, { ppm: 5 });
        fd.append('properties[Forhåndsvisning]', new File([await toBlob(c, 'image/jpeg', 0.9)], 'forhandsvisning.jpg', { type: 'image/jpeg' }));
        fd.append('properties[_Oppskrift]', JSON.stringify(r));
        if (this.exportUrl && window.TekstOppskrift) fd.append('properties[_SVG-fil]', this.exportUrl + '#' + window.TekstOppskrift.encode(r));
        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const resp = await fetch(root + 'cart/add.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          let desc = ''; try { desc = (await resp.json()).description || ''; } catch (e) { /* ignorer */ }
          throw new Error(desc || `HTTP ${resp.status}`);
        }
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
    document.querySelectorAll('[data-dorskilt-editor]:not(.dorskilt-editor)').forEach((el) => {
      try { el._dsEditor = new DorskiltEditor(el); } catch (e) {
        console.error('Dørskilt-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Verktøyet kunne ikke starte: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
