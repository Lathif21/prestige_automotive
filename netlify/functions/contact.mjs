/* POST /api/contact — Netlify Function
   ─────────────────────────────────────────────────────────────
   Verstuurt het contactformulier van contact.html per e-mail via Resend.

   Dit is de derde variant van dezelfde endpoint:
     functions/api/contact.js    Cloudflare Pages Function
     api/contact.php             Combell (Linux, PHP)
     netlify/functions/contact.mjs   ← dit bestand, Netlify

   Houd ze gelijk als je er één aanpast, of gooi weg wat je niet gebruikt.

   De route /api/contact wordt in netlify.toml naar deze functie gestuurd,
   zodat contact.html ongewijzigd blijft.

   Vereiste environment variables (Netlify → Site configuration →
   Environment variables):

     RESEND_API_KEY   API-sleutel van https://resend.com  (verplicht)
     CONTACT_TO       ontvanger, bv. Geoffrey@prestige-automotive.be
     CONTACT_FROM     afzender op een geverifieerd domein,
                      bv. "Prestige Automotive <website@prestige-automotive.be>"
     TURNSTILE_SECRET_KEY  geheime sleutel van de Cloudflare Turnstile-widget.
                      Zolang die ontbreekt, wordt Turnstile niet gecontroleerd
                      en houdt enkel de honeypot bots tegen.

   De foutmeldingen hieronder zijn bewust Nederlands: bezoekers van
   contact.html krijgen ze te zien.
   ───────────────────────────────────────────────────────────── */

const DEFAULT_TO   = 'lathif.sihab-dewantoro@drpbuildlab.com';
const DEFAULT_FROM = 'Prestige Automotive <onboarding@resend.dev>';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  });

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Cloudflare Turnstile — controleert het token dat de widget op contact.html
   in het formulier zet (veld cf-turnstile-response). Een token is eenmalig en
   5 minuten geldig.

   Geeft true terug als de aanvraag door mag. Is Cloudflare zelf onbereikbaar,
   dan laten we de aanvraag door (fail-open): een bot kan die storing niet
   uitlokken, en een gemiste klant weegt zwaarder dan een enkel spambericht. */
async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      // Kort houden: samen met de 8 s voor Resend moet alles binnen Netlify's
      // limiet van 10 s blijven.
      signal: AbortSignal.timeout(1500),
      body
    });
    const out = await res.json();
    if (!out.success) console.warn('Turnstile geweigerd:', out['error-codes']);
    return out.success === true;
  } catch (err) {
    console.error('Turnstile onbereikbaar, aanvraag doorgelaten:', err?.name || err);
    return true;
  }
}

export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' }
    });
  }

  // Het formulier stuurt FormData; JSON wordt ook aanvaard.
  let data;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      data = Object.fromEntries(await request.formData());
    }
  } catch {
    return json(400, { ok: false, error: 'Ongeldige aanvraag.' });
  }

  // Honeypot: bots vullen dit verborgen veld in, mensen zien het niet.
  // Doe alsof het gelukt is — zo leert de bot niets.
  if (data.website) return json(200, { ok: true });

  // Turnstile: hier wél een echte foutmelding. Een mens kan dit oplossen door
  // de controle opnieuw te doen; een bot zonder token leert er niets uit.
  if (!(await turnstileOk(data['cf-turnstile-response'], context?.ip))) {
    return json(400, { ok: false, error: 'De beveiligingscontrole is mislukt. Probeer het opnieuw.' });
  }

  const str = (v) => (v == null ? '' : String(v).trim());

  const voornaam   = str(data.voornaam);
  const achternaam = str(data.achternaam);
  const email      = str(data.email);
  const telefoon   = str(data.telefoon);
  const service    = str(data.service);
  const voertuig   = str(data.voertuig);
  const bericht    = str(data.bericht);

  if (!voornaam || !achternaam || !email || !service || !bericht) {
    return json(400, { ok: false, error: 'Vul alle verplichte velden in.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: 'Geen geldig e-mailadres.' });
  }
  if (bericht.length > 5000) {
    return json(400, { ok: false, error: 'Bericht is te lang.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Resend-fout: RESEND_API_KEY ontbreekt — e-mail niet verzonden');
    return json(500, { ok: false, error: 'E-mail is niet geconfigureerd.' });
  }

  const naam = `${voornaam} ${achternaam}`;
  const rows = [
    ['Naam', naam],
    ['E-mail', email],
    ['Telefoon', telefoon || '—'],
    ['Service', service],
    ['Voertuig', voertuig || '—']
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap">${esc(k)}</td>
         <td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`
  ).join('');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2 style="margin:0 0 4px">Nieuwe aanvraag via de website</h2>
      <p style="margin:0 0 20px;color:#666;font-size:14px">contact.html — Prestige Automotive</p>
      <table style="border-collapse:collapse;font-size:15px">${rows}</table>
      <p style="margin:24px 0 6px;color:#666;font-size:14px">Bericht</p>
      <div style="white-space:pre-wrap;padding:14px;background:#f5f5f3;border-radius:8px;font-size:15px">${esc(bericht)}</div>
    </div>`;

  const text =
    `Nieuwe aanvraag via de website\n\n` +
    `Naam: ${naam}\nE-mail: ${email}\nTelefoon: ${telefoon || '—'}\n` +
    `Service: ${service}\nVoertuig: ${voertuig || '—'}\n\nBericht:\n${bericht}\n`;

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      // Zonder timeout blijft de functie hangen tot Netlify hem afkapt (10 s).
      // De browser ziet dan geen HTTP-antwoord maar een netwerkfout, en toont
      // "Load failed" in plaats van een nette melding. 8 s laat ons binnen de
      // limiet zelf een JSON-fout teruggeven.
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || DEFAULT_FROM,
        to: [process.env.CONTACT_TO || DEFAULT_TO],
        reply_to: email,
        subject: `Website-aanvraag — ${naam} (${service})`,
        html,
        text
      })
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.error('Resend-fout: time-out na 8 s');
    } else {
      console.error('Resend-fout (netwerk):', err);
    }
    return json(502, { ok: false, error: 'Verzenden is niet gelukt.' });
  }

  if (!res.ok) {
    console.error('Resend-fout', res.status, await res.text());
    return json(502, { ok: false, error: 'Verzenden is niet gelukt.' });
  }

  return json(200, { ok: true });
};
