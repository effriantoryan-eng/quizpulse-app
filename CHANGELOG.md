# Changelog

All notable changes to QuizPulse are documented in this file.

## [v2.0.0] — Sprint 4

### Breaking changes

- **`POST /api/simulate` removed.** Simulated student responses are no longer generated when
  a teacher sends a quiz. Analytics now reflect only real student submissions. Any client code
  or scripts calling `/api/simulate` must be updated — the endpoint returns 404.

### New features

- Real student quiz-taking flow at `/quiz?quizId=` (`TakeQuiz.jsx`) — students answer all
  questions on one screen and submit without authentication.
- `POST /api/responses` now enforces: approved join-request ownership (403), duplicate
  submission per student per quiz (409), quiz closed state (410), and a 4 KB body cap (413).
- Quizzes carry a `closedAt` timestamp, set from a teacher-configured duration (minimum 5
  minutes) at send time. Closed quizzes reject new responses.
- Offline resilience: the service worker queues failed response submissions in IndexedDB and
  flushes them via Background Sync (`sync-responses`) once connectivity returns.
- Live analytics: `GET /api/analytics` joins real responses with question option text, polled
  every 3 seconds in `Analytics.jsx`. Adds an "X / Y responded" counter, a non-responder list,
  and a CSV export (rate-limited to 10 exports/teacher/hour).
- Quiz scheduling: a timer-triggered function sends scheduled quizzes automatically once their
  `scheduledFor` time has passed. `SendQuiz.jsx` exposes a functional date/time picker. Capped
  at 50 pending scheduled quizzes per teacher.

### Bug fixes

- None in this sprint.
