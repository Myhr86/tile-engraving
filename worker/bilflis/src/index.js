// Bilflis-server (Cloudflare Worker): tar imot kundens bilfoto og valgt stil, og ber
// OpenAI sette bilen inn i stilbildet. Svaret strømmes rett tilbake til nettleseren
// (Server-Sent Events), med delbilder underveis og det ferdige bildet til slutt.
//
// API-nøkkelen ligger bare her (secret OPENAI_API_KEY), aldri i nettbutikken.
// Antall forsøk begrenses per IP-adresse per døgn og totalt per døgn (KV: LIMITS).
//
// Endepunkter:
//   GET  /status            -> { remaining, perDay }
//   POST /generate          multipart: style=stil1|stil2, photo=<bilde>  -> text/event-stream

export const STYLES = {
  stil1: {
    label: 'Røyk og brostein',
    url: 'https://cdn.shopify.com/s/files/1/0725/2154/7833/files/bilflis-stil1.png?v=1794327800',
    size: '1024x1024',
    prompt: `Image 1 is the style and scene reference. Image 2 is a photo of the customer's car.
Recreate image 1 as closely as possible, but replace the car in it with the customer's car from image 2.
Keep everything else from image 1: the black-and-white monochrome look, the dramatic lighting, the billowing smoke clouds, the dark sky, the herringbone cobblestone ground, the grainy texture, the contrast, the camera angle (low three-quarter front view) and the composition, with the car large and centered in the lower half.
The car must be faithful to image 2: same make, model, body shape, generation, grille, headlights, wheels, trim and details. Show it clean and dramatic like the car in image 1. Do not copy any part of the car in image 1. Remove the license plate text (leave the plate blank or without plate). No text, no logos added, no watermark, no frame.`,
  },
  stil2: {
    label: 'Stormnatt',
    url: 'https://cdn.shopify.com/s/files/1/0725/2154/7833/files/bilflis-stil2.png?v=1794327801',
    size: '1536x1024',
    prompt: `Image 1 is the style and scene reference. Image 2 is a photo of the customer's car.
Recreate image 1 as closely as possible, but replace the car in it with the customer's car from image 2.
Keep everything else from image 1: the black-and-white monochrome look, the dark stormy night sky, the lightning bolt and the glowing street lamp on the right, the swirling mist around the car, the dark cracked asphalt, the glowing headlights, the grainy texture, the contrast and the composition, with the car large in the center-left.
The car must be faithful to image 2: same make, model, body shape, generation, grille, headlights, wheels, trim and details, seen in a three-quarter front view like the car in image 1. Do not copy any part of the car in image 1. Remove the license plate text (leave the plate blank or without plate). No text, no logos added, no watermark, no frame.`,
  },
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-Remaining',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

// ---------- Kvoter (KV). Uten KV-kobling brukes et minne som bare gjelder én instans. ----------
const memory = new Map();
const store = (env) => env.LIMITS || {
  get: async (k) => memory.get(k) ?? null,
  put: async (k, v) => { memory.set(k, v); },
};
const today = () => new Date().toISOString().slice(0, 10);
const ipOf = (req) => req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'ukjent';

async function quota(env, req) {
  const kv = store(env), d = today(), ip = ipOf(req);
  const perIp = +(env.MAX_PER_IP || 3), perDay = +(env.MAX_PER_DAY || 60);
  const ipKey = `ip:${d}:${ip}`, dayKey = `day:${d}`;
  const used = +(await kv.get(ipKey) || 0), total = +(await kv.get(dayKey) || 0);
  return { kv, ipKey, dayKey, used, total, perIp, perDay, remaining: Math.max(0, Math.min(perIp - used, perDay - total)) };
}
async function bump(q, delta) {
  const opts = { expirationTtl: 60 * 60 * 48 };
  await q.kv.put(q.ipKey, String(Math.max(0, q.used + delta)), opts);
  await q.kv.put(q.dayKey, String(Math.max(0, q.total + delta)), opts);
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Stilbildet hentes fra nettbutikkens filer og mellomlagres. STYLE_URL_STIL1/2 kan overstyre adressen.
async function styleImage(env, key) {
  const url = env[`STYLE_URL_${key.toUpperCase()}`] || STYLES[key].url;
  const resp = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!resp.ok) throw new Error(`stilbildet kunne ikke hentes (${resp.status})`);
  return new File([await resp.arrayBuffer()], `${key}.png`, { type: resp.headers.get('Content-Type') || 'image/png' });
}

async function generate(req, env, h) {
  if (!env.OPENAI_API_KEY) return json({ error: 'Serveren mangler API-nøkkel.' }, 500, h);
  let form;
  try { form = await req.formData(); } catch (e) { return json({ error: 'Ugyldig forespørsel.' }, 400, h); }
  const key = String(form.get('style') || ''), photo = form.get('photo');
  const style = STYLES[key];
  if (!style) return json({ error: 'Ukjent stil.' }, 400, h);
  if (!photo || typeof photo === 'string' || !/^image\//.test(photo.type)) return json({ error: 'Last opp et bilde av bilen.' }, 400, h);
  if (photo.size > MAX_PHOTO_BYTES) return json({ error: 'Bildet er for stort (maks 10 MB).' }, 413, h);

  const q = await quota(env, req);
  if (q.remaining <= 0) {
    const msg = q.total >= q.perDay ? 'Dagens kapasitet er brukt opp. Prøv igjen i morgen.' : 'Du har brukt opp forsøkene for i dag. Prøv igjen i morgen, eller kontakt oss.';
    return json({ error: msg, remaining: 0 }, 429, { ...h, 'X-Remaining': '0' });
  }
  await bump(q, +1);           // reserver forsøket før vi bruker penger

  const body = new FormData();
  body.append('model', env.MODEL || 'gpt-image-2');
  body.append('image[]', await styleImage(env, key));
  body.append('image[]', new File([await photo.arrayBuffer()], 'bil.' + (photo.type.split('/')[1] || 'jpg'), { type: photo.type }));
  body.append('prompt', style.prompt);
  body.append('size', style.size);
  body.append('quality', env.QUALITY || 'high');
  body.append('output_format', 'png');
  body.append('stream', 'true');
  body.append('partial_images', '2');
  body.append('safety_identifier', await sha('bilflis:' + ipOf(req)));

  const upstream = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body,
  });
  const remaining = String(q.remaining - 1);
  if (!upstream.ok || !upstream.body) {
    await bump({ ...q, used: q.used + 1, total: q.total + 1 }, -1);   // gi forsøket tilbake
    let detail = '';
    try { detail = (await upstream.json()).error?.message || ''; } catch (e) { /* ignorer */ }
    console.log('OpenAI-feil', upstream.status, detail);
    const blocked = upstream.status === 400 && /safety|moderation|rejected/i.test(detail);
    return json({ error: blocked ? 'Bildet ble avvist av bildetjenesten. Prøv et annet bilde av bilen.' : 'Bildetjenesten svarte ikke som forventet. Prøv igjen om litt.' },
      blocked ? 400 : 502, { ...h, 'X-Remaining': String(q.remaining) });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { ...h, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Remaining': remaining },
  });
}

export default {
  async fetch(req, env) {
    const { ok, headers: h } = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: h });
    if (!ok) return json({ error: 'Ikke tillatt.' }, 403, h);
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (req.method === 'GET' && path === '/status') {
        const q = await quota(env, req);
        return json({ remaining: q.remaining, perDay: q.perIp, styles: Object.fromEntries(Object.entries(STYLES).map(([k, s]) => [k, s.label])) }, 200, h);
      }
      if (req.method === 'POST' && path === '/generate') return await generate(req, env, h);
      return json({ error: 'Ikke funnet.' }, 404, h);
    } catch (e) {
      console.log('Feil', e && e.stack || e);
      const why = String(e && e.message || e).replace(/sk-[\w-]+/g, '…').slice(0, 160);
      return json({ error: `Noe gikk galt på serveren (${why}). Prøv igjen.` }, 500, h);
    }
  },
};
