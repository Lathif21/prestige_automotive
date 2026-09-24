# ROLLBACK CARD — prestige-automotive.be

One page. Follow it top to bottom if the cutover goes wrong.

Snapshot taken **2026-09-25 02:28**, from Combell's authoritative nameserver,
immediately before the cutover.

---

## First: is it actually broken?

Check the old site is still alive — it is independent of DNS:

**https://heron-bronze-egsw.squarespace.com**

Verified working at snapshot time: HTTP 200, 511,184 bytes. If that loads, the
rollback below will work. Nothing at Squarespace has been changed or cancelled.

---

## Restore these exact values

At **Combell → DNS & forwarding → prestige-automotive.be**.

### Step 1 — remove the Netlify ALIAS first

**ALIAS-records** → delete the entry pointing at `apex-loadbalancer.netlify.com`.

Do this **before** step 2. An ALIAS and A records cannot coexist on the same
name; if you add the A records first, Combell may reject them or behave oddly.

### Step 2 — re-create the four A records

**A-records** → Add, four times:

| Record | IP address | TTL |
|---|---|---|
| `prestige-automotive.be` | `198.49.23.144` | 600 |
| `prestige-automotive.be` | `198.49.23.145` | 600 |
| `prestige-automotive.be` | `198.185.159.144` | 600 |
| `prestige-automotive.be` | `198.185.159.145` | 600 |

All four. Squarespace load-balances across them.

### Step 3 — point `www` back

**CNAME-records** → edit `www`:

```
www.prestige-automotive.be   CNAME   ext-cust.squarespace.com
```

TTL 600. (During the cutover this was changed to
`prestige-automotive-v1.netlify.app`.)

### Do NOT touch

| Record | Value | Why |
|---|---|---|
| MX | `smtp.google.com` pref 1 | company email |
| TXT | `google-site-verification=RUviNQk…` | Google Workspace |
| TXT | `v=spf1 mx a include:_spf.relay.mailprotect.be ~all` | SPF |
| TXT | `resend._domainkey` | Resend DKIM — keep, harmless |
| CNAME | `rsend`, `send` | Resend — keep, harmless |
| CNAME | `f75lfl3d2m9rfdm93dt9` | Squarespace domain verification — **needed for rollback** |
| CNAME | `mail`, `autoconfig`, `autodiscover` | mail client autodiscovery |
| A | `ftp` → `217.21.190.139` | unrelated leftover |

Rolling back the website does **not** require touching any mail record. If you
find yourself editing MX, stop — you are in the wrong place.

---

## Then verify

### 1. Did Combell actually publish?

```powershell
Resolve-DnsName prestige-automotive.be -Type SOA -Server ns1.combell.eu
```

Decode the serial as a Unix timestamp:

```powershell
[DateTimeOffset]::FromUnixTimeSeconds(<serial>).UtcDateTime
```

**If that timestamp is older than your edit, Combell has not published the
change and nothing you did is live yet.** This happened once already: the zone
froze for 48 hours while the panel happily accepted edits. Editing again does
not help — phone Combell on 0800 8 5678.

### 2. Is the domain back on Squarespace?

```powershell
Resolve-DnsName prestige-automotive.be -Type A -Server ns1.combell.eu
Resolve-DnsName www.prestige-automotive.be -Type CNAME -Server ns1.combell.eu
```

Expect the four `198.*` addresses, and `ext-cust.squarespace.com`.

### 3. How long until visitors see it?

TTL is **600 seconds**, so about **10 minutes** for most people, plus browser
caching. Test in a private window.

---

## Why this is low risk

- **Only DNS changes.** The Squarespace site is untouched — not cancelled, not
  disconnected, not edited. It keeps serving on its built-in URL throughout.
- **TTL is 600, not 3600.** A rollback reaches people in ~10 minutes.
- **Email is never involved.** No step touches MX, SPF or DKIM.
- **The Netlify site does not disappear either.** It stays live at
  `prestige-automotive-v1.netlify.app`, so you can keep fixing whatever went
  wrong and cut over again later.

The worst realistic outcome is ~10 minutes of visitors seeing the wrong site.

---

## Do not cancel Squarespace

Not until the new site has run cleanly for a couple of weeks. The subscription
**is** this rollback. Cancel it and everything above stops working.
