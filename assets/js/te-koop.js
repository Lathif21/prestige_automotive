/* Prestige Automotive — te-koop.js
   Leest de 'cars' collectie uit Firestore en toont ze live op de pagina. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

var grid = document.getElementById('carsGrid');
var loading = document.getElementById('carsLoading');
var empty = document.getElementById('carsEmpty');
var modal = document.getElementById('carModal');
var modalGallery = document.getElementById('carModalGallery');
var modalTitle = document.getElementById('carModalTitle');
var modalSpecs = document.getElementById('carModalSpecs');
var modalPrice = document.getElementById('carModalPrice');
var modalDesc = document.getElementById('carModalDesc');
var modalWa = document.getElementById('carModalWa');
var modalClose = document.getElementById('carModalClose');

var carsById = {};

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function photosFor(car) {
  return String(car.fotos || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function formatPrice(car) {
  var excl = car.prijsExclBtw, incl = car.prijsInclBtw;
  var hasExcl = excl !== '' && excl != null && !isNaN(Number(excl));
  var hasIncl = incl !== '' && incl != null && !isNaN(Number(incl));
  if (hasIncl) {
    var main = '&euro; ' + Number(incl).toLocaleString('nl-BE') + ' <span class="car-card__price-vat">incl. BTW</span>';
    if (hasExcl) {
      main += '<span class="car-card__price-sub">&euro; ' + Number(excl).toLocaleString('nl-BE') + ' excl. BTW</span>';
    }
    return main;
  }
  if (hasExcl) {
    return '&euro; ' + Number(excl).toLocaleString('nl-BE') + ' <span class="car-card__price-vat">excl. BTW</span>';
  }
  if (car.prijs !== '' && car.prijs != null) {
    var n = Number(car.prijs);
    if (!isNaN(n)) return '&euro; ' + n.toLocaleString('nl-BE');
    return escapeHtml(car.prijs);
  }
  return '<span class="car-card__price--onaanvraag">Prijs op aanvraag</span>';
}

function specsLine(car) {
  var parts = [car.bouwjaar, car.km ? (Number(car.km).toLocaleString('nl-BE') + ' km') : '', car.brandstof, car.transmissie]
    .filter(Boolean);
  return parts.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('');
}

function renderCard(id, car) {
  var photos = photosFor(car);
  var img = photos[0] || 'transparent.png';
  var soldBadge = car.status === 'verkocht' ? '<span class="car-card__status car-card__status--sold">Verkocht</span>' : '';
  return (
    '<div class="glass car-card rev" data-id="' + escapeHtml(id) + '">' +
      '<div class="car-card__media">' + soldBadge +
        '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(car.titel || '') + '" loading="lazy">' +
      '</div>' +
      '<div class="car-card__body">' +
        '<h3 class="car-card__title">' + escapeHtml(car.titel || '') + '</h3>' +
        '<ul class="car-card__specs">' + specsLine(car) + '</ul>' +
        '<p class="car-card__desc">' + escapeHtml(car.beschrijving || '') + '</p>' +
        '<div class="car-card__footer">' +
          '<span class="car-card__price">' + formatPrice(car) + '</span>' +
          '<button type="button" class="car-card__btn">Bekijk details</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function render(cars) {
  if (!cars.length) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.style.display = '';
  grid.innerHTML = cars.map(function (c) { return renderCard(c.id, c.data); }).join('');
  document.querySelectorAll('.car-card').forEach(function (card) {
    card.addEventListener('click', function () { openModal(card.dataset.id); });
  });
  document.querySelectorAll('.rev').forEach(function (el) { el.classList.add('in'); });
}

var galleryIndex = 0;
var galleryPhotos = [];

function showGalleryPhoto(i) {
  if (!galleryPhotos.length) return;
  galleryIndex = (i + galleryPhotos.length) % galleryPhotos.length;
  modalGallery.querySelectorAll('img').forEach(function (img, idx) { img.classList.toggle('active', idx === galleryIndex); });
  modalGallery.querySelectorAll('.car-modal__thumbs button').forEach(function (b, idx) { b.classList.toggle('active', idx === galleryIndex); });
}

function openModal(id) {
  var car = carsById[id];
  if (!car) return;
  galleryPhotos = photosFor(car);
  if (!galleryPhotos.length) galleryPhotos = ['transparent.png'];
  galleryIndex = 0;

  modalTitle.textContent = car.titel || '';
  modalSpecs.innerHTML = specsLine(car);
  modalPrice.innerHTML = formatPrice(car);
  modalDesc.textContent = car.beschrijving || '';

  var waText = 'Hallo, ik heb interesse in de ' + (car.titel || 'wagen') + ' die te koop staat.';
  modalWa.href = 'https://wa.me/32498855865?text=' + encodeURIComponent(waText);

  var hasMultiple = galleryPhotos.length > 1;
  modalGallery.innerHTML = galleryPhotos.map(function (src, i) {
    return '<img src="' + escapeHtml(src) + '" alt="" class="' + (i === 0 ? 'active' : '') + '">';
  }).join('') + (hasMultiple
    ? '<button type="button" class="car-modal__nav car-modal__nav--prev" aria-label="Vorige foto">&#8249;</button>' +
      '<button type="button" class="car-modal__nav car-modal__nav--next" aria-label="Volgende foto">&#8250;</button>' +
      '<div class="car-modal__thumbs">' + galleryPhotos.map(function (_, i) {
        return '<button type="button" data-i="' + i + '" class="' + (i === 0 ? 'active' : '') + '" aria-label="Foto ' + (i + 1) + '"></button>';
      }).join('') + '</div>'
    : '');

  modalGallery.querySelectorAll('.car-modal__thumbs button').forEach(function (btn) {
    btn.addEventListener('click', function () { showGalleryPhoto(Number(btn.dataset.i)); });
  });

  if (hasMultiple) {
    modalGallery.querySelector('.car-modal__nav--prev').addEventListener('click', function () { showGalleryPhoto(galleryIndex - 1); });
    modalGallery.querySelector('.car-modal__nav--next').addEventListener('click', function () { showGalleryPhoto(galleryIndex + 1); });

    /* Swipe support (touch + mouse drag) */
    var dragStartX = null;
    modalGallery.addEventListener('pointerdown', function (e) { dragStartX = e.clientX; });
    modalGallery.addEventListener('pointerup', function (e) {
      if (dragStartX == null) return;
      var dx = e.clientX - dragStartX;
      dragStartX = null;
      if (Math.abs(dx) < 40) return;
      showGalleryPhoto(galleryIndex + (dx < 0 ? 1 : -1));
    });
  }

  modal.classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', function (e) {
  if (!modal.classList.contains('open')) return;
  if (e.key === 'Escape') closeModal();
  else if (e.key === 'ArrowLeft') showGalleryPhoto(galleryIndex - 1);
  else if (e.key === 'ArrowRight') showGalleryPhoto(galleryIndex + 1);
});

try {
  var app = initializeApp(firebaseConfig);
  var db = getFirestore(app);
  var q = query(collection(db, 'cars'), orderBy('createdAt', 'desc'));
  onSnapshot(q, function (snap) {
    loading.style.display = 'none';
    carsById = {};
    var cars = [];
    snap.forEach(function (doc) {
      carsById[doc.id] = doc.data();
      cars.push({ id: doc.id, data: doc.data() });
    });
    render(cars);
  }, function (err) {
    console.error('Kon aanbod niet laden:', err);
    loading.style.display = 'none';
    grid.style.display = 'none';
    empty.style.display = '';
  });
} catch (err) {
  console.error('Firebase kon niet worden geïnitialiseerd:', err);
  loading.style.display = 'none';
  grid.style.display = 'none';
  empty.style.display = '';
}
