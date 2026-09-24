/* Prestige Automotive — main.js */
(function () {
  'use strict';
  var rm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ── Progress bar ── */
  var pb = document.getElementById('progress-bar');
  if (pb) {
    window.addEventListener('scroll', function () {
      var s = document.documentElement.scrollTop;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      pb.style.width = (h > 0 ? (s / h * 100) : 0) + '%';
    }, { passive: true });
  }

  /* ── Nav solid on scroll ── */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 60); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Active nav link ── */
  (function () {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === path || (path === 'index.html' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  })();

  /* ── Mobile menu ── */
  var burger = document.querySelector('.nav__burger');
  var mobile = document.querySelector('.nav__mobile');
  if (burger && mobile) {
    burger.addEventListener('click', function () {
      var open = burger.classList.toggle('open');
      mobile.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobile.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('open');
        mobile.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Scroll reveals ── */
  if (!rm && 'IntersectionObserver' in window) {
    var fold = window.innerHeight * .92;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var siblings = Array.from(e.target.parentElement.children);
        var idx = siblings.indexOf(e.target);
        setTimeout(function () { e.target.classList.add('in'); }, idx * 65);
        io.unobserve(e.target);
      });
    }, { threshold: .06, rootMargin: '0px 0px -44px 0px' });
    document.querySelectorAll('.rev').forEach(function (el) {
      if (el.getBoundingClientRect().top >= fold) io.observe(el);
      else el.classList.add('in');
    });
  } else {
    document.querySelectorAll('.rev').forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Hero parallax ── */
  var heroBg = document.querySelector('.hero__bg');
  if (heroBg && !rm) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y < window.innerHeight) heroBg.style.transform = 'scale(1.05) translateY(' + (y * .28) + 'px)';
    }, { passive: true });
  }

  /* ── Smooth anchor scroll (offset nav) ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var t = document.getElementById(id);
      if (t) {
        e.preventDefault();
        var off = parseInt(document.body.dataset.anchorOffset, 10) || 72;
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      }
    });
  });

  /* ── Back to top ── */
  var btt = document.getElementById('back-top');
  if (btt) {
    window.addEventListener('scroll', function () { btt.classList.toggle('show', window.scrollY > 600); }, { passive: true });
    btt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ── Counter animation ── */
  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    var isDecimal = target % 1 !== 0;
    var start = 0, dur = 1800, startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var p = Math.min((ts - startTime) / dur, 1);
      var ease = 1 - Math.pow(1 - p, 4);
      var val = start + (target - start) * ease;
      el.textContent = (isDecimal ? val.toFixed(1) : Math.round(val)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (!rm && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: .5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { cio.observe(el); });
  } else {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-item__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── Pricing tabs ── */
  document.querySelectorAll('.price-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.dataset.tab;
      document.querySelectorAll('.price-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.price-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById('panel-' + target);
      if (panel) panel.classList.add('active');
    });
  });

  /* ── Gallery filters ── */
  (function () {
    var filters = document.querySelectorAll('.gal-filter');
    if (!filters.length) return;
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.dataset.filter;
        filters.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.gal-item[data-category]').forEach(function (item) {
          item.hidden = !(want === 'all' || item.dataset.category === want);
        });
      });
    });
  })();

  /* ── Gallery lightbox ── */
  var lb = document.querySelector('.lightbox');
  var lbImg = lb && lb.querySelector('img');
  if (lb) {
    document.querySelectorAll('.gal-item[data-src]').forEach(function (item) {
      item.addEventListener('click', function () {
        lbImg.src = item.dataset.src;
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });
    function closeLb() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /* ── Contact form ── */
  var form = document.querySelector('.form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var status = form.querySelector('.form__status');
      var original = btn.textContent;

      function show(msg, ok) {
        if (!status) return;
        status.textContent = msg;
        status.classList.add('show');
        status.classList.toggle('form__status--error', !ok);
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      btn.textContent = 'Verzenden…';
      btn.disabled = true;
      if (status) { status.classList.remove('show'); }

      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { r: r, b: b }; }); })
        .then(function (res) {
          if (!res.r.ok || !res.b.ok) {
            // Markeren als afkomstig van de server: die meldingen zijn Nederlands
            // en mogen aan de bezoeker getoond worden. Netwerkfouten niet.
            var e = new Error(res.b.error || 'Verzenden is niet gelukt.');
            e.fromServer = true;
            throw e;
          }
          btn.textContent = 'Bericht verstuurd ✓';
          show('Bedankt! We nemen zo snel mogelijk contact met u op.', true);
          form.reset();
          setTimeout(function () {
            btn.textContent = original;
            btn.disabled = false;
            if (status) status.classList.remove('show');
          }, 6000);
        })
        .catch(function (err) {
          btn.textContent = original;
          btn.disabled = false;
          // Een netwerkfout geeft browserteksten als "Load failed" (Safari) of
          // "Failed to fetch" (Chrome). Die horen niet op een Nederlandse pagina.
          var msg = err && err.fromServer
            ? err.message
            : 'Geen verbinding met de server.';
          show(msg + ' Bel ons op +32 498 85 58 65 of mail rechtstreeks.', false);
        });
    });
  }

  /* ── Page-exit transition ── */
  document.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelector('.page-wrap').style.opacity = '0';
      document.querySelector('.page-wrap').style.transform = 'translateY(-12px)';
      document.querySelector('.page-wrap').style.transition = 'opacity .3s,transform .3s';
      setTimeout(function () { window.location.href = href; }, 280);
    });
  });

})();
