/* Instagram-feed — gedeelde logica
   ─────────────────────────────────────────────────────────────
   Gebruikt door twee Netlify Functions:
     netlify/functions/instagram-sync.mjs   dagelijks: token vernieuwen,
                                            berichten ophalen, opslaan
     netlify/functions/instagram.mjs        GET /api/instagram: serveert
                                            de opgeslagen berichten

   Dit bestand importeert bewust niets van Netlify: de opslag (Netlify
   Blobs), fetch en de klok worden meegegeven, zodat de logica ook
   zonder Netlify te testen is.

   Het token leeft enkel server-side. De browser ziet alleen de
   opgeslagen berichten, nooit de sleutel.

   Tokenlevenscyclus (Instagram API with Instagram Login):
     - een long-lived token is 60 dagen geldig
     - vernieuwen kan zodra het minstens 24 uur oud is
     - een token dat 60 dagen niet vernieuwd is, is definitief dood;
       dan moet de klant opnieuw inloggen (zie docs/INSTAGRAM-FEED-SETUP.md)
   We vernieuwen elke 7 dagen, zodat een paar mislukte pogingen op rij
   nog ruim binnen de 60 dagen vallen.
   ───────────────────────────────────────────────────────────── */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const STORE_NAME = 'instagram';
export const FEED_KEY   = 'feed';
export const TOKEN_KEY  = 'token';

const IG_API       = 'https://graph.instagram.com';
const IG_AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const IG_CODE_SWAP = 'https://api.instagram.com/oauth/access_token';
const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_REDIRECT_URI = 'https://prestige-automotive.be/api/instagram/connect';
const DEFAULT_USERNAME     = '_prestige_automotive';
const STATE_MAX_AGE        = 30 * 60 * 1000;   // tijd om in te loggen

const REFRESH_EVERY      = 7 * DAY;
const ALERT_AFTER_FAILS  = 3;        // mislukte vernieuwingen op rij
const ALERT_DAYS_LEFT    = 14;       // waarschuw als het token bijna verloopt
const FETCH_LIMIT        = 20;       // iets meer dan de galerij toont (15)

// thumbnail_url bestaat enkel bij video; carrousels geven hun items via children.
const FIELDS = [
  'id', 'caption', 'media_type', 'media_url', 'thumbnail_url', 'permalink',
  'timestamp', 'children{media_type,media_url,thumbnail_url}'
].join(',');

const hash = (s) => createHash('sha256').update(s).digest('hex');

// Een <img> kan geen video tonen: neem bij video de thumbnail, bij een
// carrousel het eerste item.
export function pickImage(m) {
  if (m.media_type === 'VIDEO') return m.thumbnail_url;
  if (m.media_type === 'CAROUSEL_ALBUM') {
    const first = m.children?.data?.[0];
    if (first) return first.media_type === 'VIDEO' ? first.thumbnail_url : first.media_url;
  }
  return m.media_url;
}

// Vorm die assets/js/instagram-feed.js verwacht: mediaUrl, permalink, caption.
export function toPost(m) {
  const mediaUrl = pickImage(m);
  if (!mediaUrl) return null;
  return {
    id: m.id,
    mediaUrl,
    permalink: m.permalink,
    caption: m.caption || '',
    timestamp: m.timestamp
  };
}

async function igGet(fetchFn, path, params, timeoutMs = 8000) {
  const url = new URL(path, IG_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Nooit de URL loggen: daar staat het token in.
    throw new Error(`Instagram ${res.status} op ${path}: ${body.error?.message || 'onbekende fout'}`);
  }
  return body;
}

/* Eén synchronisatie. Gooit een fout als er geen nieuwe berichten
   opgeslagen konden worden; de vorige feed blijft dan gewoon staan.

   Geeft terug:
     posts     aantal opgeslagen berichten
     refreshed of het token deze keer vernieuwd is
     warnings  enkel loggen
     alerts    loggen én mailen — iemand moet ingrijpen */
export async function syncInstagram({ store, env, fetch: fetchFn, now, timeoutMs }) {
  const warnings = [];
  const alerts = [];

  // Het token komt normaal in Blobs via de koppellink (connectInstagram).
  // Noodweg: INSTAGRAM_TOKEN in Netlify. Zet je daar een nieuwe waarde, dan
  // herkennen we dat aan de hash en starten we daarvan.
  const seed = env.INSTAGRAM_TOKEN;
  const seedHash = seed ? hash(seed) : null;

  let tok = await store.get(TOKEN_KEY, { type: 'json' });
  if (seedHash && tok?.seedHash !== seedHash) {
    tok = { token: seed, seedHash, refreshedAt: null, expiresAt: null, refreshFailures: 0 };
    await store.setJSON(TOKEN_KEY, tok);
  }
  if (!tok?.token) {
    throw new Error('Geen Instagram-token. Laat de klant de koppellink /api/instagram/connect doorlopen, of zet INSTAGRAM_TOKEN in Netlify.');
  }

  let refreshed = false;
  if (!tok.refreshedAt || now - tok.refreshedAt >= REFRESH_EVERY) {
    try {
      const r = await igGet(fetchFn, '/refresh_access_token', {
        grant_type: 'ig_refresh_token',
        access_token: tok.token
      }, timeoutMs);
      tok = {
        ...tok,
        token: r.access_token || tok.token,
        refreshedAt: now,
        expiresAt: r.expires_in ? now + r.expires_in * 1000 : null,
        refreshFailures: 0
      };
      refreshed = true;
    } catch (err) {
      // Een vers token (< 24 u) weigert Instagram te vernieuwen; dat is
      // normaal op dag één. Pas na een paar keer op rij is het een probleem.
      tok = { ...tok, refreshFailures: (tok.refreshFailures || 0) + 1 };
      const msg = `Token vernieuwen mislukt (${tok.refreshFailures}× op rij): ${err.message}`;
      (tok.refreshFailures >= ALERT_AFTER_FAILS ? alerts : warnings).push(msg);
    }
    await store.setJSON(TOKEN_KEY, tok);
  }

  if (tok.expiresAt) {
    const daysLeft = Math.floor((tok.expiresAt - now) / DAY);
    if (daysLeft <= ALERT_DAYS_LEFT) {
      alerts.push(`Het Instagram-token verloopt over ${daysLeft} dag(en). Zonder vernieuwing stopt de feed en moet de klant opnieuw inloggen.`);
    }
  }

  const media = await igGet(fetchFn, '/me/media', {
    fields: FIELDS,
    limit: String(FETCH_LIMIT),
    access_token: tok.token
  }, timeoutMs);

  const posts = (media.data || []).map(toPost).filter(Boolean);
  if (!posts.length) {
    throw new Error('Instagram gaf geen bruikbare berichten terug.');
  }

  await store.setJSON(FEED_KEY, { updatedAt: new Date(now).toISOString(), posts });

  return { posts: posts.length, refreshed, warnings, alerts };
}

/* ── Koppelen: de klant keurt goed, de site maakt zelf het token ──
   1. /api/instagram/connect zonder ?code  → doorsturen naar Instagram
   2. de klant logt in en keurt goed       → Instagram stuurt terug naar
      /api/instagram/connect?code=…&state=…
   3. code → kortlopend token → token van 60 dagen → opslaan in Blobs

   De link mag vrij gedeeld worden: enkel wie als @_prestige_automotive
   inlogt, kan de galerij koppelen. Een ander account wordt geweigerd en
   zijn token weggegooid. */

export class ConnectError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

function connectSettings(env) {
  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET) {
    throw new ConnectError('config', 'INSTAGRAM_APP_ID of INSTAGRAM_APP_SECRET ontbreekt in Netlify.');
  }
  return {
    appId: env.INSTAGRAM_APP_ID,
    appSecret: env.INSTAGRAM_APP_SECRET,
    // Moet letterlijk overeenkomen met de redirect-URL in het Meta-dashboard.
    redirectUri: env.INSTAGRAM_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    username: (env.INSTAGRAM_USERNAME || DEFAULT_USERNAME).replace(/^@/, '').toLowerCase()
  };
}

// state = tijdstip + handtekening: bewijst dat de terugkeer van Instagram
// hoort bij een link die deze site zelf recent uitgaf.
const signState = (secret, ts) =>
  createHmac('sha256', secret).update(`instagram-connect:${ts}`).digest('hex');

function stateIsValid(secret, state, now) {
  const [ts, sig] = String(state || '').split('.');
  if (!ts || !sig || !(now - Number(ts) >= 0 && now - Number(ts) <= STATE_MAX_AGE)) return false;
  const want = Buffer.from(signState(secret, ts));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function authorizeUrl(env, now) {
  const s = connectSettings(env);
  const url = new URL(IG_AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: s.appId,
    redirect_uri: s.redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic',     // enkel lezen
    state: `${now}.${signState(s.appSecret, now)}`,
    enable_fb_login: '0',
    force_reauth: 'true'                   // altijd opnieuw inloggen: zo kiest de klant bewust het juiste account
  }).toString();
  return url;
}

export async function connectInstagram({ code, state, store, env, fetch: fetchFn, now, timeoutMs = 3000 }) {
  const s = connectSettings(env);
  if (!stateIsValid(s.appSecret, state, now)) {
    throw new ConnectError('expired', 'Ongeldige of verlopen state — de koppellink is ouder dan 30 minuten.');
  }

  // 1. eenmalige code → kortlopend token (1 uur)
  const res = await fetchFn(IG_CODE_SWAP, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    body: new URLSearchParams({
      client_id: s.appId,
      client_secret: s.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: s.redirectUri,
      code
    })
  });
  const body = await res.json().catch(() => ({}));
  const short = body.data?.[0]?.access_token || body.access_token;   // Meta gebruikt beide vormen
  if (!res.ok || !short) {
    throw new ConnectError('exchange',
      `Instagram ${res.status} bij code-omruil: ${body.error_message || body.error?.message || 'geen token ontvangen'}`);
  }

  // 2. kortlopend → 60 dagen
  const long = await igGet(fetchFn, '/access_token', {
    grant_type: 'ig_exchange_token',
    client_secret: s.appSecret,
    access_token: short
  }, timeoutMs);

  // 3. welk account heeft goedgekeurd?
  const me = await igGet(fetchFn, '/me', { fields: 'user_id,username', access_token: long.access_token }, timeoutMs);
  const username = String(me.username || '');
  if (username.toLowerCase() !== s.username) {
    throw new ConnectError('wrong_account', `Ingelogd als @${username || '?'}, verwacht @${s.username}.`,
                           { username, expected: s.username });
  }

  // 4. opslaan. seedHash = het huidige INSTAGRAM_TOKEN (als dat er is), zodat
  //    syncInstagram dit token niet meteen weer vervangt door die env-waarde.
  await store.setJSON(TOKEN_KEY, {
    token: long.access_token,
    seedHash: env.INSTAGRAM_TOKEN ? hash(env.INSTAGRAM_TOKEN) : null,
    refreshedAt: now,                 // vers: pas over 7 dagen vernieuwen
    expiresAt: long.expires_in ? now + long.expires_in * 1000 : null,
    refreshFailures: 0,
    connectedAs: username
  });

  return { username };
}
