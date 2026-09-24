# Te Koop — CMS instellen (Firebase, gratis)

De nieuwe "Te Koop"-pagina (`te-koop.html`) haalt zijn auto's live op uit een gratis
Firebase-database. Geoffrey beheert het aanbod zelf via een beveiligde pagina:
`te-koop-beheer.html`. Deze stappen hoeven maar **één keer** te gebeuren.

## 1. Firebase-project aanmaken

1. Ga naar https://console.firebase.google.com en log in met een Google-account.
2. Klik **Project toevoegen**, geef het een naam (bv. `prestige-automotive`) en rond de wizard af.
   Google Analytics kan uitgeschakeld blijven — dat is niet nodig.

## 2. Firestore-database aanmaken

1. Klik in het linkermenu op **Build → Firestore Database**.
2. Klik **Database maken**.
3. Kies **Productiemodus** (niet testmodus) en een locatie in de buurt (bv. `eur3 (Europa)`).
4. Ga naar het tabblad **Regels** en plak het volgende, vervang de bestaande inhoud volledig:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /cars/{carId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

5. Klik **Publiceren**.

   Dit betekent: iedereen kan het aanbod zien, maar alleen iemand die is ingelogd
   kan auto's toevoegen, wijzigen of verwijderen.

## 3. Inloggen inschakelen (voor het beheerpaneel)

1. Klik op **Build → Authentication → Get started**.
2. Kies **E-mail/wachtwoord** in de lijst met providers en schakel deze **in**.
3. Ga naar het tabblad **Users** en klik **Add user**.
4. Vul het e-mailadres en wachtwoord in waarmee Geoffrey wil inloggen op
   `te-koop-beheer.html` (bv. `geoffrey@prestige-automotive.be`). Bewaar dit wachtwoord
   ergens veilig (bv. een wachtwoordbeheerder).

## 4. Website-configuratie ophalen

1. Klik op het tandwiel-icoon naast **Projectoverzicht → Projectinstellingen**.
2. Scroll naar **Jouw apps** en klik op het `</>`-icoon (Web app) om een webapp toe te voegen.
3. Geef de app een naam (bv. `Prestige Automotive Website`) en klik **App registreren**.
   Firebase Hosting is niet nodig — dat kan je overslaan.
4. Firebase toont een codeblok met een object `firebaseConfig = { apiKey: "...", ... }`.
   Open het bestand **`firebase-config.js`** in de websitebestanden en vervang de
   placeholder-waarden door de echte waarden uit dat codeblok. Sla op.

## 5. Klaar

Zodra `firebase-config.js` is ingevuld:

- **`te-koop.html`** toont automatisch alle auto's die in Firestore staan.
- **`te-koop-beheer.html`** (niet gelinkt in het menu — bewaar deze link apart, bv. als
  bladwijzer) laat Geoffrey inloggen met het account uit stap 3 en auto's toevoegen,
  bewerken of verwijderen. Wijzigingen verschijnen meteen op `te-koop.html`.

### Foto's toevoegen

Om kosten te vermijden gebruikt het beheerpaneel **foto-URL's** in plaats van een
upload-knop. Geoffrey kan foto's bijvoorbeeld uploaden naar een gratis dienst zoals
https://imgur.com (of naar de eigen hosting via FTP) en de directe afbeeldingslink
plakken in het "Foto's"-veld, met een komma tussen meerdere links.

### Kosten

Firebase's gratis "Spark"-plan is ruim voldoende voor dit gebruik (tot 50.000
leesbewerkingen per dag). Zolang je niet naar het betaalde "Blaze"-plan upgradet,
worden er geen kosten aangerekend.
