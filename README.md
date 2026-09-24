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
├── api/contact.php        contactformulier op Combell (Linux, PHP) — dit is
│                           wat er live draait
├── functions/api/contact.js   dezelfde endpoint als Cloudflare Pages Function.
│                           Draait NIET op Combell; enkel bewaard voor het geval
│                           de site terug naar Cloudflare gaat
│
├── .htaccess              Apache-config: HTTPS, /api/contact-routering, caching
├── deploy/
│   ├── deploy-combell.ps1          uploadt de site via FTPS naar Combell
│   └── prestige-config.example.php sjabloon voor de geheimen (API-sleutel)
│
├── docs/
│   ├── COMBELL-DEPLOY.md            deployen naar Combell — begin hier
│   ├── FIREBASE-SETUP.md            eenmalige instructies voor de Te Koop-database
│   ├── CONTACT-FORM-SETUP.md        Resend instellen voor het formulier
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

Let op: deze servers draaien geen PHP, dus het contactformulier werkt lokaal
niet. Om dat te testen heb je PHP nodig: `php -S 127.0.0.1:8000 -t .`

## Deployen

De site staat op Combell (Linux-hosting, Apache + PHP). Volledige uitleg in
`docs/COMBELL-DEPLOY.md`.

Eerste keer? Laat de wizard je er stap voor stap doorheen loodsen — hij regelt
hosting, FTP, het contactformulier, de upload en de DNS-omschakeling:

```bash
./deploy/setup-combell.sh
```

Daarna volstaat het deploy-script:

```powershell
.\deploy\deploy-combell.ps1 -DryRun   # toon wat er zou gebeuren
.\deploy\deploy-combell.ps1           # upload wat gewijzigd is
```

Inloggegevens komen uit de environment variables `COMBELL_FTP_HOST`,
`COMBELL_FTP_USER` en `COMBELL_FTP_PASS` — nooit uit een bestand in git.

## Nog openstaand

- **Instagram-account: BESLIST — `@_prestige_automotive`**
  (https://www.instagram.com/_prestige_automotive/). De vraag over
  @carrez_customs is daarmee gesloten; alle 9 links in de 7 pagina's wijzen al
  naar het juiste account, er valt daar niets meer aan te wijzigen.
- Instagram-feed zelf: **bewust uitgesteld tot na de deployment.**
  `CONFIG.FEED_URL` in `assets/js/instagram-feed.js` blijft voorlopig leeg,
  waardoor de vaste fotogalerij blijft staan — dat is de bedoelde fallback, geen
  fout. Voor het koppelen van de Meta Graph API: zie
  `docs/INSTAGRAM-FEED-SETUP.md` (voor de klant) en
  `docs/INSTAGRAM-FEED-TECHNICAL.md` (opties en Graph API-details).
- Het contactformulier verstuurt pas e-mail zodra `RESEND_API_KEY`, `CONTACT_TO`
  en `CONTACT_FROM` ingesteld zijn. Op Netlify zijn dat environment variables
  (zie `docs/NETLIFY-DEPLOY.md`), op Combell staat het in `prestige-config.php`
  boven de webroot (zie `docs/COMBELL-DEPLOY.md`).
- Er is nog geen 404-pagina in de huisstijl.
- Prijzen staan op drie plaatsen in `prijzen.html` (de kaarten per
  voertuigklasse, de vergelijkingstabel, en de reeksen op de tabs). Bij een
  prijswijziging moeten alle drie aangepast worden.
