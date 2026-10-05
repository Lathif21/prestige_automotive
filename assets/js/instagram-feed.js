/* Prestige Automotive — Instagram feed
   ─────────────────────────────────────────────────────────────
   Leest de recentste Instagram-berichten van @_prestige_automotive via
   /api/instagram. Dat is een Netlify Function die een kopie serveert
   uit Netlify Blobs; een dagelijkse scheduled function houdt die kopie
   en het Instagram-token up-to-date (zie netlify/functions/ en
   docs/INSTAGRAM-FEED-TECHNICAL.md). Het token komt dus nooit in de
   browser.

   Werkt de feed niet — nog niets gesynchroniseerd, Netlify of Instagram
   onbereikbaar, of de site draait ergens zonder die functions (lokaal,
   Combell) — dan blijft de bestaande vaste fotogalerij staan. De pagina
   breekt dus nooit.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CONFIG = {
    // Leeg laten schakelt de feed uit; de vaste galerij blijft dan staan.
    FEED_URL: '/api/instagram',
    PROFILE_URL: 'https://www.instagram.com/_prestige_automotive',
    LIMIT: 15
  };

  var grid = document.getElementById('ig-grid');
  if (!grid) return;

  var fallback = document.getElementById('gallery-fallback');

  if (!CONFIG.FEED_URL) return; // niets geconfigureerd → vaste galerij blijft staan

  fetch(CONFIG.FEED_URL, { mode: 'cors' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      // /api/instagram geeft { posts: [...] }; een kale array mag ook
      var posts = Array.isArray(data) ? data : (data.posts || []);
      if (!posts.length) throw new Error('lege feed');

      var frag = document.createDocumentFragment();
      posts.slice(0, CONFIG.LIMIT).forEach(function (p) {
        var src = p.sizes && p.sizes.medium ? p.sizes.medium.mediaUrl
                : (p.mediaUrl || p.thumbnailUrl || p.media_url);
        if (!src) return;

        var a = document.createElement('a');
        a.className = 'ig-item rev in';
        a.href = p.permalink || CONFIG.PROFILE_URL;
        a.target = '_blank';
        a.rel = 'noopener';

        var img = document.createElement('img');
        img.src = src;
        img.loading = 'lazy';
        img.alt = (p.caption || 'Instagram-bericht van Prestige Automotive')
                    .split('\n')[0].slice(0, 120);
        a.appendChild(img);

        var ov = document.createElement('span');
        ov.className = 'ig-item__overlay';
        ov.innerHTML = '<svg width="24" height="24" fill="none" stroke="#000" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="1.2" fill="#000" stroke="none"/></svg>';
        a.appendChild(ov);

        frag.appendChild(a);
      });

      if (!frag.childNodes.length) throw new Error('geen bruikbare media');

      grid.innerHTML = '';
      grid.appendChild(frag);
      grid.hidden = false;
      if (fallback) fallback.hidden = true;
    })
    .catch(function (err) {
      // Feed onbereikbaar → stil terugvallen op de vaste galerij
      if (window.console) console.warn('Instagram-feed niet geladen:', err.message);
      grid.hidden = true;
      if (fallback) fallback.hidden = false;
    });
})();
