<?php
/* POST /api/contact — Combell (Linux, Apache + PHP)
   ─────────────────────────────────────────────────────────────
   Verstuurt het contactformulier van contact.html per e-mail via Resend.
   Dit is de PHP-tegenhanger van functions/api/contact.js (Cloudflare Pages);
   op Combell draait er geen Workers-runtime, enkel PHP.

   Configuratie — zet deze drie waarden in prestige-config.php, één map BOVEN
   de webroot (dus naast /www, niet erin, zodat het bestand nooit opvraagbaar
   is via een URL). Zie docs/COMBELL-DEPLOY.md.

     RESEND_API_KEY   API-sleutel van https://resend.com  (verplicht)
     CONTACT_TO       ontvanger, bv. Geoffrey@prestige-automotive.be
     CONTACT_FROM     afzender op een geverifieerd domein,
                      bv. "Prestige Automotive <website@prestige-automotive.be>"
   ───────────────────────────────────────────────────────────── */

declare(strict_types=1);

const DEFAULT_TO   = 'lathif.sihab-dewantoro@drpbuildlab.com';
const DEFAULT_FROM = 'Prestige Automotive <onboarding@resend.dev>';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/** JSON-antwoord en stoppen. */
function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Method Not Allowed']);
}

/* ── Configuratie inlezen ──
   Eerst echte environment variables (als de hosting ze ondersteunt), daarna
   het config-bestand buiten de webroot. Kandidaten, in volgorde: naast /www
   (de normale Combell-opzet), en de webroot zelf als noodoplossing. */
function load_config(): array {
    $cfg = [];
    foreach (['RESEND_API_KEY', 'CONTACT_TO', 'CONTACT_FROM'] as $key) {
        $v = getenv($key);
        if (is_string($v) && $v !== '') $cfg[$key] = $v;
    }

    $candidates = [
        __DIR__ . '/../../prestige-config.php',   // naast /www  ← aanbevolen
        __DIR__ . '/../prestige-config.php',      // in de webroot (minder veilig)
    ];
    foreach ($candidates as $path) {
        if (!is_readable($path)) continue;
        $loaded = require $path;
        // Environment variables winnen van het bestand.
        if (is_array($loaded)) $cfg = array_merge($loaded, $cfg);
        break;
    }
    return $cfg;
}

$config = load_config();

/* ── Invoer inlezen ──
   Het formulier stuurt FormData (multipart) — dat zit in $_POST. JSON wordt
   ook aanvaard, zodat dezelfde endpoint met fetch(JSON) werkt. */
$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $raw  = file_get_contents('php://input');
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) {
        respond(400, ['ok' => false, 'error' => 'Ongeldige aanvraag.']);
    }
} else {
    $data = $_POST;
}

/** Veld ophalen als getrimde string. */
function field(array $d, string $k): string {
    return isset($d[$k]) && is_scalar($d[$k]) ? trim((string) $d[$k]) : '';
}

// Honeypot: bots vullen dit verborgen veld in, mensen zien het niet.
// Doe alsof het gelukt is — zo leert de bot niets.
if (field($data, 'website') !== '') {
    respond(200, ['ok' => true]);
}

$voornaam   = field($data, 'voornaam');
$achternaam = field($data, 'achternaam');
$email      = field($data, 'email');
$telefoon   = field($data, 'telefoon');
$service    = field($data, 'service');
$voertuig   = field($data, 'voertuig');
$bericht    = field($data, 'bericht');

if ($voornaam === '' || $achternaam === '' || $email === '' || $service === '' || $bericht === '') {
    respond(400, ['ok' => false, 'error' => 'Vul alle verplichte velden in.']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['ok' => false, 'error' => 'Geen geldig e-mailadres.']);
}
if (mb_strlen($bericht) > 5000) {
    respond(400, ['ok' => false, 'error' => 'Bericht is te lang.']);
}

$apiKey = $config['RESEND_API_KEY'] ?? '';
if ($apiKey === '') {
    error_log('Resend-fout: RESEND_API_KEY ontbreekt — e-mail niet verzonden');
    respond(500, ['ok' => false, 'error' => 'E-mail is niet geconfigureerd.']);
}

/** HTML-escape, zoals esc() in de Cloudflare-versie. */
function esc(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$naam = $voornaam . ' ' . $achternaam;

$rows = '';
foreach ([
    ['Naam', $naam],
    ['E-mail', $email],
    ['Telefoon', $telefoon !== '' ? $telefoon : '—'],
    ['Service', $service],
    ['Voertuig', $voertuig !== '' ? $voertuig : '—'],
] as [$k, $v]) {
    $rows .= '<tr><td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap">' . esc($k) . '</td>'
           . '<td style="padding:6px 0"><strong>' . esc($v) . '</strong></td></tr>';
}

$html = '
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2 style="margin:0 0 4px">Nieuwe aanvraag via de website</h2>
      <p style="margin:0 0 20px;color:#666;font-size:14px">contact.html — Prestige Automotive</p>
      <table style="border-collapse:collapse;font-size:15px">' . $rows . '</table>
      <p style="margin:24px 0 6px;color:#666;font-size:14px">Bericht</p>
      <div style="white-space:pre-wrap;padding:14px;background:#f5f5f3;border-radius:8px;font-size:15px">' . esc($bericht) . '</div>
    </div>';

$text = "Nieuwe aanvraag via de website\n\n"
      . "Naam: {$naam}\n"
      . "E-mail: {$email}\n"
      . 'Telefoon: ' . ($telefoon !== '' ? $telefoon : '—') . "\n"
      . "Service: {$service}\n"
      . 'Voertuig: ' . ($voertuig !== '' ? $voertuig : '—') . "\n\n"
      . "Bericht:\n{$bericht}\n";

$payload = json_encode([
    'from'     => $config['CONTACT_FROM'] ?? DEFAULT_FROM,
    'to'       => [$config['CONTACT_TO'] ?? DEFAULT_TO],
    'reply_to' => $email,
    'subject'  => "Website-aanvraag — {$naam} ({$service})",
    'html'     => $html,
    'text'     => $text,
], JSON_UNESCAPED_UNICODE);

if (!function_exists('curl_init')) {
    error_log('Resend-fout: cURL-extensie ontbreekt op deze hosting');
    respond(500, ['ok' => false, 'error' => 'E-mail is niet geconfigureerd.']);
}

$ch = curl_init('https://api.resend.com/emails');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$status   = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('Resend-fout (cURL): ' . $curlErr);
    respond(502, ['ok' => false, 'error' => 'Verzenden is niet gelukt.']);
}
if ($status < 200 || $status >= 300) {
    error_log('Resend-fout ' . $status . ' ' . (string) $response);
    respond(502, ['ok' => false, 'error' => 'Verzenden is niet gelukt.']);
}

respond(200, ['ok' => true]);
