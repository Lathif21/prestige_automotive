<?php
/* Prestige Automotive — geheimen voor het contactformulier.
   ─────────────────────────────────────────────────────────────
   Dit bestand hoort op de Combell-server ÉÉN MAP BOVEN de webroot te staan,
   dus naast /www en niet erin. Zo kan niemand het via een URL opvragen,
   ook niet als PHP even uitvalt.

   Op de server:   /prestige-config.php      ← hier
                   /www/index.html
                   /www/api/contact.php

   Kopieer dit bestand naar prestige-config.php, vul de waarden in, en zet het
   op de server met:  .\deploy\deploy-combell.ps1 -ConfigFile <pad>

   Commit de ingevulde versie NIET naar git — .gitignore houdt hem al tegen. */

return [
    // API-sleutel van https://resend.com → API Keys (enkel "Sending access").
    'RESEND_API_KEY' => '',

    // Waar de aanvragen naartoe moeten.
    'CONTACT_TO'     => 'Geoffrey@prestige-automotive.be',

    // Afzender. Het domein moet geverifieerd zijn bij Resend, anders weigert
    // Resend de mail of belandt ze in spam.
    'CONTACT_FROM'   => 'Prestige Automotive <website@prestige-automotive.be>',
];
