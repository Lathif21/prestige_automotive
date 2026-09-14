/* Prestige Automotive — Instagram feed
   ─────────────────────────────────────────────────────────────
   Deze site is statisch (geen server), dus de Instagram Graph API
   kan hier niet rechtstreeks gebruikt worden: die vereist een
   access token, en een token in de broncode is publiek zichtbaar
   én verloopt om de 60 dagen.

   Daarom halen we de feed op via een hosted feed-service die een
   publieke, CORS-vriendelijke JSON-URL geeft (Behold.so heeft een
   gratis plan). De eigenaar koppelt daar éénmalig het Instagram-
   account @_prestige_automotive, kopieert de feed-URL en plakt die
   hieronder. Vanaf dan ververst de galerij zichzelf automatisch.

   Zolang FEED_URL leeg is, blijft de bestaande vaste fotogalerij
   staan — de pagina breekt dus nooit.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CONFIG = {
    // Plak hier de JSON feed-URL (bv. https://feeds.behold.so/XXXXXXXXXXXX)
    FEED_URL: '',
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
      // Behold levert of een array, of { posts: [...] }
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
