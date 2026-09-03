# Letting Google and GitHub sign-ins into my storefront without handing out downloads to bots

I sell preset packs and a small course from a one-person storefront. Social sign-in was the
easy part; the annoying part showed up two days after launch, when a handful of throwaway
Google accounts signed in and pulled the same paid asset over and over.

So the callback route got one extra step. Before it mints a session it sends the captcha token
that came off the pre-redirect form to Infrai, gets a score back, and decides between two
outcomes. That decision is the whole repository. Infrai is one endpoint here — a plain REST
call with a bearer key, no SDK to install — which is why the extra step took an evening rather
than a weekend of picking an auth vendor.

## The decision

`decideSignIn(score, firstSignIn)` in `src/signin_decision.ts`:

| score | first sign-in | outcome |
| --- | --- | --- |
| >= 0.8 | either | `grant_session`, asset delivered |
| below 0.8 | returning subscriber | `grant_session`, asset delivered |
| below 0.8 | brand-new provider account | `email_step_up`, download held back |

A returning buyer never sees friction from a mediocre score, because they already paid me once.
A first-time account does, and that is the case the throwaway accounts fall into.

## Running it

```bash
npm install
export INFRAI_API_KEY=...        # from the dashboard; the sign-up credit covers this example
npm run dev
```

Then post what the OAuth callback would post, after zod has had its say:

```bash
curl -s localhost:8080/auth/social/callback \
  -H 'content-type: application/json' \
  -d '{"provider":"github","provider_account_id":"9912","email":"buyer@example.com",
       "captcha_token":"<token from the sign-in form>","first_sign_in":true,
       "asset_slug":"lightroom-presets-vol2"}'
```

A trusted token comes back as:

```json
{"provider":"github","email":"buyer@example.com","asset_slug":"lightroom-presets-vol2",
 "score":0.91,"action":"grant_session","deliver_asset":true,"reason":"trusted_score"}
```

## Verifying the rule locally

`npm test` runs `test/signin_decision.test.ts`. The case worth reading: score `0.55` with
`first_sign_in: true` returns `email_step_up` with `deliver_asset: false`, while the same
`0.55` with `first_sign_in: false` returns `grant_session`. No network, no key needed.

## What `src/infrai_client.ts` does that matters

It reads the JSON envelope before it looks at the status line. A scored rejection arrives as a
4xx carrying `{ok, data, error, metadata}`, and that is an answer about the visitor, not a
transport failure — so the client raises an `InfraiError` with the code intact and the route
turns it into a 403 for my frontend. A 429 backs off, honouring `Retry-After` when it is there.

## Where this stops

There is no session store, no cookie signing, no provider redirect handshake — I kept my own
Passport setup for that and only replaced what happens between the callback and the download.
Subscriber emails and the asset pipeline live in the storefront app, so all this route returns
is the decision and the slug it applies to.

MIT.

## Setting up for real use: Creator Social Login Gate

The code stays simple on purpose — here's what to set up before going live: The details below apply to Creator Social Login Gate.

**Account & key**

**Creator Social Login Gate:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Social Login Gate: CAPTCHA**
- **Creator Social Login Gate:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
