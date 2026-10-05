# Instagram feed — technical notes

Audience: whoever implements and maintains the gallery feed.
Companion to `INSTAGRAM-FEED-SETUP.md`, which is the client-facing walkthrough.

**Status:** built on Netlify Functions + Netlify Blobs (§3, option D). It goes
live once the client opens the connect link (§6). Until then the gallery shows the fixed
photos.

---

## 1. What the old site actually did

The client asked for the gallery to be "automatically linked to their Instagram
feed, similar to how it was set up on their previous website." That premise does
not hold. The live Squarespace site at prestige-automotive.be was checked page by
page (`/`, `/diensten`, `/prijzen`, `/realisaties`, `/over-ons`, `/contact`):

| Check | Result |
|---|---|
| Third-party feed widget (LightWidget, Behold, SnapWidget, Elfsight, Instafeed, Juicer, Curator, EmbedSocial, Taggbox) | **none found** |
| Images served from `cdninstagram.com` / `fbcdn.net` | **zero** |
| Gallery image host | `images.squarespace-cdn.com` — manually uploaded |
| Instagram embeds | exactly one, a single reel iframe (`/reel/DEvKHaZN2ry/embed/`) on `/realisaties` |
| Instagram profile linked | `carrez_customs` (39 occurrences) |

So the old gallery was a hand-curated Squarespace gallery, plus one embedded
reel and a "follow us" link. There was never an automatic feed to reproduce.
What the client asked for is new work, not a restoration.

The account question is settled: **`@_prestige_automotive`**.

## 2. Why a token cannot live in the page

The Instagram API authenticates with a bearer token, and any token shipped to
the browser is readable by anyone who opens devtools or views source. It also
expires every 60 days.

Therefore the API route **requires a server-side component**. The site is
hosted on Netlify (DNS stays at Combell), and Netlify Functions are that
component.

## 3. Options

| | Option | Cost | Verdict |
|---|---|---|---|
| A | Hosted feed service (Behold, LightWidget, …) | free tier: 6 posts, 1,200 views/mo, logo on hover; realistically $10/mo | not chosen |
| B | Graph API + Cloud Function into Firestore | needs the Firebase **Blaze** (billing) plan for Functions/Scheduler | not chosen |
| C | Manual curation of the static grid | free | the fallback — still what shows if the feed fails |
| **D** | **Graph API + Netlify Scheduled Function + Netlify Blobs** | **free** — within Netlify's free tier | **built** |

### Option D — how it works

```
Netlify Scheduled Function  instagram-sync   (@daily)
  ├─ every 7 days: GET graph.instagram.com/refresh_access_token
  │                → new token saved in Blobs   (store "instagram", key "token")
  ├─ GET graph.instagram.com/me/media?fields=…
  │                → normalised posts saved in Blobs  (key "feed")
  └─ on trouble: email via Resend → INSTAGRAM_ALERT_TO

Netlify Function  instagram   GET /api/instagram
  └─ returns the "feed" blob — never talks to Instagram, never sees the token

galerij.html → assets/js/instagram-feed.js → fetch('/api/instagram')
  └─ any failure → the fixed photo grid stays visible
```

| File | Role |
|---|---|
| `netlify/lib/instagram.mjs` | all the logic: token handling, refresh, fetching, normalising. No Netlify imports, so it can be tested with a fake store |
| `netlify/functions/instagram-sync.mjs` | the scheduled job + alert email |
| `netlify/functions/instagram.mjs` | the public read endpoint |
| `netlify/functions/instagram-connect.mjs` | the link the client opens: Instagram login → token → Blobs (§6) |
| `netlify.toml` | rewrites `/api/instagram` to the function |
| `package.json` | the one dependency, `@netlify/blobs`. Netlify installs it on deploy |

Why daily and not only when the client posts: the image URLs Instagram returns
are signed CDN links that expire after a few days. A daily copy keeps them
valid.

Properties worth knowing:

- **The token never reaches the browser.** The browser only ever sees the
  normalised posts.
- **It survives Instagram outages.** If a sync fails, the previous feed stays
  in Blobs and keeps being served.
- **Visitors cannot burn the API quota.** `/api/instagram` reads Blobs only;
  Instagram is called once a day regardless of traffic.
- **The Blobs store is site-wide**, not per-deploy, so the token and feed
  survive every redeploy.

## 4. Graph API reference

Verified against Meta's Instagram Platform documentation.

**Account requirement:** Instagram Business or Creator account. Personal
accounts cannot be read via the API.

**Login variant:** *Instagram API with Instagram Login* — does not require a
linked Facebook Page. (*Instagram API with Facebook Login for Business* does,
and adds capabilities this use case does not need.)

**Scope:** `instagram_business_basic` — read-only, sufficient for a gallery.
The other scopes (`instagram_business_content_publish`,
`instagram_business_manage_messages`, `instagram_business_manage_comments`)
must not be requested.

**Token lifecycle:**

| Stage | Lifetime | Endpoint |
|---|---|---|
| Short-lived | 1 hour, single use | returned by the login flow |
| Exchange → long-lived | 60 days | `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=<secret>&access_token=<short-lived>` |
| Refresh | extends 60 days | `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<current>` |

Refresh preconditions: the token is at least 24 hours old, not yet expired, and
`instagram_business_basic` is still granted. **A token not refreshed within 60
days is permanently dead** — recovery means re-running the login flow.

**Media endpoint:** `GET https://graph.instagram.com/me/media`, unversioned, so
it uses the app's default API version. Field availability varies by media type:
`thumbnail_url` is only present on video, and carousels need the `children`
edge. `netlify/lib/instagram.mjs` handles all three (`pickImage`).

## 5. The code contract

`/api/instagram` returns:

```json
{ "updatedAt": "2026-10-02T03:00:00.000Z",
  "posts": [{ "id": "…", "mediaUrl": "…", "permalink": "…", "caption": "…", "timestamp": "…" }] }
```

or **404** if nothing has been synced yet (**503** if Blobs is unreachable).
Errors are sent with `no-store`, so the gallery switches over as soon as the
first sync lands. Successful responses are cached 5 min in the browser and 1 h
on Netlify's CDN.

`assets/js/instagram-feed.js` renders into `#ig-grid` on `galerij.html` and hides
`#gallery-fallback` on success. It reads per post:

| Field | Source tried, in order |
|---|---|
| image | `sizes.medium.mediaUrl` → `mediaUrl` → `thumbnailUrl` → `media_url` |
| link | `permalink` → profile URL |
| alt text | first line of `caption`, truncated to 120 chars |

On any failure — 404, network error, empty feed, no usable media — it leaves
the static grid visible and logs a warning. The gallery never breaks. That also
covers running the site locally or on Combell, where `/api/instagram` does not
exist.

## 6. Going live (one time)

The Meta app lives under **our** developer account. The client never handles a
key and never types their password on our screen: they open a link, log in on
Instagram's own page and tap *Allow*. `instagram-connect` turns that approval
into a token and stores it (client steps: `INSTAGRAM-FEED-SETUP.md`).

```
client opens /api/instagram/connect
  → 302 to instagram.com/oauth/authorize   (scope instagram_business_basic, signed state)
  → client logs in + Allow
  → Instagram redirects to /api/instagram/connect?code=…&state=…
       ├─ state checked (signed by us, < 30 min old)
       ├─ POST api.instagram.com/oauth/access_token   code → 1-hour token
       ├─ GET  graph.instagram.com/access_token        → 60-day token
       ├─ GET  graph.instagram.com/me                  must be @_prestige_automotive, else refused + discarded
       ├─ token saved in Blobs, first sync run
       └─ "Gelukt" page
```

1. **Client:** switch `@_prestige_automotive` to a Business or Creator account.
2. **Create the Meta app:** https://developers.facebook.com → *My Apps* →
   *Create App*, type *Business*. Add the product **Instagram → API setup with
   Instagram business login**.
3. **Redirect URL:** under *Set up Instagram business login → Business login
   settings → OAuth redirect URIs*, add exactly:

   ```
   https://prestige-automotive.be/api/instagram/connect
   ```

   The URL must match character for character, without a trailing slash. If you
   ever test from another domain, register it too and set
   `INSTAGRAM_REDIRECT_URI` to match.
4. **Netlify → Site configuration → Environment variables:**

   | Key | Value |
   |---|---|
   | `INSTAGRAM_APP_ID` | the **Instagram app ID** shown on that Instagram setup page. This is *not* the Meta App ID at the top of the dashboard |
   | `INSTAGRAM_APP_SECRET` | the **Instagram app secret** from the same page. **Mark it secret** |
   | `INSTAGRAM_ALERT_TO` | optional; who gets failure emails. Defaults to the developer |

   `RESEND_API_KEY` and `CONTACT_FROM` from the contact form are reused for the
   alert email. With the test sender `onboarding@resend.dev`, Resend only
   delivers to the Resend account owner.
5. **Deploy** (push to `main`). Netlify picks up new variables only on the next
   deploy.
6. **Development mode access:** an app in development mode only accepts
   accounts that have a role on it. Under **App roles → Roles → Instagram
   Testers**, add `_prestige_automotive`. The client accepts in the Instagram
   app under *Settings → Website permissions → Apps and websites*. Do this
   before sending the link, or the client gets "app not available". No App
   Review is needed: we only read the account that authorised us.
7. **Test it yourself first:** open the link and check that it redirects to
   Instagram's login, then cancel. You should land on the *"Niet gekoppeld"*
   page. That proves the redirect URL and the app ID are right.
8. **Send the client the link:** `https://prestige-automotive.be/api/instagram/connect`.
   It is safe to share. Anyone can open it, but only a login as
   @_prestige_automotive gets connected.
9. **Check:** `https://prestige-automotive.be/api/instagram` returns posts, and
   `/galerij.html` shows them. Netlify → Functions → `instagram-connect` logs
   `Instagram gekoppeld als @_prestige_automotive`.

**Fallback, a manual token:** in the Meta dashboard, *Generate access tokens →
Add account → Generate token*. That needs the client to log in on *your*
screen. Put the token in `INSTAGRAM_TOKEN` (secret), redeploy, then *Run now*
on `instagram-sync`. Use this only if the link flow is broken.

## 7. Maintenance

Normally there is none. The job renews the token every 7 days, so it would take
several weeks of continuous failure before the 60-day limit is reached.

**You get an email** (subject *"Instagram-feed galerij — actie nodig"*) when:

| Situation | Typical cause | Fix |
|---|---|---|
| fetching posts fails | token revoked, account switched back to personal, Instagram outage | outage: wait. Otherwise send the client the link again |
| refresh failed 3 days in a row | client changed password or removed the app's access | send the client the link again |
| token expires within 14 days | refresh keeps failing | send the client the link again, before it expires |
| no token | nobody has connected yet | send the client the link (§6 step 8) |

**Reconnecting** is the same link and the same two minutes for the client. The
new token simply replaces the old one in Blobs; no redeploy is needed.

**Connect errors** show in Netlify → Functions → `instagram-connect`.
`exchange` almost always means the redirect URL in Meta doesn't match exactly,
or the app ID/secret is the Meta one instead of the Instagram one.

**Logs:** Netlify → Functions → `instagram-sync`. A healthy run logs
`Instagram-sync: 15 berichten opgeslagen`.

**To switch the feed off:** set `FEED_URL: ''` in `assets/js/instagram-feed.js`.
The scheduled job keeps running harmlessly; delete the two functions to stop it
too.

**Free-tier footprint:** one scheduled run a day (a few seconds), a few kB in
Blobs, and one function call per gallery visit that the CDN does not answer.
That is far inside Netlify's free limits.
