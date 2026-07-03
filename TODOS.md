
## Design debt — v4.0.0 Analytics (from /plan-design-review 2026-07-03)

- [ ] **Screen-reader ARIA for the four-cell segmented chart** — add role + aria-label so SR users
  hear the four counts (correct-confident / correct-unsure / incorrect-confident / incorrect-unsure)
  per question. D4's visible legend + counts cover sighted low-vision users; this covers SR users.
  Blocked by: v4.0.0 chart shipping. File: src/pages/teacher/Analytics.jsx.

## Ponytail debt (from /ponytail-debt 2026-07-04)

Three `ponytail:` markers found, none naming a ceiling/upgrade trigger — tighten or drop the prefix:

- [ ] `api/analytics.js:85` — a device approved in two target classes counts once (dedup via `Map`)
  rather than surfacing as a cross-class overlap case. No revisit condition named.
- [ ] `api/responses.js:154` — replaces a prior SELECT-then-create pattern that had a race window.
  Doesn't say what's still unhandled or when to revisit.
- [ ] `api/subscribe.js:49` — SSRF guard restricts push-subscription endpoints to `https://` only.
  No note on what a fuller guard (private-IP/allowlist checks) would look like or when it's needed.
