# Pawlo — Google Play Store listing copy

> Paste each section into the corresponding field on Play Console → Store
> presence → Main store listing. Field limits are noted in the headings.

---

## App name (≤30 characters)

```
Pawlo: Dog Training & Care
```

(26 chars)

**Why this name:** "Training" is the highest-intent search keyword on the
Play Store; "Care" deliberately broadens the surface to cover walks, health,
vaccinations, medications, and tricks (all of which the app does). Brand
("Pawlo") is up front so the listing is recognisable in search results and
ad creatives. Picked over "Dog Training & Tricks" because the latter
under-sold the walks + health half of the app.

**Alternates kept on file for future iterations:**

- `Pawlo: Train, Walk & Care` (25) — verb-led
- `Pawlo: Dog Trainer & Walker` (27) — direct, action-led
- `Pawlo — Your Dog's AI Coach` (27) — premium framing
- `Pawlo: AI Dog Coach & Tracker` (30) — keyword-stuffed

---

## Short description (≤80 characters)

```
Your dog's personal teacher. Bite-size daily training. Real progress.
```

(69 chars)

**Alternates:**

- `Like Duolingo, but for dogs. 5 min a day. A better dog forever.` (62)
- `Train your dog with daily games, tricks, and instant AI feedback.` (65)
- `The friendly, gamified dog training coach in your pocket.` (57)

---

## Full description (≤4000 characters)

```
Meet Pawlo — the warm, persistent teacher every dog deserves.

Pawlo is a gamified dog training app built around the idea that 5 minutes a day, every day, will turn any dog into the best version of themselves. Bite-size lessons. Instant feedback from your AI coach. Real progress you can see.

Whether you've just brought home a curious puppy or you're trying to fix that one stubborn habit, Pawlo gives you a clear plan, gentle daily nudges, and a mascot that genuinely cares.


🐾  WHY DOG OWNERS LOVE PAWLO

•  Daily 5-minute sessions that actually fit into your life
•  Step-by-step training programs designed by real positive-reinforcement methods
•  An AI training advisor that answers your questions in plain English, 24/7
•  XP, levels, streaks, and badges that keep you (and your dog) coming back
•  A library of 12 essential tricks — from "sit" and "paw" all the way to "spin" and "play dead"
•  Walks with GPS, distance, and route tracking
•  Health logbook for weight, vaccinations, and medications
•  Beautiful, calm dark interface that's easy on the eyes


🎓  TRAINING PROGRAMS INCLUDED

•  Separation Anxiety — 21 day plan
•  Loose-Leash Walking — 14 day plan
•  Recall Training — 10 day plan
•  Potty Training — 7 day plan

Start one program for free. Unlock the rest with Pawlo Pro.


🤖  MEET YOUR AI COACH

Pawlo (the mascot AND the AI character) listens to what's happening with your dog and replies with kind, specific guidance. Stuck on a step? Frustrated? Curious why your dog keeps spinning? Just ask. Pawlo is patient, encouraging, and always there.


🏆  GAMIFICATION THAT WORKS

Every session you finish earns XP. Every day you train extends your streak. Every milestone unlocks a badge. Six levels — from Curious Pup all the way to Top Dog. It's training that feels like a game, because the best teachers know how to make learning fun.


🛡️  PRIVACY-FIRST, AD-FREE

Pawlo is built by one independent developer who hates ads as much as you do. We don't run ad SDKs. We don't sell your data. We don't track you across the web. We collect only what's needed to teach your dog, and you can delete everything with one tap.

Read our full privacy policy at pawlo.so/privacy.


💛  PAWLO PRO

Pawlo is free forever. Pawlo Pro (£4.99/month, auto-renews until cancelled) unlocks:
•  All 4 training programs
•  All 12 tricks
•  Unlimited Pawlo AI chats
•  Future Pro features as we ship them

Cancel anytime in your Google Play subscription settings. Subscription terms in-app and at pawlo.so/terms.


🌍  BUILT FOR REAL DOGS, REAL HUMANS

Pawlo is a small, independent project. Every feature exists because a dog owner asked for it. Every training step has been tested by real dogs. If something doesn't work for you, email hello@pawlo.so — a real human will reply.

Your dog deserves a great teacher. Pawlo is here for both of you. 🐾
```

(~3,200 chars — well under the 4,000 limit)

---

## Promo text (Google Play "What's new" – first release)

> Field limit: 500 chars

```
Welcome to Pawlo 1.0 — the friendly AI training coach for your dog. Daily bite-size sessions. Step-by-step programs for separation anxiety, leash walking, recall, and potty training. A 12-trick library. GPS walks. Health logbook. XP, levels, streaks, badges. And Pawlo, your AI advisor, always one tap away. 5 minutes a day. A better dog forever. 🐾
```

(353 chars)

---

## Categorisation

| Field | Value |
|---|---|
| Application type | App |
| Category | Lifestyle (primary) |
| Tags (up to 5) | dog training, puppy, pets, lifestyle, gamified learning |
| Email | hello@pawlo.so |
| Website | https://pawlo.so |
| Privacy policy | https://pawlo.so/privacy |
| Phone | (optional, leave blank) |

---

## Graphic assets checklist

| Asset | Required size | Status |
|---|---|---|
| App icon | 512 × 512 PNG (auto from in-app icon) | ✓ have 1024×1024 source |
| Feature graphic | 1024 × 500 JPG/PNG | ⚠️ to design |
| Phone screenshots (2-8) | 16:9 or 9:16, min 320px | ⚠️ to capture (see screenshot script) |
| 7" tablet screenshots (optional) | 16:9 or 9:16 | skip for v1 |
| 10" tablet screenshots (optional) | 16:9 or 9:16 | skip for v1 |
| Promo video (optional) | YouTube URL | skip for v1 |

---

## Content rating questionnaire (IARC)

Likely outcome: **PEGI 3 / Everyone**.

Suggested answers:

| Question | Answer |
|---|---|
| Violence | None |
| Sexual content | None |
| Profanity | None |
| Controlled substances | None |
| Gambling | None |
| User-generated content | None (advisor chats are private and not shared) |
| Shares user location | Yes — only during active walk sessions, foreground only |
| Allows users to interact | No (no social features in v1) |
| Data sharing | See Data Safety form |

---

## Target audience and content

| Field | Value |
|---|---|
| Target age group | 13+ |
| Appeals to children? | No |
| Ads in app? | No |

---

## Notes for the launch

- The "Duolingo for dogs" tagline is part of the brand voice but **don't use the word "Duolingo" in the listing copy** — Google's policy bans naming competitors directly. Use "gamified", "bite-size", "5 minutes a day" instead.
- Keep the £4.99/month price visible in the listing (subscription transparency is a Play Console requirement).
- The privacy policy URL must be live before submission. Privacy policy is at `web/privacy.html` → deploy via Cloudflare Pages.
- The Terms URL is referenced from the in-app paywall and from the privacy policy footer. Same deploy.
