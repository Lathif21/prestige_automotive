/* Cloudflare Pages Function — POST /api/contact
   ─────────────────────────────────────────────────────────────
   Verstuurt het contactformulier van contact.html per e-mail via Resend.

   Vereiste environment variables (Cloudflare Pages → Settings →
   Environment variables). Zet ze als "Secret", niet als plain text:

     RESEND_API_KEY   API-sleutel van https://resend.com  (verplicht)
     CONTACT_TO       ontvanger, bv. Geoffrey@prestige-automotive.be
     CONTACT_FROM     afzender op een geverifieerd domein,
                      bv. "Prestige Automotive <website@prestige-automotive.be>"

   CONTACT_TO en CONTACT_FROM hebben veilige defaults (zie onder), zodat een
   preview-omgeving nooit per ongeluk naar de klant mailt.
   ───────────────────────────────────────────────────────────── */

const DEFAULT_TO   = 'lathif.sihab-dewantoro@drpbuildlab.com';
const DEFAULT_FROM = 'Prestige Automotive <onboarding@resend.dev>';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export async function onRequestPost(context) {
  const { request, env } = context;

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

  const voornaam   = (data.voornaam   || '').toString().trim();
  const achternaam = (data.achternaam || '').toString().trim();
  const email      = (data.email      || '').toString().trim();
  const telefoon   = (data.telefoon   || '').toString().trim();
  const service    = (data.service    || '').toString().trim();
  const voertuig   = (data.voertuig   || '').toString().trim();
  const bericht    = (data.bericht    || '').toString().trim();

  if (!voornaam || !achternaam || !email || !service || !bericht) {
    return json(400, { ok: false, error: 'Vul alle verplichte velden in.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: 'Geen geldig e-mailadres.' });
  }
  if (bericht.length > 5000) {
    return json(400, { ok: false, error: 'Bericht is te lang.' });
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY ontbreekt — e-mail niet verzonden');
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM || DEFAULT_FROM,
      to: [env.CONTACT_TO || DEFAULT_TO],
      reply_to: email,
      subject: `Website-aanvraag — ${naam} (${service})`,
      html,
      text
    })
  });

  if (!res.ok) {
    console.error('Resend-fout', res.status, await res.text());
    return json(502, { ok: false, error: 'Verzenden is niet gelukt.' });
  }

  return json(200, { ok: true });
}

// Expliciete methode-handlers: geen catch-all onRequest, want de volgorde
// tussen onRequest en onRequestPost is niet gedocumenteerd en een catch-all
// zou de POST hierboven kunnen overschaduwen.
const methodNotAllowed = () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
