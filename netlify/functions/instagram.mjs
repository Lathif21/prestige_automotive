/* GET /api/instagram — Netlify Function
   ─────────────────────────────────────────────────────────────
   Serveert de Instagram-berichten die instagram-sync.mjs dagelijks in
   Netlify Blobs bewaart. Praat zelf nooit met Instagram en kent het
   token niet: een bezoeker kan via deze URL dus niets lekken of
   Instagram's limieten opgebruiken.

   Antwoord: { updatedAt, posts: [{ id, mediaUrl, permalink, caption, timestamp }] }
   — de vorm die assets/js/instagram-feed.js leest.

   Nog niets gesynchroniseerd → 404, en de galerij toont de vaste foto's.

   De route /api/instagram wordt in netlify.toml naar deze functie
   gestuurd, net als /api/contact.
   ───────────────────────────────────────────────────────────── */

import { getStore } from '@netlify/blobs';
import { FEED_KEY, STORE_NAME } from '../lib/instagram.mjs';

const json = (status, body, cache) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...cache
    }
  });

// Een fout of lege feed niet cachen: na de eerste sync moet de galerij
// meteen kunnen overschakelen.
const NO_CACHE = { 'Cache-Control': 'no-store' };

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' }
    });
  }

  let feed;
  try {
    feed = await getStore(STORE_NAME).get(FEED_KEY, { type: 'json' });
  } catch (err) {
    console.error('Instagram-feed: Blobs onbereikbaar:', err.message);
    return json(503, { posts: [] }, NO_CACHE);
  }

  if (!feed?.posts?.length) return json(404, { posts: [] }, NO_CACHE);

  // De feed wijzigt één keer per dag. Browser 5 min, Netlify-CDN 1 uur.
  return json(200, feed, {
    'Cache-Control': 'public, max-age=300',
    'Netlify-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
  });
};
