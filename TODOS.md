
## Design debt — v4.0.0 Analytics (from /plan-design-review 2026-07-03)

- [ ] **Screen-reader ARIA for the four-cell segmented chart** — add role + aria-label so SR users
  hear the four counts (correct-confident / correct-unsure / incorrect-confident / incorrect-unsure)
  per question. D4's visible legend + counts cover sighted low-vision users; this covers SR users.
  Blocked by: v4.0.0 chart shipping. File: src/pages/teacher/Analytics.jsx.
