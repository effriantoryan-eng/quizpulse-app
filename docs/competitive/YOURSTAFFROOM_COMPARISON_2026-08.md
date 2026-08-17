# Competitive Analysis — Your Staff Room vs QuizPulse

**Date:** 2026-08-03
**Method:** Live site walk of `yourstaffroom.com.au` (all 34 pages + blog fetched and verified HTTP 200), free-account login, one real Lesson Builder generation run, source/network inspection, plus a walk of the related Payhip storefront (The Pedagogy Project). No payment made, no Inner Sanctum access — paid-tier internals are inferred from marketing copy and page scaffolding only.

---

## 1. Executive summary

**Your Staff Room (YSR)** is a broad AI teacher-productivity suite for Australian K–12 educators: ~20 tools that generate documents (lesson plans, reports, behaviour plans, compliance paperwork) plus curated content banks. It is built by a single Australian teacher, runs on a lightweight static-site stack, and monetises at $12/mo individual or $2,500–7,500/yr per school.

**QuizPulse** is a deep single-loop product: push-first formative assessment — teacher sends a quiz as a real push notification, students answer with confidence ratings, teacher gets live misconception analytics.

**They overlap on exactly one screen** (YSR's thin `student.html` exit-ticket page), and even there the overlap is shallow. YSR is prospective (generates what a teacher *plans to do*); QuizPulse is retrospective (evidences what students *actually did*). The products are orthogonal, not head-to-head — but YSR validates several market assumptions QuizPulse depends on, and its pricing, compliance framing, and school-network warning are directly actionable intelligence.

**Verdict: not a direct competitor today. It is (a) a pricing/positioning benchmark, (b) proof the compliance-evidence wedge sells, and (c) a warning about school firewalls — with one watch-item: their student loop could grow.**

---

## 2. Site inventory (verified live)

All pages returned HTTP 200. Page-weight figures are raw HTML size — the site is hand-authored static HTML with inline JS, one file per tool.

### Teacher AI generators (12)
| Tool | Notes |
|---|---|
| Lesson Builder | Flagship. 282 KB page. Streaming generation. Free 1/day no account |
| Term Planner | Full-term sequences, spaced retrieval baked in. 237 KB |
| Report Writer | 3 comment options/student, K–12 all KLAs. 176 KB |
| Parent Communication | Concern / celebration / conference modes |
| Educator Wellbeing | Compassion-fatigue check-in (Figley, Stamm, Neff). Never stored |
| Learner Profile | OT + Speech Path + Ed Psych lens on a described student. 138 KB |
| Behaviour Support | PBS, Ross Greene CPS, polyvagal framing. 246 KB |
| Social Story Builder | Carol Gray framework, OT/SP implementation notes |
| ILP Builder | Individual Learning Plans |
| PLP Builder | Aboriginal & Torres Strait Islander students; state frameworks (NSW mandatory, VIC Marrung etc.); AITSL 1.4/2.4/1.5 mapped |
| Assessment Creator | A–E rubric generation, links to class marking + Outcomes Tracker |
| PD Plan | Professional development planning |

### Records / tracking tools (4) — all Inner Sanctum-gated
| Tool | Notes |
|---|---|
| Outcomes Tracker | Per-student progress vs curriculum outcomes across term/year/stage. Pseudonym-only, enforced with a "this looks like a real name" validator |
| Differentiation View | Whole-class adjustment overview; reads from Tracker + Learner Profile + Behaviour + ILP + NCCD records |
| Student Hub | Per-student aggregation of every artefact; NCCD adjustment logging (8 domains); cascade delete |
| Timetable Builder | Auto-slots Phonics/Handwriting/Grammar into open time |

### Content banks (10) — static curriculum content, not AI
Phonics Hub (K–2 SATPIN systematic synthetic phonics, Australian-accent articulation guides, schwa handling, placement assessment), Handwriting "Daily 10" program, Number Sense Ten, Primary Numeracy Masterclasses, Secondary Numeracy Masterclasses, Secondary Numeracy Warm-Up Bank, Grammar Lesson Bank, Grammar Games Bank, Sentence Workshop, Science Lesson Bank.

### Hubs & support pages
Research Hub (294 KB — curated research summaries, digests by topic/year level, feeds the Lesson Builder), NCCD Hub (adjustment levels/categories explained + L&S Access Request Builder, Exam Provisions Builder, Support Needs Case Builder), Blog, Pricing, About, Privacy, Terms, Feedback, My Account.

### Unlinked-from-nav pages (found by probing)
- `student.html` — the student-facing page (see §6)
- `student-hub.html` — teacher-facing per-student records (Inner Sanctum)

---

## 3. Tech stack & architecture

| Layer | YSR | QuizPulse |
|---|---|---|
| Frontend | Hand-authored static HTML, inline JS/CSS, one file per tool (up to 282 KB) | React + Vite SPA |
| Hosting | Netlify | Azure Static Web Apps (Standard, linked backend) |
| Backend | Netlify Functions (`generate-lesson`, `generate-lesson-stream`, `class-dashboard`, `class-join`, `save-session`) | Azure Functions v4 (Node 22), ~50 endpoints |
| Database | None visible for free tier; member data lives in **Memberstack member JSON** (`students[]`, `savedItems{}` observed on the member object) | Cosmos DB (11+ containers, partition-key design, TTLs) |
| Auth | Memberstack (email/password + Google) | Entra External ID CIAM (Microsoft, +Apple planned) |
| Payments | Stripe (via Memberstack) | Not yet monetised |
| LLM | Anthropic Claude (named in privacy policy and page source) | Mock provider placeholder (v4.3.0); adapter ready for Azure OpenAI / Anthropic |
| Analytics | GA4 + Plausible + Netlify RUM | Self-built traffic monitor (v4.4.0) — no third-party trackers |
| PWA | `manifest.json` + `sw.js` (3.3 KB): network-first HTML, cache-first assets, background sync. **No `push`/`notificationclick` handlers** | Full PWA: Web Push + VAPID, notificationclick deep-link, Background Sync offline response queue, install tracking |
| Security posture | Client-heavy; paid gating enforced (Inner Sanctum tools blocked server-side even when logged in) | Server-side authz throughout (assertScope/requireRole, 404-on-mismatch, audit log, step-up re-auth) |

**Architecture read:** YSR is optimised for one-person shipping velocity — no build step, no framework, paste-a-page-per-tool. It works, but state lives in Memberstack JSON rather than a real database, which caps how far the records/tracking tools can scale (cross-student queries, aggregation, multi-device consistency). QuizPulse is heavier but built for a data loop YSR structurally cannot do without re-platforming.

---

## 4. Business model & pricing

### YSR tiers
| Tier | Price | What you get |
|---|---|---|
| No account | Free | Lesson Builder 1/day, Report Writer 1/day, Research Hub 10/day |
| Free account | Free | 2/day on core tools; 1 lifetime free generation each on Term Planner / Learner Profile / Behaviour Support / Social Story |
| Inner Sanctum | **$12/mo or $99/yr** AUD inc GST | Unlimited generations, saved searchable history, amendment/version history, year-long outcome map, report-comment dedup records, Word/PDF/spreadsheet export, monthly research digest |
| School — Small (≤20 teachers) | **$2,500/yr** | Everything, all staff, single invoice, 1-hr onboarding |
| School — Medium (21–50) | **$4,500/yr** | " |
| School — Large (51+) | **$7,500/yr** | " |

### Monetisation mechanics worth noting
- **Scarcity framing:** "$12 foundation rate for the next 10 members, then $15 — locked for life." Classic early-stage urgency lever.
- **The retention hook is data, not features:** "Without Inner Sanctum, everything you build is gone when you close the tab." Free tier is deliberately session-only; *memory* is the paid product. Elegant — the AI generation itself is nearly free to give away, the saved history is the moat.
- **School plan framing:** "less than a single professional development day for a year of support." Anchors against PD budgets, not software budgets. Directly reusable for QuizPulse.
- **Per-tool daily caps** published transparently in a table — builds trust, bounds LLM cost.

### Traction (public counters, since 2 May 2026 — ~3 months)
361 lesson plans, 105 behaviour plans, 656 total documents, "+39 this week," 422 hours saved (self-estimated). That is roughly **a few dozen active users**. Real but very early — comparable stage to QuizPulse pre-pilot. The public counters themselves are a growth tactic (social proof from day one, "anonymous counters" framing).

---

## 5. Design & positioning

- **Voice:** warm, teacher-to-teacher, explicitly anti-corporate. "Built by a teacher." "Not bubble-bath advice." "No AI-sound." Emoji as iconography (💡🤍🌿). Values page ("Three pillars") leads with trauma-informed practice and educator wellbeing before any feature.
- **Positioning pillars:** (1) evidence-based/research-backed — every tool cites researchers by name (Rosenshine, Ross Greene, Porges, Perry, Bomber, Carol Gray, Figley, Stamm, Neff); (2) trauma-informed + neurodiversity-affirming — ~15 named ND profiles as first-class inputs; (3) Australian-first — all 8 states/territories, AC v9, AITSL, NCCD, "not an American or British program retrofitted."
- **Trust posture:** aggressive pseudonym-only enforcement (real-name detector on student records), "never stored, never shared" on wellbeing tool, "never used to train AI models," privacy notices per tool. They understand teacher/child-data anxiety and design for it loudly.
- **Emotional hooks:** daily educator mood check-in on the homepage; the Lesson Builder even takes the *teacher's* current mood as a generation input. Distinctive and on-brand.
- **Weaknesses observed:** navigation is an overloaded flat list of ~25 links; page weights are huge (282 KB HTML); a dismissible banner admits **DET/school firewalls block parts of the site** ("try mobile data or home Wi-Fi"); design is template-ish in places; testimonials are unverifiable first-name-only.

---

## 6. The student loop — YSR's only overlap with QuizPulse

Verified from `student.html` + `lesson-builder.html` source:

1. Teacher picks a class in Lesson Builder → gets a share URL: `student.html?class=CODE#<compressed-lesson-payload>` (+ QR code). The lesson content rides **in the URL fragment**, not a database.
2. Student opens link, enters class code + nickname → `/.netlify/functions/class-join`.
3. Student reads the lesson; answers **one free-text exit-ticket box** (`etAnswer`) → `save-session`. Progress save is code+nickname based, localStorage-backed.
4. Teacher reads responses via `class-dashboard?teacherId=`.

**What it does NOT have:** push notifications (no push handler in the service worker at all), multiple choice, per-question anything, confidence capture, response timing, misconception aggregation, correctness analytics, CSV export, offline queue, duplicate-submission gating, approval/roster model. There is no student identity beyond a self-typed nickname per session.

### Feature-level comparison of the loop
| Capability | YSR | QuizPulse |
|---|---|---|
| Delivery to students | Link/QR the teacher distributes | Real Web Push notification, no link sharing |
| Student join model | Class code + self-typed nickname, no approval | Join request → teacher approval, fuzzy name-list matching, device UUID identity |
| Question format | One free-text exit ticket per lesson | Multi-question MCQ with per-answer confidence (sure / pretty sure / guessing) + response timing |
| Analytics | Raw text answers on a dashboard | Live polled analytics: per-question correctness, four-cell confidence×correctness, misconception hero card, option distribution, per-class rates, CSV export, population benchmarking |
| Offline | None for submissions | Background Sync queue, resubmits when online |
| Anti-abuse | Nothing visible | Duplicate gating, closed-quiz gating, rate limits, server-side roster checks |
| Repeat practice | None | Spaced-repeat clones, misconception-triggered follow-up generation |

**The asymmetry that matters:** YSR's Lesson Builder *predicts* misconceptions ("watch for unequal partitions") and prints them into a plan. QuizPulse *measures* them ("17 of 24 students confidently chose unequal partitions"). Prediction vs evidence. A teacher can use both; only one closes the loop.

---

## 7. Output quality (verified by running a real generation)

One free Lesson Builder run: Year 3, NSW, MA2-PF-01, "fractions — sharing pizza and chocolate." ~30 s streamed. Result was genuinely good, not filler:

- Correct NSW outcome code and Stage 2 framing
- Real structure: Do Now → Masterclass (explicit numerator/denominator teaching with worked examples) → Flow (30–35 min choice task) → Exit Ticket
- Differentiation bands that actually differ: low-floor pre-partitioned templates / wide-walls own representation / high-ceiling partition-two-ways-and-compare
- A misconception re-teach written into the flow phase (unequal partitions)
- **"Audit-ready documentation"**: auto-mapping to AITSL standards 1.5, 2.1, 3.2, 3.3, 5.1, each with a paragraph of justification and research citations (Rosenshine 2012; Martin & Evans 2021), explicitly framed as "shown to school leadership or an external reviewer without further preparation"
- One weak spot: padded "Sustainability" in as a cross-curriculum priority for a fractions lesson — mild relevance stretch

The input form is equally deep: stage/year checkboxes, composite-class flag, ~15 ND profiles, free-text class context, curriculum-outcome browser, flow mode, teacher-mood selector, 1–5 lesson sequences, three output modes (programme+slides / programme / slides).

**Takeaway:** this is not a thin GPT wrapper. The prompt engineering and pedagogical scaffolding are serious, and the AITSL auto-mapping is shipping on every generation.

---

## 8. The Pedagogy Project (Payhip storefront)

`payhip.com/ThePedagogyProject` — a digital-download storefront, currently **12 free "Taster" PDFs** (Casual Teacher Handbook, Composite Classroom, Neurodivergent Friendly School, Self-Regulated Learning K–6, Science of Reading early literacy, refugee-family partnership toolkit, Teacher Time Audit, etc.). Sample product inspected: 3-page fillable A4 PDF, professionally written. Membership page: "Something special is coming soon in 2027." Contact is an anonymous form; Instagram `@thepedagogyproject`.

**Relationship to YSR:** no shared branding, no cross-links, different Instagram handles, no ABN shown. The one concrete link: **YSR's Instagram follows The Pedagogy Project's Instagram.** Combined with near-identical positioning vocabulary (research-informed, neurodiversity, inclusion, composite classes, Australian K–12), same-operator or close-collaborator is plausible — but unconfirmed. Treat as circumstantial.

**If same operator:** the pattern is a content + productivity ecosystem for Australian teachers — static resources (PP) + AI tools/records (YSR) — with a paid membership planned for 2027 on the content side too. Notably, *neither surface touches live student response data.* The formative-assessment loop remains unoccupied ground across the whole ecosystem.

---

## 9. Full positioning comparison

| Dimension | Your Staff Room | QuizPulse |
|---|---|---|
| Core job | Reduce teacher admin: generate documents, plans, reports | Close the formative loop: student responses → misconception insight |
| Direction of value | Teacher → paper (prospective) | Students → teacher (evidence) |
| Primary user moment | Sunday-night planning, report season, NCCD moderation | In/around the lesson: send, students respond, act on data |
| Breadth vs depth | ~20 tools, wide and shallow-to-medium | 1 loop, deep (push, confidence, analytics, benchmarking, evidence export) |
| Student contact | 1 free-text exit ticket via shared link | The entire product |
| Compliance angle | NCCD hub, PLP/ILP, AITSL auto-mapping on generated plans, outcome tracking | APST/VIT evidence PDF + annual MyPD log **derived from real quiz data** |
| Student data model | Pseudonyms typed by teacher; no student identity | Device UUID, approval-gated, no accounts, no PII |
| Australian localisation | Extreme (per-state syllabi, accent-aware phonics, state PLP frameworks) | Curriculum-neutral with VIC-oriented evidence export |
| Team size signal | Solo teacher-founder | Solo founder |
| Maturity | Live, monetised, ~dozens of active users, 3 months of traction | Pre-pilot, unmonetised, deeper engineering |
| Moat | Content banks + curated research + saved-history lock-in + brand warmth | Push-first delivery + confidence/misconception data layer + server-side rigour |

---

## 10. Strategic implications for QuizPulse

### What YSR validates
1. **Australian teachers pay $12/mo for AI tooling** — a live price point from the same market. $99/yr annual anchor. School plans at $2.5k–7.5k/yr framed against PD-day budgets.
2. **Compliance evidence sells.** Their fastest-looking additions (NCCD Hub, PLP Builder — both tagged NEW) and the auto-AITSL mapping on every lesson are compliance plays. QuizPulse's APST/VIT export is the same wedge with a stronger claim: theirs is generated prose about intent; yours is auto-compiled evidence from real student responses. **Market the difference explicitly: "evidence, not paperwork."**
3. **Saved-history-as-moat.** Their free tier forgets everything on tab close; memory is the subscription. QuizPulse's equivalent lock-in is longitudinal response data — misconception history per class per topic across terms. Design pricing so the *data history* is the retained asset.
4. **Trust language for a minors-adjacent product.** Pseudonym enforcement, "never used to train AI," per-tool privacy notes. QuizPulse's postures (anonymous device IDs, student-fingerprint stripping, demo isolation) are already stronger than theirs — but YSR *says it louder*. Copy the loudness.

### What YSR warns about
5. **School firewalls are real.** A live Australian ed product carries a permanent banner: DET/school networks block parts of their site. QuizPulse's entire differentiator (push notifications reaching student devices) rides on school Wi-Fi behaviour. **Test push delivery on a real DET network before pilot** — this is the single highest-risk external dependency, flagged by a competitor's production experience.
6. **Breadth spreads thin.** ~20 tools ÷ 361 lesson plans in 3 months = shallow usage per tool. Confirms the deep-single-loop strategy over tool sprawl.

### Watch-items (how YSR could become a real competitor)
- If they upgrade `student.html` from one exit-ticket box to structured MCQ + aggregation, they'd have a crude formative loop bolted onto an established teacher audience. Their stack (Memberstack JSON as the database, no push infrastructure, no student identity model) makes the *full* loop a re-platform, not a feature — but a crude version is a weekend's work for them.
- The 2027 Pedagogy Project membership suggests roadmap ambition. Monitor both Instagrams and the YSR blog quarterly.
- Conversely: **partnership shape exists.** YSR generates the lesson and predicts the misconception; QuizPulse measures whether it landed. "Export exit ticket to a real quiz" is a natural integration if the ecosystems ever meet.

### Positioning line this analysis suggests
> Planning tools tell you what *should* happen in your classroom. QuizPulse shows you what *did* — which students hold which misconception, with how much confidence, in time to fix it.

---

## 11. Evidence & caveats

- All page contents, endpoints, stack details, and the generation output were observed directly on 2026-08-03. Traction counters are the site's own self-reported figures.
- Inner Sanctum (paid) tool internals were **not** inspected — gating held server-side. Descriptions of paid features come from marketing copy and page scaffolding.
- The YSR ↔ Pedagogy Project link rests on one Instagram follow + stylistic similarity. Unconfirmed. ABN cross-check (YSR footer: ABN 38 234 407 780) would settle it.
- One free daily generation was consumed on the logged-in account; nothing purchased, nothing published.
