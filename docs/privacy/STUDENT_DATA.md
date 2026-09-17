# What QuizPulse stores about students

_One-page summary for schools evaluating a pilot. Derived directly from the current data model
and code — see `CLAUDE.md` for the full schema if you need more detail than this page._

## Students never have an account

There is no student sign-up, login, name, or email captured by the platform itself. A student is
identified only by a random device ID (`quizpulse_device_id`) generated in their browser's local
storage the first time they join a class. That ID is what ties their quiz responses together —
nothing else does.

## What is stored

| Data | Where | Notes |
|---|---|---|
| Device ID | `join_requests`, `responses`, push `subscriptions` | Random UUID, generated client-side, not derived from anything personally identifying |
| Student name | `join_requests` only | Typed once by the student when asking to join a class; a teacher approves or rejects it. Optionally matched (not identified) against a teacher-entered name list. |
| Quiz answers + confidence | `responses` | Which option was picked, a 3-level confidence rating (Sure / Pretty sure / Guessing), and response time. No open text. |
| Push notification endpoint | `subscriptions` | Only if the student opts in to notifications on their device. Auto-removed if delivery starts failing (stale subscription pruning). |
| Minimal page-visit beacons | `pageviews` | On the quiz-taking and class-home routes (`/quiz`, `/quiz/*`, `/student/class`), browser fingerprint fields — user agent, screen size, language, timezone, referrer — are stripped server-side before write, regardless of what the browser sends; only `{page, deviceId, sessionId, quizId, visitedAt}` remain. **The `/join` page and the public pages (`/`, `/demo`, `/login`) do not strip these fields yet** — a planned change (R3) will bring them in line. |

## What is deliberately NOT collected

- No browser fingerprint on the quiz-taking and class-home routes (`/quiz`, `/quiz/*`,
  `/student/class`), enforced server-side, not just client-side. (The `/join` page still records
  these fields today; R3 will strip them there too.)
- No location data.
- No student name beyond what they type into a join request (which a teacher can reject).
- No email, phone number, or other contact detail.
- No free-text answers — quizzes are multiple-choice only.

## Retention

- Page-visit beacons (`pageviews`) auto-delete after **180 days** (Cosmos container TTL).
- A **rejected** join request auto-deletes after **7 days** (Cosmos per-item TTL) — long enough for
  the student to see "Not approved", then gone.
- When a teacher **deletes a class** or **removes a student**, that student's name and notification
  sign-up are deleted, and their quiz answers are kept in the teacher's results with no link back to
  the device (de-identified).
- Otherwise, an active student's quiz answers and push subscription persist while their class does.
- Uploaded source documents (for AI-generated quizzes) are **never stored** — only extracted text
  chunks, and those expire after 90 days. The original file is discarded immediately after
  extraction.

## Who can see it

- A student's own teacher can see their class's responses and join requests — never other
  teachers' classes, enforced server-side on every request (`assertScope`, 404-on-mismatch — a
  teacher requesting another teacher's data gets "not found," not "forbidden," so the platform
  never confirms whether the resource even exists).
- Platform admins (a small, fixed set of accounts) can see aggregated, cross-teacher counts for
  operating the platform (traffic volume, error rates) and a cohort-level drill-down of a single
  teacher's own class results — never individual student names or per-response rows.
- No student data is ever sold, shared with advertisers, or used to profile students individually.

## Legal basis / purpose

Student data is collected solely to deliver the immediate formative-assessment function the
teacher requested: showing that student's own teacher how their class is doing, in aggregate and
per-question. It is not used for any other purpose.

## Deletion on request

A teacher can do two things directly today:

- **Delete a class** — removes every student's name and notification sign-up for that class, and
  de-identifies their answers (the counts stay in the teacher's results, with no link to the device).
- **Remove a single student** — deletes that student's notification sign-up and de-identifies their
  answers, same as above.

There is no self-service tool yet to erase one student's records across the whole platform. Until
one ships, a student (via their teacher) can request individual erasure by contacting
[admin@quizpulse.app](mailto:admin@quizpulse.app) with the class name and approximate join date; it
is handled manually, so we don't promise a fixed turnaround.

## AI-generated quizzes (when enabled)

When a teacher uploads a document to generate quiz questions, that document's extracted text is
sent to a third-party AI provider (Azure OpenAI or Anthropic, depending on configuration) to
produce draft questions. **No student data is ever included in this process** — it operates only
on teacher-supplied source material, before any student has interacted with the resulting quiz.
The original uploaded file is discarded immediately after text extraction; only the generated
questions are kept.

- **Azure OpenAI**: processing stays within the Azure tenant/region configured for this
  deployment.
- **Anthropic**: processing occurs in the United States.

The provider in use for a given deployment is documented in `docs/azure/LLM_PROVIDER_SETUP.md`.
