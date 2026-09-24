# Instagram-feed op de galerij — instellen

Voor: de eigenaar van het Instagram-account van Prestige Automotive.
Doel: de galerijpagina automatisch de recentste Instagram-berichten laten tonen.

Je hoeft niets te programmeren. Alles hieronder gebeurt in de Instagram-app en
op de website van Meta. Aan het einde geef je één gegeven door aan je
webbouwer.

---

## Belangrijk om vooraf te weten

**1. Dit kan alleen met een professioneel account.**
Een privé-account kan niet via de API uitgelezen worden. Omschakelen naar
Business of Creator is gratis en verandert niets aan je berichten of volgers.

**2. De toegang verloopt om de 60 dagen.**
Meta geeft geen permanente sleutel uit. Een sleutel is 60 dagen geldig en moet
daarvoor vernieuwd worden. Gebeurt dat niet, dan valt de feed stil en moet de
hele procedure opnieuw. Wie die vernieuwing doet, spreek je op voorhand af met
je webbouwer — zie **Stap 6**.

**3. Er is een eenvoudiger alternatief.**
Een feed-dienst zoals Behold neemt stap 2 tot 6 volledig over, inclusief het
vernieuwen van de sleutel. Dat is voor de meeste zaken de betere keuze. Zie
**Alternatief** onderaan.

---

## Stap 1 — Zet Instagram om naar een professioneel account

1. Open de Instagram-app → jouw profiel → menu (☰) → **Instellingen**.
2. Ga naar **Accounttype en tools** → **Overschakelen naar professioneel account**.
3. Kies **Bedrijf** (Business) en rond af.

Controleer daarna dat het juiste account gebruikt wordt. De website verwijst nu
naar **@_prestige_automotive**. Op de oude website stond een ander account
(@carrez_customs) — bevestig aan je webbouwer welk van de twee de feed moet
voeden.

## Stap 2 — Maak een Meta-app aan

1. Ga naar https://developers.facebook.com en log in met je Facebook-account.
2. Klik rechtsboven op **My Apps** → **Create App**.
3. Geef de app een naam (bv. `Prestige Automotive Website`) en vul je e-mailadres in.
4. Kies als toepassingstype **Other** en daarna **Business**.

## Stap 3 — Voeg Instagram toe aan de app

1. Klik in de app op **Add Product** en kies **Instagram**.
2. Kies **Instagram API with Instagram Login** (dus *niet* de variant met
   Facebook Login — die vereist bijkomend een gekoppelde Facebook-pagina).
3. Noteer de **Instagram App ID** en het **Instagram App Secret**. Behandel dat
   secret als een wachtwoord: niet doorsturen via e-mail of WhatsApp.

## Stap 4 — Geef de app toegang tot je account

1. Ga naar **Instagram → API setup with Instagram login**.
2. Voeg bij **Business login settings** een geldige redirect-URL toe (je
   webbouwer geeft je die door).
3. Doorloop de login-flow en geef toestemming voor de rechten
   **`instagram_business_basic`**. Meer is voor een galerij niet nodig — die
   rechten laten enkel *lezen* toe, niet posten of reageren.

## Stap 5 — Zet de sleutel om naar een langlopende sleutel

De sleutel die je in stap 4 krijgt, is maar **1 uur** geldig en kan één keer
gebruikt worden. Die moet omgeruild worden naar een sleutel van **60 dagen**:

```
GET https://graph.instagram.com/access_token
      ?grant_type=ig_exchange_token
      &client_secret=JOUW_APP_SECRET
      &access_token=DE_SLEUTEL_VAN_1_UUR
```

Dit is een technische stap — laat ze uitvoeren door je webbouwer, of plak de
opdracht in de Graph API Explorer in het Meta-dashboard.

## Stap 6 — Spreek de vernieuwing af

De sleutel van 60 dagen moet vóór dag 60 vernieuwd worden:

```
GET https://graph.instagram.com/refresh_access_token
      ?grant_type=ig_refresh_token
      &access_token=DE_HUIDIGE_SLEUTEL
```

Voorwaarden: de sleutel is minstens 24 uur oud en nog niet verlopen. **Een
sleutel die 60 dagen niet vernieuwd is, is definitief vervallen** en dan begin
je opnieuw bij stap 4.

Dit is de reden waarom deze aanpak onderhoud vraagt. Spreek af wie dit doet:

- **je webbouwer**, met een automatische taak die dit maandelijks uitvoert, of
- **een feed-dienst**, die het volledig overneemt (zie hieronder).

Zet in elk geval een herinnering op dag 45 in de agenda, zolang het niet
geautomatiseerd is.

---

## Alternatief: een feed-dienst (aanbevolen)

Diensten zoals **Behold** (https://behold.so), LightWidget of SnapWidget doen
stap 2 tot 6 voor je, inclusief het vernieuwen van de sleutel. Je koppelt je
Instagram-account één keer en krijgt een vaste link naar je feed.

1. Maak een account op https://behold.so.

   Bekijk eerst de plannen. Het gratis plan is beperkt tot **6 berichten per
   feed**, **1.200 paginaweergaven per maand**, en toont een **Behold-logo bij
   hover**. Voor een zakelijke site betekent dat meestal het Starter-plan van
   $10 per maand; controleer de actuele limieten op https://behold.so/pricing/.
2. Koppel het Instagram-account van Prestige Automotive.
3. Maak een feed aan en kopieer de **feed-URL**.
4. Bezorg die URL aan je webbouwer.

Je hebt dan geen app-secret, geen sleutel en geen vervaldatum om op te volgen.
De website is hier al op voorbereid: er moet enkel één regel ingevuld worden.

---

## Wat je moet doorgeven

Afhankelijk van de gekozen weg:

| Weg | Wat je doorgeeft |
|---|---|
| Feed-dienst (aanbevolen) | De feed-URL |
| Graph API | App ID, App Secret en de langlopende sleutel — via een wachtwoordkluis, niet via e-mail |

Zolang geen van beide ingevuld is, blijft de galerij de huidige, vaste foto's
tonen. De pagina blijft dus altijd werken.
