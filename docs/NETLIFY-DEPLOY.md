# Going live on Netlify

In English, like `COMBELL-DEPLOY.md`, since this is the document you read.

Your Netlify site already exists and auto-deploys from
`github.com/Lathif21/prestige_automotive`. Pushing to `main` publishes it. What
was missing is the contact form and the custom domain — both covered below.

---

## What is already true

| | |
|---|---|
| Netlify site | `prestige-automotive-v1.netlify.app` — live, serving the current design |
| Deploy method | connected to GitHub, automatic on push to `main` |
| Pages | all 7, content-identical to this repo |
| Contact form | **broken** — `/api/contact` returned 404. Fixed by this change |
| Custom domain | not yet attached |
| DNS | stays at **Combell** — only the records change |
| Email | Google Workspace, untouched throughout |

### What I added to the repo

| File | Purpose |
|---|---|
| `netlify/functions/contact.mjs` | the contact form, as a Netlify Function using Resend |
| `netlify.toml` | routes `/api/contact` to that function, sets caching and security headers |

`contact.html` is **unchanged** — it still posts to `/api/contact`, and
`netlify.toml` rewrites that internally. The same form markup therefore works on
Netlify, Combell and Cloudflare without edits.

### Three copies of the same endpoint

| File | Runs on |
|---|---|
| `netlify/functions/contact.mjs` | **Netlify — the live one** |
| `api/contact.php` | Combell |
| `functions/api/contact.js` | Cloudflare Pages |

Keep them in step if you change one, or delete the ones you have abandoned.

---

## Step 0 — Preparation (do this first, it is what makes the cutover safe)

Both steps are invisible to visitors and take five minutes.

1. **DNS TTL — already fine.** The A records are on TTL `600` (10 minutes), not
   3600, so a rollback reaches everyone in about ten minutes. Nothing to change.
   You could drop it to `300` for the cutover itself, but it is not necessary.
2. **Back up the zone.** `DNS-BACKUP.txt` in this folder holds everything that is
   publicly queryable, captured before any change. Combell's **csv / xlsx**
   buttons live on the *list* pages, not on the per-record-type pages — on the
   A-records page, check the **☰ ▾** menu next to **+ Add**, and the
   **DNS summary** page in the left menu. If neither offers an export,
   screenshot each record page that has entries. `DNS-BACKUP.txt` plus those
   screenshots is a complete restore kit.

The full rollback procedure is in `COMBELL-DEPLOY.md` → *Rollback plan*. It
applies here too: the target is the Squarespace site, and the four A records to
restore are listed there.

---

## Step 1 — Resend (the contact form's email)

Skip if you already finished this for Combell — it is the same account, the same
domain verification and the same key.

1. Sign up at **resend.com**.
2. **Domains → Add domain →** `prestige-automotive.be`.
3. Resend shows DNS records. Add them at **Combell → DNS & forwarding →
   prestige-automotive.be**, on the matching page per type:

   | Type | Name | Page in Combell |
   |---|---|---|
   | TXT | `resend._domainkey` | TXT-records |
   | CNAME | `rsend` | CNAME-records |
   | CNAME | `send` | CNAME-records |

   Scroll Resend's page fully — there may be a DMARC record below.

   > Leave the MX record (`smtp.google.com`) alone. If Resend asks for an MX on
   > a *subdomain* such as `send.prestige-automotive.be`, that is a different
   > record and is safe to add.

4. Wait for **Verified**.
5. **API Keys → Create**, permission **Sending access** only. Copy the key.

These records stay at Combell and are unaffected by moving the website to
Netlify — only the A/ALIAS records change.

---

## Step 2 — Environment variables in Netlify

**Netlify → your site → Site configuration → Environment variables.**

Add three — but in **two phases**, because the final values only work once
Resend has verified the domain.

### Phase 1 — while testing (no domain verification needed)

| Key | Value |
|---|---|
| `RESEND_API_KEY` | the key from step 1.5 — **mark it secret** |
| `CONTACT_FROM` | `Prestige Automotive <onboarding@resend.dev>` |
| `CONTACT_TO` | **your own email — the address your Resend account uses** |

`onboarding@resend.dev` is Resend's shared test sender. It needs no DNS setup,
but Resend will only deliver it **to the account owner's own address**. Put
Geoffrey's address here too early and the send is rejected — which looks exactly
like a broken function.

### Phase 2 — once the domain shows Verified

| Key | Value |
|---|---|
| `RESEND_API_KEY` | unchanged |
| `CONTACT_FROM` | `Prestige Automotive <website@prestige-automotive.be>` |
| `CONTACT_TO` | `Geoffrey@prestige-automotive.be` |

Resend forbids `onboarding@resend.dev` in production, so phase 2 must be done
before go-live.

> Mark **only** `RESEND_API_KEY` as secret. If the key shows an open padlock in
> the Netlify UI, its value is readable in the interface and in build logs.
> Set values for **all deploy contexts**, or at minimum Production.

Without `RESEND_API_KEY` the form returns *"E-mail is niet geconfigureerd."* and
tells the visitor to phone instead. It does not pretend to succeed.

Netlify only picks up new variables on the **next deploy**, so set them before
step 3 — or redeploy afterwards.

---

## Step 3 — Push, which deploys

```bash
git add netlify.toml netlify/
git commit -m "Add Netlify function for the contact form"
git push
```

Netlify builds automatically. Watch it under **Deploys**. There is no build
command — it just publishes the files — so it takes seconds.

> **`docs/` is in `.gitignore`**, so this file and `COMBELL-DEPLOY.md` are never
> committed and never reach Netlify. They live only on your machine — worth
> backing up somewhere, or removing `docs` from `.gitignore` if you would rather
> version them with the code.
>
> `_legacy-squarespace/` (16 MB) is ignored too, so it is not published either.
> `deploy/` and `api/contact.php` are Combell-only; `netlify.toml` returns 404
> for both so they are not served even if you commit them.

---

## Step 4 — Test the form on the Netlify URL

Before any DNS change, on `https://prestige-automotive-v1.netlify.app/contact.html`:

- send a real test message
- confirm it arrives at `CONTACT_TO`

Quick check that the route exists at all:

```powershell
curl.exe -s -o nul -w "%{http_code}" https://prestige-automotive-v1.netlify.app/api/contact
```

`405` means the function is live and correctly refusing GET. `404` means the
redirect or the function did not deploy — check the Deploys log.

**Do not continue until the form works here.** Once DNS moves, a broken form is
a broken live site.

---

## Step 5 — Attach the custom domain

**Netlify → Domain management → Add a domain →** `prestige-automotive.be`.

Netlify will then show you **exactly which DNS records to create**. Read them
there rather than trusting values written down anywhere else — Netlify changes
them from time to time.

You will be offered two routes:

| Route | When |
|---|---|
| **Netlify DNS** (change nameservers) | **Do not use this.** It would move your whole zone away from Combell, taking Google Workspace MX and Resend records with it. Far more risk than it is worth. |
| **External DNS** (keep Combell, add records) | **Use this.** |

Then, in Combell → DNS & forwarding → prestige-automotive.be:

| Record | Combell page | Action |
|---|---|---|
| apex `prestige-automotive.be` | **ALIAS-records** | **add** → `prestige-automotive-v1.netlify.app` |
| the 4 Squarespace A records | **A-records** | **delete** (198.185.159.144/145, 198.49.23.144/145) |
| `www` | **CNAME-records** | **change** — see below |

Combell has an ALIAS-records page, which is the clean way to point a bare domain
at a hostname. If Netlify instead gives you a plain **A record IP**, use the
A-records page with that value.

> ### `www` is a CNAME, not an A record
>
> Confirmed in DNS:
>
> ```
> www.prestige-automotive.be   CNAME   ext-cust.squarespace.com
> ```
>
> So `www` does **not** follow the apex automatically — it points straight at
> Squarespace on its own. You must **edit that CNAME** to
> `prestige-automotive-v1.netlify.app`. If you only change the apex, `www`
> keeps serving the old Squarespace site indefinitely.

### Leave these alone

| Record | Value | Why |
|---|---|---|
| MX | `smtp.google.com` (pref 1) | company email |
| TXT | `google-site-verification=RUviNQk…` | Google Workspace ownership |
| TXT | `v=spf1 mx a include:_spf.relay.mailprotect.be ~all` | SPF — who may send mail |
| A | `ftp.prestige-automotive.be` → `217.21.190.139` | leftover from an older host; unrelated, harmless |

> **A note on SPF and Resend.** Your SPF currently authorises Combell's relay
> (`_spf.relay.mailprotect.be`), not Resend. Resend's modern setup sends from a
> **subdomain** (`send.prestige-automotive.be`) with its own SPF record, so the
> line above does not need changing. Only if Resend explicitly tells you to add
> an `include:` to the root SPF should you edit it — and then **edit** the
> existing line, never add a second `v=spf1` record. Two SPF records on one name
> is invalid and breaks mail authentication.

There are currently **no CAA records**, so nothing blocks Let's Encrypt from
issuing Netlify's certificate.

---

## Step 6 — Certificate

Netlify issues a Let's Encrypt certificate automatically once DNS points at it.
Under **Domain management → HTTPS** it may say *waiting on DNS* for a while;
that is normal. If it is still stuck after an hour, use **Renew certificate**.

You do not need to do anything in `.htaccess` — that file is for Apache and
Netlify ignores it. Netlify forces HTTPS on its own.

---

## Step 7 — Verify

```powershell
nslookup prestige-automotive.be 8.8.8.8
```

Then, in a private window:

- `https://prestige-automotive.be` — the new design, padlock, no warning
- `http://prestige-automotive.be` — redirects to https
- `https://www.prestige-automotive.be` — works
- `/te-koop.html` — lists the cars from Firestore
- `/contact.html` — send one more real test message

**If `/te-koop.html` is empty:** Firebase console → **Authentication → Settings →
Authorized domains** → add `prestige-automotive.be`.

Raise the DNS TTL back to `3600` a week later, once you are confident.

Do not cancel Squarespace until then — it is your rollback target.

---

## What about Combell?

Nothing breaks, and nothing is wasted:

- **The domain and DNS stay at Combell.** Unchanged.
- **The hosting package sits idle.** You keep paying until you cancel it.
- Your files are still uploaded at `/subsites/prestige-automotive.be`, so if
  Combell ever fixes the stuck vhost you can switch by changing DNS back —
  see `COMBELL-DEPLOY.md`.
- Still worth phoning them (0800 8 5678) to find out whether that package is
  usable before it renews.

---

## Publishing changes later

```bash
git add -A
git commit -m "..."
git push
```

That is the whole deploy. No FTP, no passwords, no `-NoSsl`.
