# Deploying to Combell — step by step

Written for someone who has never used Combell before. It starts at the
Dashboard you see after logging in, and goes to the live site.

Everything else in this project is in Dutch. This one document is in English.

---

## Your actual setup (confirmed 2026-09-22)

These are read from the real panel, not assumed.

### The hosting package

| | |
|---|---|
| Package | **Webhosting Business**, listed under **prestige-garage.be** |
| IPv4 (use this for A records) | **`188.208.37.139`** |
| IPv6 | `2a00:1c98:1000:12e3:0:4:1882:f6b` — per website, we do not use it |
| Websites | **1 of 4 in use** — so there is room for prestige-automotive.be |
| PHP | **8.3 already active** — nothing to change |
| FTP | enabled |
| Disk | 0 MB of 50 GB used |

### FTP login

| | |
|---|---|
| FTP server | `ftp.prestige-garagebe.webhosting.be` |
| Port | 21 |
| Username | `prestige-garagebe@prestige-garagebe` |
| Password | you set it under **FTP & SSH** |

### The domains

| Domain | Points at today | Note |
|---|---|---|
| `prestige-automotive.be` | **Squarespace** (`198.185.159.144/145`, `198.49.23.144/145`) | the live site we are replacing |
| `prestige-garage.be` | **Shopify** (`23.227.38.65`) | the package is *named* after this domain, but it is served from Shopify, not Combell |
| Email on `prestige-automotive.be` | **Google Workspace** (`MX → smtp.google.com`, priority 1) | **do not touch** |

DNS for `prestige-automotive.be` is managed **at Combell** (`ns1.combell.eu`,
`ns3/ns4.combell.net`), so everything happens in one panel.

### What this means

1. **The hosting package belongs to a different domain than the site you are
   deploying.** That is fine — the package holds up to 4 websites. But
   `prestige-automotive.be` has to be *added* to it first (Part 2), otherwise
   the server has no idea it should answer for that domain.
2. **`prestige-garage.be` is on Shopify.** Nothing you do here affects it, as
   long as you do not overwrite its folder. The `/www` folder currently holds a
   1 KB placeholder `index.html` from Oct 2025, so nothing real lives there.
3. **There is a working site on `prestige-automotive.be` right now.** Until
   Part 8, nothing you do is public and nothing can break.
4. **Company email runs through Google.** In Part 8 you edit DNS. Combell puts
   A records and MX records on **separate pages**, so the risk is low — but
   stay on the A-records page.

---

## Which name do I click? (the one thing that keeps confusing people)

Two domains appear all over the panel, and the right one depends entirely on
which section you are in:

| What you are doing | Section | Click |
|---|---|---|
| FTP password, PHP, File Manager, Websites & SSL, SSL certificate | **Web hosting** | **`prestige-garage.be`** — the hosting *package* |
| A, AAAA, TXT, CNAME records; the cutover | **DNS & forwarding** | **`prestige-automotive.be`** — the *domain* |

It feels wrong to click "garage" to configure the automotive site, but it is
correct: `prestige-garage.be` is the **name of the hosting package**, and
`prestige-automotive.be` lives inside it as a subsite. There is only one
package, so every hosting setting sits under that single row.

Never touch `prestige-garage.be` under **DNS & forwarding** — that domain points
at Shopify and has nothing to do with this project.

---

## The values you need

| # | Value | Confirmed value | Where |
|---|---|---|---|
| 1 | Hosting IPv4 | `188.208.37.139` | ✅ known |
| 2 | FTP server | `ftp.prestige-garagebe.webhosting.be` | ✅ known |
| 3 | FTP username | `prestige-garagebe@prestige-garagebe` | ✅ known |
| 4 | FTP password | — | Part 3 |
| 5 | Document root | `/subsites/prestige-automotive.be` | ✅ confirmed |
| 6 | Resend API key | — | Part 5 |

---

## Part 1 — The hosting package screen

**Dashboard → Web hosting → prestige-garage.be**

The left-hand menu is your map for everything that follows:

| Menu item | Used in |
|---|---|
| **Overview** | Part 1 — the IP address and a summary |
| **Websites & SSL** | Part 2 (add the domain) and Part 9 (certificate) |
| **FTP & SSH** | Part 3 (login details) |
| **File Manager** | Part 4 (checking where files landed) |
| **PHP settings** | already correct — PHP 8.3 |
| Databases, Backups, Security, Performance, Node.js, CMS installation | not used |

PHP is already on 8.3, so the old "set your PHP version" step is done. If you
want to confirm: **PHP settings** shows *Version: PHP 8.3*.

---

## Part 2 — Add prestige-automotive.be to the package ⚠️

**This is the step that decides where your files must go.** Get it wrong and
you upload 54 files into a folder nothing is serving.

> **First, a thing that trips everyone up.** The **Dashboard → Web hosting**
> list shows your hosting *packages*, not your websites. It shows one row,
> `prestige-garage.be`, because you have one package and it is named after the
> domain it was created under. That is normal, and it will keep saying that
> even after you add a second website. The website slots live *inside* the
> package.

**Get there: Web hosting → `Manage hosting` → `Websites & SSL`** in the left
menu. (Or the **Manage websites** link on the Overview page, next to *"1 out of
4 websites in use"* — same place.)

Use **+ Add website** (top right) and add `prestige-automotive.be`.

**Result, confirmed:** Combell adds it as a **Subsite** with document root

```
/subsites/prestige-automotive.be
```

That is value #5. Note that it is **not** `/www` — `/www` belongs to
`prestige-garage.be`. Uploading there would put your files in the wrong site's
folder, and `prestige-automotive.be` would serve nothing.

### ⚠️ Adding the website silently creates an AAAA record

**Check this immediately after adding the website.**

Combell gives every website its own IPv6 address, and adding
`prestige-automotive.be` to the package **automatically created an AAAA record**
in its DNS:

```
prestige-automotive.be   AAAA   2a00:1c98:1000:12e3:0:4:1882:c584
```

Nobody asked for that record, and it takes effect straight away. The result is a
domain that is split across two servers:

| Visitor's connection | Goes to | Sees |
|---|---|---|
| IPv4 | Squarespace (A records) | the real, current website |
| **IPv6** | **Combell (AAAA record)** | **Combell's "hosting package has been activated" parkpage** |

Most mobile networks and many home ISPs prefer IPv6, so a large share of real
visitors get the parkpage instead of the website — while anyone on IPv4 sees
nothing wrong. That makes it very easy to miss.

**Fix it now: Dashboard → DNS & forwarding management → prestige-automotive.be →
AAAA-records → delete that record.** You add it back deliberately in Part 8,
together with the A record, once Combell is actually serving the site.

Verify from PowerShell — and ask the **authoritative** nameserver, not a public
resolver:

```powershell
nslookup -type=AAAA prestige-automotive.be ns1.combell.eu
```

That is the source of truth: it reports what is actually configured. A public
resolver like `8.8.8.8` only reports what *it* still remembers, which can be
half an hour out of date.

> **Expect a confusing gap after any DNS change.** Observed in practice here:
> Combell's nameservers had already dropped the record, Cloudflare, Quad9 and
> OpenDNS agreed — but Google's `8.8.8.8` kept serving the deleted AAAA for
> another half hour. A colleague on 5G therefore still landed on Combell and saw
> Apache's bare `It works!` page, while everyone else saw the normal site.
>
> Nothing was broken and nothing needed re-doing. If the authoritative
> nameserver says the record is gone, it is gone — wait for the TTL. Re-deleting
> or re-adding records during that window only makes things harder to reason
> about.

Useful meanwhile: `www.prestige-automotive.be` never had an AAAA record, so it
stays on IPv4 and keeps showing the old site throughout.

### The two domain rows

Under the new website you will see two rows with an **Activated** toggle:

| Domain | Toggle appearance |
|---|---|
| `prestige-automotive.be` | pale |
| `www.prestige-automotive.be` | solid blue |

The same pattern appears on `prestige-garage.be`, and on its technical hostname
`prestige-garagebe.webhosting.be`. **The pale toggle does not mean "off".**
Verified against the live server: both `prestige-automotive.be` and
`www.prestige-automotive.be` are answered, while a made-up hostname gets a
different fallback page. Both domains are wired up as they are — nothing to
change here.

The red padlock icons mean "no SSL certificate yet", which is correct until
Part 9.

> What you cannot tell yet is whether the bare domain is served from
> `/subsites/prestige-automotive.be` or from `/www`, because right now both
> folders hold the identical Combell parkpage. The check right after the upload
> (Part 4d) settles it.

### Understanding the folder layout

From the File Manager, your FTP account's home looks like this:

```
/                                       ← you land here over FTP
├── .webhosting                         (Combell internal)
├── cgi-bin
├── data
├── logs                                ← PHP error log (see Troubleshooting)
├── php
├── subsites
│   ├── prestige-config.php             ← your secrets land HERE
│   └── prestige-automotive.be/         ← YOUR DOCUMENT ROOT
│       ├── index.html
│       ├── .htaccess
│       ├── api/contact.php
│       └── assets/
├── tmp
└── www                                 ← prestige-garage.be's root. Leave alone.
    └── index.html                      (1 KB placeholder from Oct 2025)
```

Your secrets file goes **one level above the document root**, so no URL can
reach it. The deploy script works that out from value #5 — for this subsite it
lands at `/subsites/prestige-config.php`, and `api/contact.php` looks exactly
two levels up from itself, so the two meet. `/subsites` is not a document root
for any website, so nothing there is reachable over the web.

---

## Part 3 — FTP password

**Click: FTP & SSH.**

The server and username are already known (values #2 and #3). You need the
password.

### You do not have the password? That is normal — reset it.

The **Login details** popup shows the FTP server, the port (21) and the
username, but **never the password**. Combell stores it hashed, so nobody can
show it to you again — not you, not their support. There is nothing to recover.

Under **FTP & SSH**, open the FTP account and use the option to **change the
password**. Set a new one and copy it immediately.

Resetting is safe and boring:

| Resetting the FTP password affects | |
|---|---|
| FTP logins | ✅ yes — any saved FileZilla/WinSCP profile needs the new password |
| The website, email, DNS, databases | ❌ no — completely untouched |

If nobody else uses this FTP account, there is no downside at all. Pick a long
random password; you only paste it into PowerShell.

> **Why not the File Manager instead?** You *could* upload through Combell's
> browser File Manager, but it means creating folders and dragging 54 files
> across `assets/css`, `assets/js`, `assets/img` and `api/` by hand, every time
> you publish. FTP does it in one command. Fix the password.

**That username format is unusual and easy to get wrong.** It is
`prestige-garagebe@prestige-garagebe` — with the `@`, and *not* a domain name.

---

## Part 4 — Upload the files

Open **PowerShell** in the project folder.

### 4a. Set the four values

```powershell
$env:COMBELL_FTP_HOST = "ftp.prestige-garagebe.webhosting.be"
$env:COMBELL_FTP_USER = "prestige-garagebe@prestige-garagebe"
$env:COMBELL_FTP_PASS = "your-ftp-password"
$env:COMBELL_FTP_ROOT = "/subsites/prestige-automotive.be"
```

> These live only in this PowerShell window, on purpose — the password never
> touches a file. Open a new window tomorrow and you set them again.

### 4b. Dry run

```powershell
.\deploy\deploy-combell.ps1 -DryRun
```

**Expect:** `54 bestand(en) in scope, 12.7 MB`, starting with `.htaccess` and
`api/contact.php`.

A dry run does **not** contact the server, so it succeeds even with wrong
credentials. It only proves which files would be sent, never that your login
works.

### 4c. The real upload

```powershell
.\deploy\deploy-combell.ps1 -ConfigFile prestige-config.php
```

(Leave off `-ConfigFile` until you have done Part 5 — or do Part 5 first and
run this once.)

Takes a few minutes; each file gets its own encrypted connection. You will see
`ok` per file, then:

```
Klaar: 54 geupload, 0 ongewijzigd overgeslagen, 0 mislukt.
```

*geupload* = uploaded · *overgeslagen* = skipped · *mislukt* = failed.

### 4d. Verify — two ways

**In the panel:** **File Manager** → navigate into
`/subsites/prestige-automotive.be`. You should see `index.html`,
`contact.html`, `assets/`, `api/` and `.htaccess`.

**From PowerShell — this is the better check**, because it proves the *server*
serves your files on that domain, not just that the files exist:

```powershell
curl.exe -s -H "Host: prestige-automotive.be" http://188.208.37.139/ | Select-String "<title>"
curl.exe -s -H "Host: www.prestige-automotive.be" http://188.208.37.139/ | Select-String "<title>"
```

This asks the server for your domain **without touching DNS** — the domain
still points at Squarespace, and this bypasses that entirely.

| What you get back | Meaning |
|---|---|
| Your site's own `<title>` | ✅ correct — that domain is served from your folder |
| `Website Coming Soon - Combell.com Parkpage` | that hostname is still served from an empty folder, or from `/www` instead of your subsite |
| `Please stand by while configuration is in progress` | the server does not know that hostname at all |

If `www` works but the bare domain shows the parkpage, the bare domain is
mapped to the wrong website — fix it under **Websites & SSL** before going
further, because the bare domain is the one the whole site links to.

---

## Part 5 — The contact form (Resend)

### 5a. Account and domain

1. Sign up at **resend.com** (free, 3,000 emails/month).
2. **Domains → Add domain →** `prestige-automotive.be`.

### 5b. Add Resend's records at Combell

Resend shows a **Fill in your DNS Records** screen. For this domain it lists:

| Type | Name | Content |
|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA…wIDAQAB` (DKIM) |
| CNAME | `rsend` | `rsend-ap….mta.net` |
| CNAME | `send` | `send.for….mta.net` |

Scroll the whole Resend page — there may be more below (a DMARC TXT record, for
example). Add every record it lists.

In Combell: **Dashboard → DNS & forwarding management → prestige-automotive.be**.
The left menu has a page per record type — **TXT-records** and
**CNAME-records**. Add each one on its matching page.

> **About MX records.** Your root domain's MX points at `smtp.google.com` and
> must stay exactly as it is. If Resend asks for an MX record on a *subdomain*
> (something like `send.prestige-automotive.be`), that is a different record and
> is safe to add — it does not affect mail to `@prestige-automotive.be`. The
> rule is: never modify or delete the existing `prestige-automotive.be → smtp.google.com`
> record.

3. Wait until Resend reports the domain **Verified**. Minutes to a few hours.

Unverified domains get their mail refused or spam-filed, so do not skip this.

### 5c. API key

4. **API Keys → Create API Key**, permission **Sending access** only.
5. Copy it — shown once. That is value #6.

### 5d. Put it in a file

```powershell
copy deploy\prestige-config.example.php prestige-config.php
notepad prestige-config.php
```

```php
return [
    'RESEND_API_KEY' => 're_your_key_here',
    'CONTACT_TO'     => 'Geoffrey@prestige-automotive.be',
    'CONTACT_FROM'   => 'Prestige Automotive <website@prestige-automotive.be>',
];
```

Then push it to the server (above the document root, automatically):

```powershell
.\deploy\deploy-combell.ps1 -ConfigFile prestige-config.php
```

The file is in `.gitignore` and is never committed.

---

## Part 6 — Test before anything is public

You will view the Combell version on your own computer while everyone else still
sees Squarespace.

1. Start → type `Notepad` → **right-click → Run as administrator**.
2. **File → Open** →

   ```
   C:\Windows\System32\drivers\etc\hosts
   ```

   Change the file-type dropdown from *Text Documents* to *All Files* or the
   file will not appear.
3. Add at the bottom:

   ```
   188.208.37.139   prestige-automotive.be
   ```

4. Save, then open `http://prestige-automotive.be`.

### Check

- Homepage loads with logo and photos
- `/prijzen.html` and `/galerij.html` look right
- `/contact.html` — **send a real test message**, confirm it arrives

### Then remove that line and save again

If you forget, your computer keeps pointing at a fixed IP and you will be very
confused later.

**If anything is broken, stop.** Fix it now, while nobody can see it. See
[Troubleshooting](#troubleshooting).

---

## Part 7 — (nothing — numbering kept so Parts 8 and 9 match the wizard)

---

## Part 8 — The DNS cutover

**Dashboard → DNS & forwarding management → prestige-automotive.be**

The left menu has one page per record type:

```
DNS summary
Webforwarding
A-records        ← you work HERE, and only here
AAAA-records
CNAME-records
MX-records       ← smtp.google.com. DO NOT OPEN.
TXT-records      (Resend's DKIM went here)
NS-records
SRV / CAA / TLSA / ALIAS-records
```

Because each type has its own page, you cannot touch MX by accident as long as
you stay on **A-records**.

1. Click **A-records**.
2. You will see four records, all Squarespace:

   ```
   198.185.159.144   198.185.159.145   198.49.23.144   198.49.23.145
   ```

3. Replace them with **one** record:

   | Record | Destination | TTL |
   |---|---|---|
   | `prestige-automotive.be` | `188.208.37.139` | 3600 |

4. Do the same for `www` if it has its own A record. If `www` is a CNAME
   pointing at the domain, leave it — it follows automatically.
5. Save.

### Then put the AAAA record back

Only now — once the A record points at Combell too — re-add the IPv6 record you
deleted in Part 2, on the **AAAA-records** page:

| Record | Destination |
|---|---|
| `prestige-automotive.be` | `2a00:1c98:1000:12e3:0:4:1882:c584` |

Check the exact value against **Web hosting → Overview → IP address (v6)**,
because each website has its own. Skipping this is not fatal — IPv6 visitors
simply fall back to IPv4 — but with both records in place the site is reachable
either way, and the two stay consistent.

### Wait for it to spread

```powershell
nslookup prestige-automotive.be 8.8.8.8
```

When it prints `188.208.37.139`, the cutover is done. Usually minutes,
occasionally hours. During the wait some visitors get the old site and some the
new one — normal, and harmless since both work.

---

## Part 9 — SSL certificate, then force https

### 9a. The certificate

**Click: Websites & SSL.**

Now that DNS points at Combell, Let's Encrypt can verify the domain. It could
not have been done earlier — verification checks where the domain points, and
until Part 8 that was Squarespace.

1. Find `prestige-automotive.be` in the list.
2. Enable the free Let's Encrypt certificate for it (and for `www` if offered).
3. Wait until it reports active — usually minutes.
4. Visit `https://prestige-automotive.be` — padlock, no warning.

If the browser warns, it is not ready. Wait. **Do not do 9b yet.**

### 9b. Force https

The redirect ships **switched off on purpose**. Turning it on before the
certificate exists sends every visitor to an address that does not work.

1. Open `.htaccess` in the project folder.
2. Find:

   ```apache
   # @HTTPS-REDIRECT-START
   #RewriteCond %{HTTPS} !=on
   #RewriteCond %{HTTP:X-Forwarded-Proto} !=https
   #RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
   # @HTTPS-REDIRECT-END
   ```

3. Remove the `#` from the three `Rewrite` lines only. Leave the `@HTTPS-…`
   comment lines alone.
4. Upload just that file:

   ```powershell
   .\deploy\deploy-combell.ps1 -Only ".htaccess"
   ```

### Final checks (private/incognito window)

- `http://prestige-automotive.be` jumps to `https://`
- `https://www.prestige-automotive.be` works
- `/te-koop.html` lists the cars
- `/contact.html` sends
- `https://prestige-automotive.be/prestige-config.php` returns **403 or 404**.
  Seeing PHP code or a blank page means the secrets file is inside the document
  root instead of above it — re-run Part 5d.

**`/te-koop.html` empty?** Firebase console → **Authentication → Settings →
Authorized domains** → add `prestige-automotive.be`.

**Removed the hosts-file line from Part 6?** Do it now.

**Squarespace** keeps billing until you cancel it with Squarespace directly.

---

## Rollback plan (read before any DNS change)

Applies whichever host you cut over to — Combell, Netlify or anything else.
The only thing visitors ever notice is DNS, so DNS is the only thing you need
to be able to undo.

### The rollback target

The current Squarespace site.

**You can view it at any time, including after DNS has moved away, at its
built-in Squarespace URL:**

```
https://heron-bronze-egsw.squarespace.com
```

Verified 2026-09-25: HTTP 200, title `PRESTIGE AUTOMOTIVE`, byte-identical text
to what `prestige-automotive.be` serves today. Subpages such as `/over-ons`
work too. No login needed.

Bookmark it. As long as that URL loads, your rollback target is intact — so you
can confirm at a glance that restoring the records below will work.

(Squarespace `websiteId`: `65e1b977af2aa15d8bec85b8`, useful if you ever contact
their support.)

Restore these four A records and the old site is back on the real domain:

```
prestige-automotive.be   A   198.185.159.144
prestige-automotive.be   A   198.185.159.145
prestige-automotive.be   A   198.49.23.144
prestige-automotive.be   A   198.49.23.145
```

Verified authoritative on 2026-09-24.

### Three rules

1. **Do not cancel Squarespace** until the new site has run happily for a couple
   of weeks. That subscription *is* the rollback target. Cancel it and there is
   nothing to roll back to.
2. **Never touch the MX records.** They point at `smtp.google.com`. Nothing in a
   website cutover requires changing them, so email cannot break.
3. **Lower the TTL a day in advance.** See below — this is the step that decides
   whether a rollback takes 5 minutes or an hour.

### The day before: lower the TTL

The A records use a 3600-second (1 hour) TTL. That is also how long a rollback
would take to reach everyone — an hour of visitors seeing a broken site.

The day before the cutover, change **only** the A record TTL:

```
3600  ->  300
```

Wait an hour so the old TTL ages out of caches. Every change after that —
including an emergency rollback — propagates in about 5 minutes.

Put it back to 3600 a week or so after the cutover, once things are settled.

### The day before: export the zone

On **DNS & forwarding**, use the **csv** / **xlsx** export buttons, and
screenshot each record page (A, AAAA, CNAME, MX, TXT, SRV, CAA).

The TXT records matter most: they carry Google Workspace and Resend domain
verification. If one is deleted by accident, that export is the only way to
restore it exactly.

### If the cutover goes wrong

1. Restore the four A records above.
2. Delete any AAAA record you added — a stale AAAA sends IPv6 visitors to the
   new host while IPv4 goes to the old one, which looks like an intermittent
   fault. (This already happened once in this project.)
3. Wait for the TTL, then verify:

   ```powershell
   nslookup prestige-automotive.be 8.8.8.8
   ```

4. Check against the **authoritative** nameserver, not a public resolver, when
   you want to know what is really configured:

   ```powershell
   nslookup prestige-automotive.be ns1.combell.eu
   ```

---

## Publishing changes later

```powershell
$env:COMBELL_FTP_HOST = "ftp.prestige-garagebe.webhosting.be"
$env:COMBELL_FTP_USER = "prestige-garagebe@prestige-garagebe"
$env:COMBELL_FTP_PASS = "your-ftp-password"
$env:COMBELL_FTP_ROOT = "/subsites/prestige-automotive.be"

.\deploy\deploy-combell.ps1
```

Unchanged images are skipped, so this takes seconds.

```powershell
.\deploy\deploy-combell.ps1 -DryRun                # look, don't touch
.\deploy\deploy-combell.ps1 -Only "prijzen.html"   # one file
.\deploy\deploy-combell.ps1 -Force                 # re-upload everything
```

---

## Troubleshooting

**Upload fails immediately for every single file, with "(500) Syntax error,
command unrecognized."**
This server does not support FTPS. Verified: its `FEAT` list contains no `AUTH`,
and `AUTH TLS` is answered with `500 AUTH not understood`. Run with `-NoSsl`:

```powershell
.\deploy\deploy-combell.ps1 -NoSsl
```

That sends your password unencrypted, so change the FTP password afterwards, and
ask Combell whether FTPS or SSH/SFTP can be enabled on the package. The script
now detects this case up front and says so, instead of failing once per file.

**Everything returns "Please stand by while configuration is in progress".**
Combell has not finished creating the vhost for the subsite. Confirm it with a
request for a file you know exists:

```powershell
curl.exe -s -o nul -w "%{http_code}" -H "Host: prestige-automotive.be" http://188.208.37.139/assets/css/style.css
```

A `404` for a file that is visible in the File Manager means requests are not
reaching your document root. That is not something you can configure away — it
is Combell's side. This normally takes minutes; if it lasts hours, open a
support ticket quoting the package, the IP, the document root and that 404.
Do **not** change the A records while this is happening: you would take the live
site down and replace it with that holding page.

**Upload fails with a login error (530).**
Check the username. It is `prestige-garagebe@prestige-garagebe` — with the `@`,
and it is *not* a domain name. The FTP server is
`ftp.prestige-garagebe.webhosting.be`, not `ftp.prestige-automotive.be`.

**Upload fails with 550 / permission denied.**
`COMBELL_FTP_ROOT` is wrong. Open File Manager and confirm the folder exists.

**Upload succeeds but the site does not appear.**
Almost certainly the document root. Confirm in **Websites & SSL** which folder
`prestige-automotive.be` is served from, and match `COMBELL_FTP_ROOT` to it.

**FTPS connection is refused.**
`-SkipCertCheck` if the complaint is about the FTP server's certificate. As a
last resort `-NoSsl`, but that sends your password unencrypted — testing only.

**The form says "E-mail is niet geconfigureerd."**
The server cannot find the secrets file. Over FTP, confirm `prestige-config.php`
sits one level *above* the document root, not inside it.

**The form gives a 404.**
Open `https://prestige-automotive.be/api/contact.php` directly — it should say
*Method Not Allowed*, proving the file is there. If it does, mod_rewrite is the
issue: in `contact.html` change `action="/api/contact"` to
`action="/api/contact.php"` and re-upload that file.

**The form says "Verzenden is niet gelukt."**
Resend refused it. The reason is in the PHP error log — the **`logs`** folder in
File Manager — on a line starting `Resend-fout`. Usually an invalid API key, or
a `CONTACT_FROM` on a domain Resend has not verified.

**Site shows an old version.**
`.htaccess` caches HTML for 10 minutes, images far longer. Ctrl+F5, or a private
window.

---

## Appendix: what gets uploaded

54 files, 12.7 MB. Deliberately excluded:

| Excluded | Why |
|---|---|
| `_legacy-squarespace/` | 16 MB archive of the old site, reference only |
| `docs/` | documentation, including this file |
| `functions/` | the Cloudflare Pages version of the form — cannot run on Combell |
| `deploy/` | the deploy script and wizard |
| `.git/`, `.claude/` | tooling |
| `.env`, `prestige-config.php` | **your passwords.** `.env` is not PHP, so anyone could read it as plain text if it reached the web root |
| `*.md` | documentation |

> `functions/api/contact.js` is the original Cloudflare version of the contact
> form and cannot run here. The live one is `api/contact.php`. Both are kept in
> case the site moves back to Cloudflare — if you edit one, edit the other.
