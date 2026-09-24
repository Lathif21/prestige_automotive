# Instagram feed — technical notes

Audience: whoever implements and maintains the gallery feed.
Companion to `INSTAGRAM-FEED-SETUP.md`, which is the client-facing walkthrough.

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

**Two consequences worth raising with the client before any build:**

1. What they are asking for is new work, not a restoration. The effort and the
   ongoing maintenance below are not something the old site was absorbing.
2. **The account differs.** The old site links to `@carrez_customs`; the brief
   gives `@_prestige_automotive`. Confirm which account should feed the gallery
   before wiring anything up.

## 2. Why a token cannot live in the page

This is a static site with no backend. The Instagram Graph API authenticates
with a bearer token, and any token shipped to the browser is readable by
anyone who opens devtools or views source. It also expires every 60 days, so
even ignoring the exposure it would need a redeploy every two months.

Therefore the Graph API route **requires a server-side component**. There is no
configuration of client-side JavaScript that makes it safe.

## 3. Options

### Option A — Hosted feed service (recommended)

Behold, LightWidget, SnapWidget et al. hold the token, handle the 60-day
refresh, and expose a public CORS-enabled JSON feed. No secret touches this
repo.

- Cost: free tier is 6 posts, 1,200 views/month and carries a Behold logo on
  hover — realistically the $10/mo Starter plan for a client site
- Maintenance: none
- **`assets/js/instagram-feed.js` already implements this.** Set `CONFIG.FEED_URL`
  and it works.

### Option B — Graph API + scheduled job into Firestore

This project already uses Firestore for the Te Koop CMS, so the pieces exist.

```
Scheduled Cloud Function (e.g. daily)
  → GET https://graph.instagram.com/<version>/me/media
        ?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp
        &access_token=<long-lived token from Secret Manager>
  → write the posts to a Firestore collection (e.g. instagram_posts)
  → gallery page reads that collection (public read, same as cars/)
```

Plus a second scheduled function, monthly, calling `refresh_access_token`
(see §4) and writing the new token back to Secret Manager.

- Token never reaches the browser; the browser only ever sees Firestore rows
- Survives Instagram outages, since the last successful copy stays cached
- **Requires the Firebase Blaze plan.** Cloud Functions and Cloud Scheduler are
  not available on the free Spark plan. Usage at this volume is pennies, but it
  requires a billing account.
- Meaningfully more work than Option A, and the refresh job is a permanent
  operational dependency — if it fails silently, the feed dies 60 days later.

### Option C — Manual curation

Keep the current static grid and update it periodically. Zero infrastructure.
Worth naming explicitly, because it is what the old site did and the client was
apparently satisfied with it.

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

**Media endpoint:** `GET https://graph.instagram.com/<version>/me/media`.
Confirm the current API version and the exact field list against the Instagram
Platform API Reference at build time; Meta reorganises these pages often and
field availability varies by media type (`thumbnail_url` is only present on
video, and carousels require the `children` edge).

## 5. The code contract

`assets/js/instagram-feed.js` renders into `#ig-grid` on `galerij.html` and hides
`#gallery-fallback` on success. It accepts either a bare array or `{ posts: [...] }`,
and reads per post:

| Field | Source tried, in order |
|---|---|
| image | `sizes.medium.mediaUrl` → `mediaUrl` → `thumbnailUrl` → `media_url` |
| link | `permalink` → profile URL |
| alt text | first line of `caption`, truncated to 120 chars |

On any failure — no URL configured, network error, empty feed, no usable media —
it leaves the static grid visible and logs a warning. The gallery never breaks.

For Option B, have the Cloud Function write documents in that shape and point
`FEED_URL` at the Firestore read, or swap the `fetch` for the Firestore SDK; the
rendering half needs no changes.

## 6. Recommendation

Option A. It satisfies the client's request, costs nothing, keeps secrets out of
the repo, and has no recurring failure mode. Option B is only worth its
complexity if the feed must be filtered or reshaped server-side, or if the
Firestore dependency is wanted for other reasons.

Whichever is chosen, settle the `@carrez_customs` / `@_prestige_automotive`
question first.
