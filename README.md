# Prestige Automotive — website

Statische site (geen build-stap, geen framework). De pagina's zijn platte HTML
en verwijzen naar één gedeelde stylesheet en een paar losse scripts.

## Structuur

```
/                          de pagina's zelf — moeten in de root blijven,
├── index.html             want de URL's zijn /over-ons.html enz.
├── services.html
├── prijzen.html
├── galerij.html
├── te-koop.html
├── te-koop-beheer.html    beheerpaneel — bewust niet in het menu gelinkt
├── over-ons.html
├── contact.html
│
├── assets/
│   ├── css/style.css      volledig design system (tokens, nav, footer, componenten)
│   ├── js/
│   │   ├── main.js               nav, scroll-reveals, lightbox, filters, accordion
│   │   ├── instagram-feed.js     galerij-feed — FEED_URL moet nog ingevuld worden
│   │   ├── te-koop.js            leest auto's live uit Firestore
│   │   ├── te-koop-beheer.js     login + toevoegen/bewerken/verwijderen
│   │   └── firebase-config.js    projectgegevens voor Firestore
│   └── img/               logo + alle foto's die de site gebruikt
│
├── functions/api/contact.js   Cloudflare Pages Function: verstuurt het
│                           contactformulier per e-mail (Resend)
│
├── docs/
│   ├── FIREBASE-SETUP.md            eenmalige instructies voor de Te Koop-database
│   ├── CONTACT-FORM-SETUP.md        Cloudflare + Resend instellen voor het formulier
│   ├── INSTAGRAM-FEED-SETUP.md      klantgerichte uitleg om de feed te koppelen (EN)
│   ├── INSTAGRAM-FEED-SETUP.nl.md   dezelfde uitleg in het Nederlands
│   └── INSTAGRAM-FEED-TECHNICAL.md  opties, Graph API-details en onderhoud
│
└── _legacy-squarespace/   opgeslagen kopie van de oude Squarespace-site
                           (prestige-automotive.be). Wordt NIET door de site
                           gebruikt — enkel bewaard als referentie.
```

## Lokaal draaien

De site moet via HTTP geserveerd worden, niet met een dubbelklik op een
HTML-bestand: `te-koop.js` gebruikt ES-modules en `instagram-feed.js` gebruikt
`fetch`, en browsers blokkeren allebei op `file://`.

```
powershell -ExecutionPolicy Bypass -File .claude/serve.ps1
```

Daarna http://localhost:5588 openen. Alternatief: `python -m http.server 8000`.

## Nog openstaand

- `assets/js/instagram-feed.js` → `CONFIG.FEED_URL` invullen, anders blijft de
  vaste fotogalerij staan. Zie `docs/INSTAGRAM-FEED-SETUP.md` (voor de klant) en
  `docs/INSTAGRAM-FEED-TECHNICAL.md` (opties en Graph API-details).
- Openstaande vraag: de oude website linkte naar @carrez_customs, de briefing
  noemt @_prestige_automotive. Bevestigen welk account de feed moet voeden.
- Het contactformulier verstuurt pas e-mail zodra `RESEND_API_KEY`, `CONTACT_TO`
  en `CONTACT_FROM` in Cloudflare Pages ingesteld zijn — zie
  `docs/CONTACT-FORM-SETUP.md`. Laat `CONTACT_TO` leeg in Preview, zodat
  testberichten nooit bij de klant terechtkomen.
- Prijzen staan op drie plaatsen in `prijzen.html` (de kaarten per
  voertuigklasse, de vergelijkingstabel, en de reeksen op de tabs). Bij een
  prijswijziging moeten alle drie aangepast worden.
