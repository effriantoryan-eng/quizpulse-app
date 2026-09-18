# What QuizPulse stores about students

_One-page summary for schools evaluating a pilot. Derived directly from the current data model
and code — see `CLAUDE.md` for the full schema if you need more detail than this page._

## Students never have an account

There is no student sign-up, login, name, or email captured by the platform itself. A student is
identified only by a random device ID (`quizpulse_device_id`) generated in their browser's local
storage **the moment they submit the join form** — never before, and never on a page view. That ID
is what ties their quiz responses together — nothing else does.

## What is stored

| Data | Where | Notes |
|---|---|---|
| Device ID | `join_requests`, `responses`, push `subscriptions` | Random UUID, generated client-side, not derived from anything personally identifying |
| Student name | `join_requests` only | Typed once by the student when asking to join a class; a teacher approves or rejects it. Optionally matched (not identified) against a teacher-entered name list. |
| Quiz answers + confidence | `responses` | Which option was picked, a 3-level confidence rating (Sure / Pretty sure / Guessing), and response time. No open text. |
| Push notification endpoint | `subscriptions` | Only if the student opts in to notifications on their device. Auto-removed if delivery starts failing (stale subscription pruning). |
| Minimal page-visit beacons | `pageviews` | Every route, not just student ones: no browser fingerprint fields (user agent, screen size, language, timezone, referrer) are ever stored anywhere — only two coarse buckets, `device` (mobile/desktop/unknown) and `browser` (chrome/safari/firefox/edge/other), derived server-side and the raw values discarded. On the quiz-taking and class-home routes (`/quiz`, `/quiz/*`, `/student/class`), those buckets aren't even computed — they're stored as `unknown`/`other`. Before a device joins a class, no persistent ID exists at all: a pre-join visit sends only a per-tab session ID, never the permanent device ID. |

## What is deliberately NOT collected

- No browser fingerprint field, on any route, ever — enforced server-side regardless of what the
  browser sends. Only coarse device/browser buckets are kept, and even those are withheld on
  student and consent-related routes.
- No persistent identity before a student actually joins a class — page views before that point
  carry only a per-tab session ID that resets when the tab closes, never a device ID.
- No location data.
- No student name beyond what they type into a join request (which a teacher can reject).
- No email, phone number, or other contact detail.
- No free-text answers — quizzes are multiple-choice only.
- No tracking before notice — the join form shows a short collection notice, with a link to the
  full collection notice, before the student submits their name.

## Retention

- Page-visit beacons (`pageviews`) auto-delete after **180 days** (Cosmos container TTL).
- A **rejected** join request auto-deletes after **7 days** (Cosmos per-item TTL) — long enough for
  the student to see "Not approved", then gone.
- When a teacher **deletes a class** or **removes a student**, or a **student leaves a class**, that
  student's name and notification sign-up are deleted, and their quiz answers are kept in the
  teacher's results with no link back to the device (de-identified). On an explicit **erasure
  request** (or a **teacher account deletion**), the answers are hard-deleted, not just de-identified.
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

## Notice, consent and school authorisation

- **The collection notice.** The join form shows a short, plain-language notice before the student
  types their name, with a link to the full collection notice. The version of the notice a student
  was shown is recorded on their join request; an older device that hasn't seen the current notice
  isn't blocked from joining, it just has no version recorded.
- **Where the legal documents live.** A Privacy Policy, a Collection Notice and Terms of Use are
  in-app pages (`/privacy`, `/collection-notice`, `/terms`), linked from a footer on every public,
  student and sign-in page, and from the teacher sidebar.
- **The notification prompt only follows a button press.** The browser's own permission prompt
  never fires automatically. A student sees one line explaining what notifications are for and
  taps "Turn on notifications" themselves — the tap is what lets the prompt appear at all on some
  browsers, and it means the student always makes an active choice rather than being asked before
  they understand why.
- **School authorisation, not a parent/student consent form.** QuizPulse doesn't collect consent
  directly from a student or their family — the school is the consent intermediary. A teacher
  confirms, when creating a class, that their school has authorised using QuizPulse and informed
  families; that confirmation (with a timestamp) is recorded on the class. Classes created before
  this confirmation existed keep working for a grace period, after which new joins to an
  un-attested class are paused until the teacher confirms.
- **No age question on the join form.** The school-authorisation model above is the deliberate
  design choice here, not an oversight — QuizPulse treats the school as the party responsible for
  deciding whether and how to introduce it to a given age group, the same way a school decides
  which other classroom tools to use. This is a considered position, not a legal conclusion; a
  school with a different requirement should raise it with QuizPulse before piloting.

## Legal basis / purpose

Student data is collected solely to deliver the immediate formative-assessment function the
teacher requested: showing that student's own teacher how their class is doing, in aggregate and
per-question. It is not used for any other purpose.

## Deletion on request

Several routes exist, and each does exactly what it says:

- **A student can leave a class** — on their class-home page. Deletes their name and notification
  sign-up for that class and de-identifies their answers (the counts stay in the teacher's results,
  with no link to the device), the same as a teacher removal.
- **A student can turn notifications off** for a class — on the same page. Deletes that class's
  notification sign-up; they can turn it back on any time.
- **A teacher can delete a class or remove a single student** — as above, for that class.
- **A teacher can delete their whole account** — Your account → Delete my account. After a fresh
  sign-in and typing DELETE, this permanently removes their classes and students' names, their
  quizzes and every answer, their questions, drafts and uploaded materials, and their school if it is
  unvalidated and belongs to no other teacher.
- **A student (via their teacher or school) can request erasure of one device's records** across the
  whole platform — quiz answers, notification sign-up, join requests and page-visit beacons. The
  platform owner runs this from an audited, owner-only tool. Contact your teacher or the school, who
  will pass the request on.

Every account deletion and device erasure requires a recent sign-in and is written to an
append-only audit trail **before** anything is removed. The step-by-step procedure the owner
follows — including the manual removal of a teacher's sign-in account — is in
[`docs/privacy/ERASURE_RUNBOOK.md`](ERASURE_RUNBOOK.md).

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
