// Kunde-editor for dåpstavlen: navn, fødselsdato og klokkeslett, vekt, lengde og
// tekstene i banneret og boksen. Viser tavlen med en gang. Monteres på [data-dapstavle-editor].
(function () {
  'use strict';
  const TE = window.TextEngrave, BB = window.BaptismBoard;
  const BOX_SUGGESTIONS = ['Lille skatten', 'Lille prinsesse', 'Lille prins', 'Lille gullet'];

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
  const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

  class DapstavleEditor {
    constructor(root) {
      this.root = root;
      this.variants = JSON.parse(root.dataset.variants || '[]');
      this.variantId = (this.variants.find((v) => v.available) || this.variants[0] || {}).id;
      this.cartUrl = root.dataset.cartUrl || '/cart';
      this.exportUrl = root.dataset.exportUrl || '';
      this.build();
      this.schedule();
    }

    build() {
      const r = this.root;
      r.classList.add('flis-editor', 'tekst-editor', 'dapstavle-editor');
      r.innerHTML = '';
      this.canvas = h('canvas', { class: 'te-canvas', 'aria-label': 'Forhåndsvisning av dåpstavlen' });
      this.badge = h('span', { class: 'te-badge' }, 'Eksempel');
      const input = (attrs) => h('input', { type: 'text', oninput: () => this.schedule(), onchange: () => this.schedule(), ...attrs });
      this.name = input({ maxlength: 14, placeholder: 'f.eks. Peder', autocomplete: 'off' });
      this.date = input({ type: 'date' });
      this.time = input({ type: 'time' });
      this.weight = input({ inputmode: 'numeric', maxlength: 5, placeholder: 'f.eks. 3450' });
      this.length = input({ inputmode: 'decimal', maxlength: 4, placeholder: 'f.eks. 49' });
      this.box = input({ maxlength: 24, value: 'Lille skatten' });
      this.banner = input({ maxlength: 26, value: 'Velkommen til verden' });
      this.boxChips = BOX_SUGGESTIONS.map((t) => h('button', { type: 'button', class: 'fe-chip', onclick: () => { this.box.value = t; this.schedule(); } }, t));
      this.info = h('p', { class: 'fe-hint' });
      this.addBtn = h('button', { type: 'button', class: 'fe-add', onclick: () => this.addToCart() });
      this.msg = h('p', { class: 'fe-msg', role: 'status' });

      let variantEl = null;
      if (this.variants.length > 1) {
        variantEl = h('label', { class: 'fe-field' }, 'Variant', h('select', { onchange: (e) => { this.variantId = +e.target.value; this.updateButton(); } },
          this.variants.map((v) => h('option', { value: v.id, disabled: !v.available, selected: v.id === this.variantId }, `${v.title} – ${v.price}`))));
      }
      const field = (label, el) => h('label', { class: 'fe-field' }, label, el);
      r.append(...[
        h('div', { class: 'te-preview' }, this.canvas, this.badge),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Barnet'),
          field('Navn', this.name),
          h('div', { class: 'dt-pair' }, field('Fødselsdato', this.date), field('Klokkeslett', this.time)),
          h('div', { class: 'dt-pair' }, field('Vekt (gram)', this.weight), field('Lengde (cm)', this.length))),
        h('div', { class: 'fe-section' }, h('h3', {}, 'Tekster'),
          field('Tekst i boksen', this.box),
          h('div', { class: 'fe-row dt-chips' }, this.boxChips),
          field('Tekst i banneret', this.banner)),
        variantEl, this.info,
        h('p', { class: 'fe-note' }, 'Ukedagen regnes ut fra datoen, og klokka på tavlen viser klokkeslettet. Vi sjekker hver tekst før gravering.'),
        this.addBtn, this.msg,
      ].filter(Boolean));
      this.updateButton();
    }

    isEmpty() { return ![this.name, this.date, this.time, this.weight, this.length].some((x) => x.value.trim()); }

    recipe(example) {
      const E = BB.EXAMPLE, v = (el) => el.value.trim();
      return { v: 1, type: 'dapstavle', product: 'dapstavle',
        banner: v(this.banner), box: v(this.box),
        name: example ? E.name : v(this.name), date: example ? E.date : v(this.date), time: example ? E.time : v(this.time),
        weight: example ? E.weight : v(this.weight).replace(/\D/g, ''), length: example ? E.length : v(this.length).replace(/[^\d.,]/g, '') };
    }

    schedule() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(async () => { this.pending = false; await this.render(); });
    }

    async render() {
      const example = this.isEmpty();
      try { this.lay = await BB.layout(this.recipe(example)); } catch (e) {
        console.error(e); this.msg.textContent = `Klarte ikke å laste skriftene (${e.message}). Last siden på nytt.`; return;
      }
      this.badge.hidden = !example;
      BB.render(this.canvas, this.lay, { ppm: 6 });
      this.info.textContent = this.missing().length && !example ? `Mangler: ${this.missing().join(', ')}.` : '';
      this.updateButton();
    }

    missing() {
      const m = [];
      if (!this.name.value.trim()) m.push('navn');
      if (!this.date.value) m.push('fødselsdato');
      if (!this.time.value) m.push('klokkeslett');
      if (!this.weight.value.trim()) m.push('vekt');
      if (!this.length.value.trim()) m.push('lengde');
      return m;
    }

    updateButton() {
      const v = this.variants.find((x) => x.id === this.variantId);
      if (v && !v.available) { this.addBtn.textContent = 'Utsolgt'; this.addBtn.disabled = true; return; }
      const miss = this.missing();
      this.addBtn.disabled = false;
      this.addBtn.textContent = miss.length ? 'Fyll inn navn, dato, klokkeslett, vekt og lengde' : `Legg i handlekurven${v ? ' – ' + v.price : ''}`;
    }

    async addToCart() {
      const miss = this.missing();
      if (miss.length) {
        this.msg.textContent = `Fyll inn ${miss.join(', ')}.`;
        ({ navn: this.name, fødselsdato: this.date, klokkeslett: this.time, vekt: this.weight, lengde: this.length })[miss[0]].focus();
        return;
      }
      if (!this.variantId) { this.msg.textContent = 'Produktet mangler variant. Kontakt butikken.'; return; }
      this.addBtn.disabled = true; this.addBtn.textContent = 'Legger i handlekurven …'; this.msg.textContent = '';
      try {
        const r = this.recipe(false);
        const lay = await BB.layout(r);
        const dp = BB.dateParts(r.date);
        const fd = new FormData();
        fd.append('id', this.variantId);
        fd.append('quantity', 1);
        fd.append('properties[Navn]', r.name);
        fd.append('properties[Født]', `${dp ? cap(dp.weekday) + ' ' + dp.d + '.' + dp.m + '.' + dp.y : r.date} kl. ${r.time}`);
        fd.append('properties[Vekt]', `${r.weight} gram`);
        fd.append('properties[Lengde]', `${r.length.replace('.', ',')} cm`);
        if (r.box) fd.append('properties[Tekst i boksen]', r.box);
        if (r.banner) fd.append('properties[Tekst i banneret]', r.banner);
        const c = document.createElement('canvas');
        BB.render(c, lay, { ppm: 6 });
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
    document.querySelectorAll('[data-dapstavle-editor]:not(.dapstavle-editor)').forEach((el) => {
      try { el._dtEditor = new DapstavleEditor(el); } catch (e) {
        console.error('Dåpstavle-editor:', e);
        el.innerHTML = '<p style="color:#b00020;text-align:center">Verktøyet kunne ikke starte: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p>';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('shopify:section:load', mountAll);
})();
