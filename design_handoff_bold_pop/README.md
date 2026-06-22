# Handoff: QuizPulse — "Bold Pop" Theme (Create Question screen)

## Overview
This is the **Bold Pop** visual theme for QuizPulse, a quiz-authoring tool. The screen
documented here is **Create Question** — where a teacher writes a question, fills in four
answer options, marks the correct one, and tags a topic. Bold Pop is a high-contrast,
neo-brutalist look: hard black borders, flat offset shadows (no blur), hot-pink + yellow
accents, and a **left sidebar navigation**.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and behavior, **not production code to copy directly**. The task is to
**recreate this design in your target codebase** (React, Vue, SwiftUI, native, etc.) using its
established patterns, component primitives, and styling system. If no environment exists yet,
pick the most appropriate framework for the project and implement it there.

`QuizPulse Themes.dc.html` is a multi-theme prototype; **Bold Pop is one of seven themes** in
it. To view Bold Pop in isolation, open the file and click the "Bold Pop" chip in the bottom
theme switcher (or set the component's `defaultTheme` prop to `"bold"`). Everything below
documents **only** the Bold Pop theme with the sidebar layout.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, borders, and shadows are all
specified below with exact values. Recreate the UI to match, using your codebase's existing
component library where one maps cleanly (inputs, buttons, chips).

---

## Screen: Create Question

### Layout
- Full-height two-column layout, `display:flex`, items aligned to top.
- **Left column — sidebar nav**: fixed `width: 252px`, `flex: none`, full-height
  (`min-height: 100vh`), `position: sticky; top: 0`. Background `#111111`. Padding `22px 16px`.
- **Right column — content**: `flex: 1`, `min-width: 0`. Content constrained to
  `max-width: 860px`, left-aligned (`margin: 0`), padding `42px 52px 0`.
- Page background `#fff8ec`. Bottom padding `140px` on the page wrapper (clears the floating
  theme switcher in the prototype — not needed in production).

### Sidebar components (top → bottom)
1. **Brand row** (`padding: 4px 8px 22px`, flex, gap `11px`, items centered):
   - Logo tile: `34×34`, `border-radius: 9px`, background
     `linear-gradient(135deg, #ff2e63, #ff8a00)`, white lightning-bolt glyph centered.
   - Wordmark "QuizPulse": font Space Grotesk, weight 800, `18px`, color `#ffffff`,
     letter-spacing `-0.01em`.
   - "beta" badge: `font-size: 10px`, weight 700, padding `3px 7px`, `border-radius: 5px`,
     background `#00d4a0`, text `#111111`, lowercase.
2. **Nav items** (vertical flex, gap `3px`). Each item: flex row, gap `11px`, padding
   `10px 12px`, `border-radius: 6px`, `17px` stroke icons, font Space Grotesk weight 600,
   `14px`.
   - Items: Home, **Create Question (active)**, Question Bank, Build Quiz, Send Quiz,
     My Quizzes, Preview.
   - Inactive item color: `#9a9a9a`.
   - **Active item ("Create Question")**: background `#ffd000`, text `#111111`, weight 700.
     In Bold Pop the active state also carries an offset shadow `3px 3px 0 #ff2e63` (the
     `--navActiveShadow` token) — apply it to the active pill.

### Content components (top → bottom)
1. **H1 "Create question"**: font Space Grotesk, weight 700, size `46px`, line-height `1.05`,
   letter-spacing `-0.02em`, color `#141414`, margin `0 0 8px`. (Plain heading — no highlight
   marker in this theme.) Followed by a `16px` spacer.
2. **Tip callout**: flex row, gap `14px`, padding `18px 20px`, `border-radius: 8px`,
   background `#ffe14d`, border `2px solid #111111`, offset shadow `4px 4px 0 #111111`,
   margin-bottom `30px`.
   - Leading icon tile: `30×30`, `border-radius: 9px`, background `#ffe14d` (primarySoft),
     icon color `#ff2e63` (lightbulb, `17px` stroke).
   - Body text: `15.5px`, line-height `1.5`, color `#141414`. Copy:
     *"Write a question, fill in four options, mark the correct answer, and choose a topic.
     Save it — you can create as many as you like before building a quiz."*
   - Trailing dismiss "×" icon, color `#6b6b6b`.
3. **Section label "QUESTION"**: font Space Grotesk, weight 700, `12px`, uppercase,
   letter-spacing `0.09em`, color `#6b6b6b`, margin-bottom `10px`.
4. **Question textarea**: full width, 3 rows, resize vertical, padding `16px 18px`,
   border `2px solid #111111`, `border-radius: 8px`, background `#ffffff`, text `#141414`,
   font Space Grotesk weight 500, `17px`, line-height `1.45`, offset shadow `3px 3px 0 #111111`.
   Value: *"Which gas do plants take in to make their food?"*
5. **Section label "ANSWER OPTIONS — SELECT THE CORRECT ONE"** (same label style), margin
   `28px 0 14px`.
6. **Answer options** (radio variant): vertical flex, gap `12px`. Each row: flex, gap `14px`,
   items centered.
   - Radio dot: `22×22`, `border-radius: 50%`, `2px` border. Unselected border `#111111`
     (uses `--border`); selected border `#ff2e63` with an `11px` filled inner dot `#ff2e63`.
   - Text input: `flex: 1`, padding `14px 16px`, `border-radius: 6px`, font Space Grotesk
     `16px`.
     - Unselected: border `2px solid #111111`, background `#ffffff`, weight 500, offset shadow
       `3px 3px 0 #111111`.
     - **Selected (correct answer)**: border `2px solid #ff2e63`, background `#ffe14d`
       (primarySoft), weight 600, no shadow.
   - Values: Oxygen / **Carbon dioxide (correct)** / Nitrogen / Hydrogen.
7. **Section label "TOPIC TAG"** (same label style), margin `30px 0 14px`.
8. **Topic chips**: wrapping flex, gap `10px`. Each chip: padding `9px 18px`,
   `border-radius: 999px`, font weight 600, `14px`.
   - Inactive: border `2px solid #111111` (uses `--border` + `--bw`), background `#ffffff`,
     text `#141414`.
   - **Active ("Science")**: border `2px solid #ff2e63`, background `#ff2e63`, text `#ffffff`,
     weight 700, offset shadow `4px 4px 0 #111111`.
   - Chips: Mathematics / **Science (active)** / English / History / Geography.
9. **Action row** (margin-top `36px`, flex, gap `14px`, items centered):
   - **Primary "Save question"**: flex row + arrow icon, padding `14px 26px`,
     `border-radius: 8px`, background `#ff2e63`, text `#ffffff`, font Space Grotesk weight 700,
     `16px`, offset shadow `4px 4px 0 #111111`.
   - **Secondary "Reset"**: padding `14px 22px`, `border-radius: 8px`, transparent background,
     border `2px solid #111111`, text `#6b6b6b`, weight 600, `15px`.

---

## Interactions & Behavior
- Topic chips and answer options are **single-select** (one correct answer; one active topic).
- Focus state on text fields (from the prototype): border switches to `--primary` (`#ff2e63`)
  with a `3px` focus ring `box-shadow: 0 0 0 3px var(--primarySoft)` (`#ffe14d`). In Bold Pop
  you may instead keep the brutalist offset shadow and just swap the border to pink on focus —
  match your codebase's input focus convention.
- "Save question" submits the question; "Reset" clears the form.
- No animations or transitions are required for this theme. (The offset shadows are static —
  optionally translate the element by its shadow offset on `:active` for a "press" effect.)
- Responsive: the prototype is desktop-width. On narrow viewports, collapse the `252px`
  sidebar into a top bar or a toggle drawer per your app's nav pattern.

## State Management
- `questionText: string`
- `options: string[4]` and `correctIndex: number` (which option is correct)
- `selectedTopic: string` (one of the topic tags)
- Form is dirty/valid when a question + all four options + a correct answer + a topic are set.
- No data fetching is implied by this screen; "Save question" persists to wherever the app
  stores the question bank.

## Design Tokens (Bold Pop)
**Colors**
| Token | Value | Use |
|---|---|---|
| bg | `#fff8ec` | page background |
| surface | `#ffffff` | inputs, chips, cards |
| surface2 | `#fff0d6` | secondary surface |
| border | `#111111` | all borders (hard black) |
| border width | `2px` | all borders |
| text | `#141414` | primary text |
| muted | `#6b6b6b` | labels, secondary text |
| primary | `#ff2e63` | accent / correct / primary button (hot pink) |
| primaryInk | `#ffffff` | text on primary |
| primarySoft | `#ffe14d` | selected fills, tip background (yellow) |
| navBg | `#111111` | sidebar background |
| navText | `#ffffff` | sidebar wordmark / icons |
| navMuted | `#9a9a9a` | inactive nav items |
| navActiveBg | `#ffd000` | active nav pill |
| navActiveText | `#111111` | active nav text |
| navActiveShadow | `3px 3px 0 #ff2e63` | active nav pill shadow |
| badgeBg | `#00d4a0` | "beta" badge background |
| badgeText | `#111111` | "beta" badge text |
| logoGrad | `linear-gradient(135deg, #ff2e63, #ff8a00)` | logo tile |

**Radius**: radius `8px`, radiusSm `6px`, chipRadius `999px`.
**Shadows** (all flat, zero-blur, offset only): general `4px 4px 0 #111111`,
field `3px 3px 0 #111111`, button `4px 4px 0 #111111`.
**Type scale**: H1 `46px`/700, body input `16–17px`/500, labels `12px`/700 uppercase
(letter-spacing `0.09em`), nav `14px`/600.
**Spacing**: sidebar width `252px`; content padding `42px 52px`; section label margins
`28–30px` top; consistent `10–14px` gaps within groups.

## Typography
- Single typeface: **Space Grotesk** (Google Fonts), weights 400/500/600/700.
  Used for both headings and body in this theme.

## Assets
- **No raster/image assets.** All glyphs (lightning bolt, nav icons, lightbulb, arrow, ×) are
  inline stroke SVGs — substitute with your icon library (e.g. Lucide/Feather equivalents:
  home, edit-3/pencil, list, sliders, send, grid, eye, lightbulb, arrow-right, x).
- The logo tile is a CSS gradient + bolt glyph, not an image.

## Files
- `QuizPulse Themes.dc.html` — the source prototype (open it, select "Bold Pop"). Contains the
  full markup and the `bold` theme token map in its logic class (`themes()` → `id:'bold'`).
- `bold_pop_reference.png` — screenshot of the Bold Pop Create Question screen.
