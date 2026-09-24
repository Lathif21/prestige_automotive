# Connecting the Instagram feed to the gallery

For: the owner of the Prestige Automotive Instagram account.
Goal: have the gallery page automatically show the most recent Instagram posts.

You don't need to write any code. Everything below happens in the Instagram app
and on Meta's website. At the end you hand one piece of information to your web
developer.

---

## Read this first

**1. This only works with a professional account.**
A private account cannot be read through the API. Switching to Business or
Creator is free and changes nothing about your posts or followers.

**2. Access expires every 60 days.**
Meta does not issue permanent keys. A key is valid for 60 days and has to be
renewed before then. If it isn't, the feed stops and the whole procedure has to
be repeated. Agree up front with your web developer on who handles that renewal
— see **Step 6**.

**3. There is a simpler alternative.**
A feed service such as Behold takes over steps 2 through 6 entirely, including
renewing the key. For most businesses that is the better choice. See
**Alternative** at the bottom.

---

## Step 1 — Switch Instagram to a professional account

1. Open the Instagram app → your profile → menu (☰) → **Settings**.
2. Go to **Account type and tools** → **Switch to professional account**.
3. Choose **Business** and complete the steps.

Then confirm which account is actually being used. The website currently points
to **@_prestige_automotive**. The old website pointed to a different account
(@carrez_customs) — confirm with your web developer which of the two should feed
the gallery.

## Step 2 — Create a Meta app

1. Go to https://developers.facebook.com and sign in with your Facebook account.
2. Click **My Apps** at the top right → **Create App**.
3. Give the app a name (e.g. `Prestige Automotive Website`) and enter your email address.
4. Choose **Other** as the app type, then **Business**.

## Step 3 — Add Instagram to the app

1. In the app, click **Add Product** and choose **Instagram**.
2. Select **Instagram API with Instagram Login** — *not* the Facebook Login
   variant, which additionally requires a linked Facebook Page.
3. Note down the **Instagram App ID** and the **Instagram App Secret**. Treat
   that secret like a password: never send it by email or WhatsApp.

## Step 4 — Grant the app access to your account

1. Go to **Instagram → API setup with Instagram login**.
2. Under **Business login settings**, add a valid redirect URL (your web
   developer will give you this).
3. Complete the login flow and grant the **`instagram_business_basic`**
   permission. Nothing more is needed for a gallery — that permission only
   allows *reading*, not posting or replying.

## Step 5 — Exchange the key for a long-lived one

The key you receive in step 4 is valid for only **1 hour** and can be used once.
It has to be exchanged for a **60-day** key:

```
GET https://graph.instagram.com/access_token
      ?grant_type=ig_exchange_token
      &client_secret=YOUR_APP_SECRET
      &access_token=THE_ONE_HOUR_KEY
```

This is a technical step — have your web developer run it, or paste the request
into the Graph API Explorer in the Meta dashboard.

## Step 6 — Agree on the renewal

The 60-day key has to be renewed before day 60:

```
GET https://graph.instagram.com/refresh_access_token
      ?grant_type=ig_refresh_token
      &access_token=THE_CURRENT_KEY
```

Conditions: the key is at least 24 hours old and has not yet expired. **A key
that has not been renewed for 60 days is permanently dead**, and you start again
from step 4.

This is why this approach carries ongoing maintenance. Decide who owns it:

- **your web developer**, with an automated job that runs monthly, or
- **a feed service**, which takes it over completely (see below).

Either way, put a reminder in the calendar for day 45 as long as it isn't
automated.

---

## Alternative: a feed service (recommended)

Services such as **Behold** (https://behold.so), LightWidget or SnapWidget
handle steps 2 through 6 for you, including renewing the key. You connect your
Instagram account once and get a permanent link to your feed.

1. Create an account at https://behold.so.

   Check the plan before you commit. The free plan is limited to **6 posts per
   feed**, **1,200 page views per month**, and shows a **Behold logo on hover**.
   For a business site that usually means the $10/month Starter plan; confirm
   the current limits at https://behold.so/pricing/.
2. Connect the Prestige Automotive Instagram account.
3. Create a feed and copy the **feed URL**.
4. Send that URL to your web developer.

You then have no app secret, no key and no expiry date to track. The website is
already prepared for this: only one line needs to be filled in.

---

## What you need to hand over

Depending on the route chosen:

| Route | What you hand over |
|---|---|
| Feed service (recommended) | The feed URL |
| Graph API | App ID, App Secret and the long-lived key — via a password manager, not by email |

Until one of the two is filled in, the gallery keeps showing the current fixed
photos. The page therefore always works.
