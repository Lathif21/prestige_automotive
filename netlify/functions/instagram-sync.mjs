/* Dagelijkse Instagram-sync — Netlify Scheduled Function
   ─────────────────────────────────────────────────────────────
   Vernieuwt het Instagram-token (elke 7 dagen), haalt de recentste
   berichten op en bewaart ze in Netlify Blobs. GET /api/instagram
   (instagram.mjs) serveert die kopie aan galerij.html.

   Dagelijks, en niet enkel bij een nieuw bericht, omdat de beeld-URL's
   van Instagram na enkele dagen verlopen. Een verse kopie per dag houdt
   ze geldig.

   Het token komt er via de koppellink (instagram-connect.mjs), die na
   het koppelen zelf al een eerste sync doet. Enkel na het handmatig
   zetten van INSTAGRAM_TOKEN: Netlify → Functions → instagram-sync →
   "Run now", anders wacht de galerij tot de volgende nacht.

   Environment variables:
     INSTAGRAM_TOKEN      optioneel, noodweg: een handmatig verkregen
                          long-lived token (secret)
     INSTAGRAM_ALERT_TO   wie een mail krijgt als de sync faalt
                          (standaard: de ontwikkelaar)
     RESEND_API_KEY       hergebruikt van het contactformulier, voor die mail
     CONTACT_FROM         idem, afzender
   Zie docs/INSTAGRAM-FEED-TECHNICAL.md.
   ───────────────────────────────────────────────────────────── */

import { getStore } from '@netlify/blobs';
import { STORE_NAME, syncInstagram } from '../lib/instagram.mjs';

export const config = { schedule: '@daily' };

const DEFAULT_ALERT_TO = 'lathif.sihab-dewantoro@drpbuildlab.com';
const DEFAULT_FROM     = 'Prestige Automotive <onboarding@resend.dev>';

async function sendAlert(problems) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Instagram-alert niet verzonden: RESEND_API_KEY ontbreekt');
    return;
  }

  const text =
    'De dagelijkse Instagram-sync van prestige-automotive.be meldt:\n\n' +
    problems.map((p) => `- ${p}`).join('\n') +
    '\n\nDe galerij blijft de laatst opgehaalde berichten tonen, of de vaste ' +
    "foto's als er nog niets opgehaald is. Uitleg en herstel: " +
    'docs/INSTAGRAM-FEED-TECHNICAL.md → Onderhoud.\n';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || DEFAULT_FROM,
        to: [process.env.INSTAGRAM_ALERT_TO || DEFAULT_ALERT_TO],
        subject: 'Instagram-feed galerij — actie nodig',
        text
      })
    });
    if (!res.ok) console.error('Instagram-alert: Resend-fout', res.status, await res.text());
  } catch (err) {
    console.error('Instagram-alert: Resend onbereikbaar:', err.message);
  }
}

export default async () => {
  let report;
  let failure;

  try {
    report = await syncInstagram({
      store: getStore(STORE_NAME),
      env: process.env,
      fetch,
      now: Date.now()
    });
    console.log(`Instagram-sync: ${report.posts} berichten opgeslagen` +
                (report.refreshed ? ', token vernieuwd' : ''));
    for (const w of report.warnings) console.warn('Instagram-sync:', w);
  } catch (err) {
    failure = err;
    console.error('Instagram-sync mislukt:', err.message);
  }

  const problems = [...(failure ? [failure.message] : []), ...(report?.alerts || [])];
  for (const a of report?.alerts || []) console.error('Instagram-sync:', a);
  if (problems.length) await sendAlert(problems);

  return new Response(null, { status: 204 });
};
