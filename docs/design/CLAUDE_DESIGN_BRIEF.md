# QuizPulse — Design Overhaul Reference

*Standalone brief for design consultation. No repo access needed to read this.*

## What it is

QuizPulse is a **PWA-first formative assessment tool for K–12 teachers**. A teacher builds a
short multiple-choice quiz, sends it via real browser push notification (no app install, no link
sharing) to their class, students tap the notification and answer on their phone, and the teacher
watches live analytics as responses come in — including a "confidence" layer (sure / pretty sure /
guessing) that surfaces *confidently wrong* answers as a misconception signal, not just raw
correctness.

Two user types, two very different UI needs:
- **Teacher** — signed-in, desktop-or-tablet-leaning, data-dense screens (analytics, quiz
  builder, class rosters, admin).
- **Student** — anonymous (device-UUID identity, no login), phone-only, single-purpose screens
  (join a class, take a quiz, see a class home).

There's also a small internal **admin portal** (owner/support roles — school validation, traffic
monitoring, logs) — lowest design priority, "bare/functional" is fine there today.

## Current visual language (what exists, likely what's being overhauled)

- Plain inline styles, no CSS framework, no component library. React + Vite SPA.
- Color use today is ad hoc per-page rather than a defined system. Recurring hex values seen
  across the codebase (i.e. today's *de facto* palette, not a deliberate one):
  - Red/error/misconception accent: `#c0392b`, `#A32D2D`, `#B5482E` (terracotta — used
    specifically for the "confidently wrong" misconception accent), backgrounds `#fdecea`,
    `#FBEDE8`
  - Green/success/positive: `#085041`, `#1a7a5e`, `#3B6D11`, background `#E1F5EE`, `#EAF3DE`
  - Purple (feature-intro / promo cards): `#3C3489`, `#EEEDFE`
  - Blue (info): `#2C6BAA`, `#E6F1FB`
  - Neutrals: `#1a1a1a` (text), `#e0e0e0`/`#f0f0f0`/`#f8f8f8`/`#fafafa`/`#f5f5f5` (borders/bg),
    `#b3b3b3` (muted)
  - Brown/tan accent: `#5A2416`, `#7A3B28`
- No dark mode.
- Mobile breakpoint convention: **1024px** is the dominant breakpoint (not 768px) — student
  surfaces and mobile-collapsed teacher panes both key off this.
- No emoji in UI copy or icons — treated as an anti-pattern ("AI slop") in this codebase; numbered
  circles / plain checkmarks used instead of decorative icons for progress indicators.
- Copy rule: **zero technical jargon** in anything a teacher or student reads — no "push
  notification," "service worker," "endpoint," "Azure," cloud/infra terms of any kind. Plain
  language only ("notification," "something went wrong").

## Key existing screens/flows a redesign would touch

**Teacher side:**
- Home (dashboard) — Getting Started checklist for new teachers, feature-intro promo cards
  (one promoted element per page, never stacked)
- Onboarding — 1-step required (school name) + optional 5-step profile wizard
- Build Quiz / Question Bank — question creation, quiz assembly
- Send Quiz — pick class(es), duration, optional schedule, optional topic tag
- Analytics — per-quiz results: a "four-cell" chart (correct/incorrect × confident/unsure),
  a promoted "misconception hero card," per-option answer-distribution bars, class drill-down
- Population — "you vs. norm" comparison against a benchmark dataset
- Evidence export — a professional-teacher-facing PDF export flow (VIT/APST evidence — Australian
  teacher accreditation), two-screen inline flow
- Classes / Roster — CRUD + join-request approval UI, demo-class variant (simulated students)
- AI quiz generation — document upload → draft review/approve screen
- First-run finale — a guided "try it now" activation flow for brand-new teachers (staged loader
  → payoff screen with a demo class's simulated results)

**Student side (phone-first, minimal chrome):**
- Join class (join code entry, name)
- Take quiz (question + 3-option confidence selector + optional timer)
- Class home (persistent post-approval landing: quiz cards — open/closed/answered, empty state)
- Completion screen (random encouragement line — participation-focused, never
  score/cleverness-framed copy)

## Design constraints that matter for any overhaul

- **Accessibility:** the four-cell analytics chart currently uses a persistent always-visible
  legend + counts (never hover-only, never hue-only) — that constraint should carry forward for
  any chart/data-viz redesign.
- **No dependency on correctness/score for anything student-facing engagement-related** — the
  product philosophy is participation-first, not gamified competition (no leaderboards, no rarity,
  no comparative display between students). Relevant if the overhaul touches student motivation
  UI at all.
- **One promotional/nudge element visible per page** — cards competing for attention is explicitly
  something this product has avoided.
- Plain JS, inline styles, no CSS-in-JS library, no component library currently in use — worth
  stating up front since a design system handoff will likely want to introduce real tokens/
  components, which is a legitimate overhaul target, not something to preserve.

## What I'm looking for from this consultation

(Fill in your specific ask here — e.g. "a real color/type/spacing system to replace the ad hoc
inline styles," "a componentized design system," "a fresh visual identity," etc. — before sending
this to Claude Design.)
