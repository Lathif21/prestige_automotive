# Contact form — deployment setup (Cloudflare Pages)

The contact form on `contact.html` now posts to a Cloudflare Pages Function at
`/api/contact`, which sends the submission by email via Resend.

**Until the environment variables below are set, the form returns an error and
tells the visitor to phone or email instead.** It no longer pretends to succeed.

---

## 1. Resend account and domain

1. Create an account at https://resend.com (free tier: 3,000 emails/month).
2. Go to **Domains** and add `prestige-automotive.be`.
3. Add the DNS records Resend shows you. The domain is already on Cloudflare,
   so add them under **Cloudflare → DNS**. Set those records to **DNS only**
   (grey cloud), not proxied.
4. Wait for Resend to report the domain as **Verified**.
5. Go to **API Keys** and create a key with **Sending access** only. Copy it —
   it is shown once.

Domain verification matters: mail sent from an unverified domain either fails or
lands in spam. `onboarding@resend.dev` works for testing but Resend forbids it in
production.

## 2. Cloudflare Pages environment variables

In **Cloudflare Dashboard → Workers & Pages → your project → Settings →
Environment variables**, add these to the **Production** environment. Use the
**Secret** type for the API key, not plain text:

| Variable | Value | Type |
|---|---|---|
| `RESEND_API_KEY` | the key from step 1.5 | Secret |
| `CONTACT_TO` | `Geoffrey@prestige-automotive.be` | Plain text |
| `CONTACT_FROM` | `Prestige Automotive <website@prestige-automotive.be>` | Plain text |

Redeploy after adding them — Pages only picks up new variables on the next build.

### Preview environments

Leave `CONTACT_TO` **unset** in the Preview environment. The function then falls
back to `lathif.sihab-dewantoro@drpbuildlab.com`, so preview deployments and
test submissions never reach the client. That fallback is deliberate; don't
replace it with Geoffrey's address.

## 3. Deploying

Pages Functions only work via **Git integration or Wrangler** — the drag-and-drop
dashboard upload does not support them. The `functions/` directory must sit at
the project root, alongside the HTML files, and must not be inside a build output
directory.

```
/
├── functions/api/contact.js   ← the endpoint
├── contact.html
├── assets/
└── ...
```

## 4. Testing

After deploying, submit the form once on the live site. Expect:

- the button shows "Verzenden…", then "Bericht verstuurd ✓"
- an email arrives at `CONTACT_TO`
- replying to that email goes to the visitor, not to Resend (`reply_to` is set
  to the submitter's address)

To test the endpoint directly without the page:

```bash
curl -X POST https://<your-site>/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"voornaam":"Test","achternaam":"Bericht","email":"you@example.com",
       "service":"Keramische Coating","bericht":"Test"}'
```

Expected: `{"ok":true}`. Failures return `{"ok":false,"error":"…"}` with a 4xx or
5xx status; check **Workers & Pages → your project → Logs** for the reason.

## 5. What the endpoint does

- Accepts `POST` only; other methods get 405
- Accepts both `FormData` and JSON bodies
- Requires voornaam, achternaam, email, service and bericht; validates the email
  shape and caps the message at 5,000 characters
- **Honeypot**: a hidden `website` field. Bots fill it; humans never see it. If
  it is filled the function returns success without sending, so the bot learns
  nothing
- HTML-escapes every value before putting it in the email body
- Sets `reply_to` to the visitor's address so replies work directly
- Never echoes the API key, and logs failures without exposing it

## 6. Known gaps

- **No rate limiting.** The honeypot stops naive bots but not a determined
  flood. If spam becomes a problem, add a Cloudflare WAF rate-limiting rule on
  `/api/contact` (Security → WAF → Rate limiting rules) — that is cheaper and
  more effective than handling it in the function.
- **No stored copy.** Submissions exist only as email. If a delivery fails the
  enquiry is lost. The project already uses Firestore for Te Koop, so writing a
  copy there is a small addition if the client wants an archive.
