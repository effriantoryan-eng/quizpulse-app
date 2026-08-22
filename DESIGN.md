# QuizPulse — Design system (v4.7.0, Modernist)

This is a **remap**, not a new system. The app already had a 2px-border brutalist token system
(`src/index.css`, 600+ `var()` call sites across `src/`). v4.7.0 changes the token *values* to the
Modernist palette/type — every existing tokenized screen restyles for free, zero per-screen edits.

Hard rules: **light-only** (no dark mode), **1024px** is the mobile breakpoint, **no emoji**,
**no technical jargon** in user-facing copy (see CLAUDE.md's coding-conventions section).

## Tokens (`src/index.css` `:root`)

Same variable names as before v4.7.0 — only values changed:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f3f2f2` | page background |
| `--surface` | `#ffffff` | cards, inputs |
| `--surface2` | `#eae9e9` | secondary fill |
| `--border` / `--text` | `#201e1d` | ink |
| `--muted` | `#7d7979` | secondary text |
| `--primary` | `#ec3013` | the one accent — buttons, links, active nav, misconception |
| `--primaryInk` | `#ffffff` | text on `--primary` |
| `--bw` | `2px` | the border weight used everywhere (unchanged) |
| `--radius` / `--radiusSm` / `--chipRadius` | `0px` | sharp corners, no rounding, anywhere |
| `--shadow` / `--shadowField` / `--btnShadow` | `none` | flat Modernist frames — no drop shadows |
| `--ok` / `--okBg` | `#3b6d11` / `#eaf3de` | success (unchanged hue family) |
| `--danger` / `--dangerBg` | `#ae1800` / `#ffe0d9` | errors |
| `--sans` / `--heading` | `'Archivo', …` | one typeface for everything |

## Type

Archivo, self-hosted (`public/fonts/archivo-variable.woff2` — one variable-font file backs weights
400/600/700/800 via four `@font-face` blocks; this is how Google Fonts itself serves it). Latin
subset only. `font-display: swap`.

- Labels: 10px, uppercase, `letter-spacing: 0.18em`
- Body: 13–17px
- Display/headings: 20–52px (`h1` 46px desktop / 34px <1024px, `h2` 28px/22px, `h3` 20px)
- Numbers that need to line up (counts, response tallies): `font-variant-numeric: tabular-nums`

## Borders, radius, shadow

`--bw` (2px) solid `--border` on every card/button/input. `--radius` is `0` everywhere — never
round a corner. No box-shadow anywhere in the restyled surfaces (`--shadow*` tokens are `none`) —
structure comes from the 2px rules, not elevation.

## Component classes (`src/index.css`, alongside the existing `.bp-*` set)

| Class | What |
|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-block` | buttons |
| `.tag`, `.tag-neutral`, `.tag-accent` | small labels |
| `.field`, `.input` | form fields |
| `.seg`, `.seg-opt` (`.active` on the selected option) | segmented control (e.g. week/month) |
| `.table` | data tables |

The older `.bp-*` classes (`.bp-card`, `.bp-btn`, `.bp-chip`, `.bp-label`) are untouched and inherit
the new palette automatically since they reference the same `var()` tokens.

## Scope of this pass

Not every hardcoded hex in the repo was swept — only the screens v4.7.0 touches (Home, Analytics,
student flow) plus `src/data/fourCell.js` (the misconception chart colors were hardcoded, not
`var()`, so the free restyle didn't reach them). ~339 hardcoded hex values exist repo-wide;
sweeping all of them is out of scope for this sprint — a future pass can migrate the rest opportunistically.
