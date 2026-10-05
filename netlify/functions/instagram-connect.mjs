/* GET /api/instagram/connect — Netlify Function
   ─────────────────────────────────────────────────────────────
   De link die de klant krijgt om Instagram aan de galerij te koppelen.

     zonder ?code   → doorsturen naar de Instagram-login
     met ?code      → Instagram stuurt de klant hierheen terug na
                      "Toestaan": code omruilen, token opslaan, meteen
                      een eerste sync, en een bevestigingspagina tonen
     met ?error     → de klant heeft geannuleerd

   De klant ziet dus nooit een token. Wie inlogt met een ander account
   dan @_prestige_automotive wordt geweigerd.

   Environment variables (Netlify):
     INSTAGRAM_APP_ID       "Instagram app ID" uit het Meta-dashboard —
                            niet de gewone Meta App ID
     INSTAGRAM_APP_SECRET   "Instagram app secret" (secret)
     INSTAGRAM_REDIRECT_URI optioneel; standaard
                            https://prestige-automotive.be/api/instagram/connect
     INSTAGRAM_USERNAME     optioneel; standaard _prestige_automotive
   Zie docs/INSTAGRAM-FEED-TECHNICAL.md §6.

   De teksten op de pagina's zijn Nederlands: de klant krijgt ze te zien.
   ───────────────────────────────────────────────────────────── */

import { getStore } from '@netlify/blobs';
import {
  STORE_NAME, ConnectError, authorizeUrl, connectInstagram, syncInstagram
} from '../lib/instagram.mjs';

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(status, title, message, ok = false) {
  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — Prestige Automotive</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f3;
       font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1a1a;padding:16px;box-sizing:border-box}
  main{max-width:440px;background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 2px 14px rgba(0,0,0,.07)}
  .mark{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:22px;
        color:#fff;background:${ok ? '#2e7d4f' : '#b3261e'};margin-bottom:16px}
  h1{font-size:21px;margin:0 0 8px} p{margin:0 0 20px;color:#444}
  a{display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px}
</style></head>
<body><main>
  <div class="mark">${ok ? '✓' : '!'}</div>
  <h1>${esc(title)}</h1>
  <p>${message}</p>
  <a href="/galerij.html">Naar de galerij</a>
</main></body></html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // De URL bevat de eenmalige code; niet doorgeven aan andere sites.
      'Referrer-Policy': 'no-referrer'
    }
  });
}

const FAIL_TEXT = {
  wrong_account: (err) =>
    `Je was ingelogd als <strong>@${esc(err.detail.username || '?')}</strong>. ` +
    `Open de link opnieuw en log in met <strong>@${esc(err.detail.expected)}</strong>.`,
  expired: () =>
    'De link is verlopen (na 30 minuten). Open de koppellink gewoon opnieuw.',
  config: () =>
    'De koppeling is nog niet ingesteld aan de kant van de website. Laat het je webbouwer weten.',
  default: () =>
    'Er ging iets mis bij Instagram. Probeer het over een paar minuten opnieuw; ' +
    'lukt het dan nog niet, laat het je webbouwer weten.'
};

export default async (request) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  const params = new URL(request.url).searchParams;
  const env = process.env;
  const now = Date.now();

  if (params.has('error')) {
    console.warn('Instagram-koppeling geannuleerd:', params.get('error_reason') || params.get('error'));
    return page(200, 'Niet gekoppeld',
      'Je hebt de toegang niet toegestaan, dus er is niets veranderd. ' +
      'Wil je het toch doen? Open de koppellink opnieuw en kies <strong>Toestaan</strong>.');
  }

  try {
    if (!params.has('code')) {
      return Response.redirect(authorizeUrl(env, now).toString(), 302);
    }

    const store = getStore(STORE_NAME);
    const { username } = await connectInstagram({
      code: params.get('code'),
      state: params.get('state'),
      store, env, fetch, now
    });
    console.log(`Instagram gekoppeld als @${username}`);

    // Meteen een eerste sync, zodat de galerij niet tot vannacht wacht.
    // Mislukt die, dan doet de dagelijkse sync het; het token staat al veilig.
    let posts = 0;
    try {
      posts = (await syncInstagram({ store, env, fetch, now, timeoutMs: 3000 })).posts;
    } catch (err) {
      console.warn('Eerste sync na koppelen mislukt, volgt vannacht:', err.message);
    }

    return page(200, 'Gelukt — Instagram is gekoppeld',
      `<strong>@${esc(username)}</strong> is verbonden met de galerij. ` +
      (posts
        ? `Je ${posts} recentste berichten staan nu op de website.`
        : 'Je berichten verschijnen binnen 24 uur op de website.') +
      ' Je hoeft verder niets te doen.', true);
  } catch (err) {
    const code = err instanceof ConnectError ? err.code : 'default';
    console.error('Instagram-koppeling mislukt:', code, err.message);
    return page(code === 'config' ? 503 : 400, 'Koppelen niet gelukt',
      (FAIL_TEXT[code] || FAIL_TEXT.default)(err));
  }
};
