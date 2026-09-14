/* Prestige Automotive — te-koop-beheer.js
   Login (Firebase Auth) + CRUD voor de 'cars' collectie (Firestore). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

var loginView = document.getElementById('loginView');
var adminView = document.getElementById('adminView');
var loginForm = document.getElementById('loginForm');
var loginError = document.getElementById('loginError');
var logoutBtn = document.getElementById('logoutBtn');

var carForm = document.getElementById('carForm');
var fId = document.getElementById('fId');
var fTitel = document.getElementById('fTitel');
var fPrijsExcl = document.getElementById('fPrijsExcl');
var fPrijsIncl = document.getElementById('fPrijsIncl');
var fBouwjaar = document.getElementById('fBouwjaar');
var fKm = document.getElementById('fKm');
var fBrandstof = document.getElementById('fBrandstof');
var fTransmissie = document.getElementById('fTransmissie');
var fStatus = document.getElementById('fStatus');
var fFotos = document.getElementById('fFotos');
var fBeschrijving = document.getElementById('fBeschrijving');
var carFormSubmit = document.getElementById('carFormSubmit');
var carFormCancel = document.getElementById('carFormCancel');
var carFormError = document.getElementById('carFormError');
var carFormTitle = document.getElementById('carFormTitle');

var carsList = document.getElementById('carsList');
var carsListEmpty = document.getElementById('carsListEmpty');

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
}
function hideError(el) {
  el.classList.remove('show');
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var authErrorMessages = {
  'auth/invalid-email': 'Ongeldig e-mailadres.',
  'auth/invalid-credential': 'E-mailadres of wachtwoord is onjuist.',
  'auth/wrong-password': 'E-mailadres of wachtwoord is onjuist.',
  'auth/user-not-found': 'E-mailadres of wachtwoord is onjuist.',
  'auth/too-many-requests': 'Te veel pogingen. Probeer het later opnieuw.'
};

var app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error('Firebase kon niet worden geïnitialiseerd:', err);
  showError(loginError, 'Firebase is nog niet correct geconfigureerd (zie firebase-config.js).');
}

if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError(loginError);
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var btn = loginForm.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Inloggen…';
    signInWithEmailAndPassword(auth, email, password)
      .catch(function (err) {
        showError(loginError, authErrorMessages[err.code] || 'Inloggen mislukt. Probeer het opnieuw.');
      })
      .finally(function () {
        btn.disabled = false; btn.textContent = 'Inloggen';
      });
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', function () { signOut(auth); });
}

if (auth) {
  onAuthStateChanged(auth, function (user) {
    if (user) {
      loginView.style.display = 'none';
      adminView.style.display = '';
      subscribeToCars();
    } else {
      loginView.style.display = '';
      adminView.style.display = 'none';
    }
  });
}

var unsubscribeCars = null;
var carsCache = {};

function subscribeToCars() {
  if (unsubscribeCars) return;
  var q = query(collection(db, 'cars'), orderBy('createdAt', 'desc'));
  unsubscribeCars = onSnapshot(q, function (snap) {
    carsCache = {};
    var rows = [];
    snap.forEach(function (d) {
      carsCache[d.id] = d.data();
      rows.push({ id: d.id, data: d.data() });
    });
    renderList(rows);
  }, function (err) {
    console.error('Kon auto\'s niet laden:', err);
    carsListEmpty.textContent = 'Kon auto\'s niet laden. Controleer je Firestore-instellingen.';
    carsListEmpty.style.display = '';
  });
}

function adminPriceLabel(car) {
  var excl = car.prijsExclBtw, incl = car.prijsInclBtw;
  if (incl != null && incl !== '' && excl != null && excl !== '') {
    return '€ ' + Number(incl).toLocaleString('nl-BE') + ' incl. / € ' + Number(excl).toLocaleString('nl-BE') + ' excl. BTW';
  }
  if (incl != null && incl !== '') return '€ ' + Number(incl).toLocaleString('nl-BE') + ' incl. BTW';
  if (excl != null && excl !== '') return '€ ' + Number(excl).toLocaleString('nl-BE') + ' excl. BTW';
  if (car.prijs) return '€ ' + Number(car.prijs).toLocaleString('nl-BE');
  return 'Prijs op aanvraag';
}

function renderList(rows) {
  if (!rows.length) {
    carsList.innerHTML = '';
    carsListEmpty.style.display = '';
    carsListEmpty.textContent = 'Nog geen auto\'s toegevoegd.';
    return;
  }
  carsListEmpty.style.display = 'none';
  carsList.innerHTML = rows.map(function (row) {
    var car = row.data;
    var photo = String(car.fotos || '').split(',')[0].trim() || 'transparent.png';
    var price = adminPriceLabel(car);
    var statusLabel = car.status === 'verkocht' ? ' · Verkocht' : '';
    return (
      '<div class="admin-row" data-id="' + escapeHtml(row.id) + '">' +
        '<img class="admin-row__img" src="' + escapeHtml(photo) + '" alt="">' +
        '<div class="admin-row__body">' +
          '<div class="admin-row__title">' + escapeHtml(car.titel || '(zonder titel)') + '</div>' +
          '<div class="admin-row__meta">' + price + statusLabel + '</div>' +
        '</div>' +
        '<div class="admin-row__actions">' +
          '<button type="button" class="edit-btn">Bewerken</button>' +
          '<button type="button" class="danger delete-btn">Verwijderen</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  carsList.querySelectorAll('.edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.admin-row').dataset.id;
      startEdit(id, carsCache[id]);
    });
  });
  carsList.querySelectorAll('.delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.admin-row').dataset.id;
      var car = carsCache[id];
      if (window.confirm('Weet je zeker dat je "' + (car.titel || 'deze auto') + '" wilt verwijderen?')) {
        deleteDoc(doc(db, 'cars', id)).catch(function (err) {
          window.alert('Verwijderen mislukt: ' + err.message);
        });
      }
    });
  });
}

function startEdit(id, car) {
  fId.value = id;
  fTitel.value = car.titel || '';
  fPrijsExcl.value = car.prijsExclBtw != null ? car.prijsExclBtw : (car.prijs || '');
  fPrijsIncl.value = car.prijsInclBtw != null ? car.prijsInclBtw : '';
  inclManuallySet = fPrijsIncl.value !== '';
  fBouwjaar.value = car.bouwjaar || '';
  fKm.value = car.km || '';
  fBrandstof.value = car.brandstof || 'Benzine';
  fTransmissie.value = car.transmissie || 'Manueel';
  fStatus.value = car.status || 'beschikbaar';
  fFotos.value = car.fotos || '';
  fBeschrijving.value = car.beschrijving || '';
  carFormTitle.textContent = 'Auto Bewerken';
  carFormSubmit.textContent = 'Wijzigingen Opslaan';
  carFormCancel.style.display = '';
  window.scrollTo({ top: carForm.getBoundingClientRect().top + window.scrollY - 24, behavior: 'smooth' });
}

function resetForm() {
  carForm.reset();
  fId.value = '';
  inclManuallySet = false;
  carFormTitle.textContent = 'Nieuwe Auto Toevoegen';
  carFormSubmit.textContent = 'Auto Toevoegen';
  carFormCancel.style.display = 'none';
  hideError(carFormError);
}
carFormCancel.addEventListener('click', resetForm);

/* Vult automatisch de prijs incl. BTW aan (21%) zodra excl. BTW wordt ingevuld, tenzij die al handmatig is aangepast. */
var BTW_RATE = 1.21;
var inclManuallySet = false;
fPrijsIncl.addEventListener('input', function () { inclManuallySet = fPrijsIncl.value !== ''; });
fPrijsExcl.addEventListener('input', function () {
  if (inclManuallySet) return;
  fPrijsIncl.value = fPrijsExcl.value ? Math.round(Number(fPrijsExcl.value) * BTW_RATE) : '';
});

carForm.addEventListener('submit', function (e) {
  e.preventDefault();
  hideError(carFormError);
  if (!fTitel.value.trim()) {
    showError(carFormError, 'Titel is verplicht.');
    return;
  }
  var data = {
    titel: fTitel.value.trim(),
    prijsExclBtw: fPrijsExcl.value ? Number(fPrijsExcl.value) : '',
    prijsInclBtw: fPrijsIncl.value ? Number(fPrijsIncl.value) : '',
    bouwjaar: fBouwjaar.value.trim(),
    km: fKm.value ? Number(fKm.value) : '',
    brandstof: fBrandstof.value,
    transmissie: fTransmissie.value,
    status: fStatus.value,
    fotos: fFotos.value.trim(),
    beschrijving: fBeschrijving.value.trim(),
    updatedAt: serverTimestamp()
  };
  carFormSubmit.disabled = true;
  var isEdit = !!fId.value;
  var promise = isEdit
    ? updateDoc(doc(db, 'cars', fId.value), data)
    : addDoc(collection(db, 'cars'), Object.assign({ createdAt: serverTimestamp() }, data));
  promise.then(function () {
    resetForm();
  }).catch(function (err) {
    showError(carFormError, 'Opslaan mislukt: ' + err.message);
  }).finally(function () {
    carFormSubmit.disabled = false;
  });
});
