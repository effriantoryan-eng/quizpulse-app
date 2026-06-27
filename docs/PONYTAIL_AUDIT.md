# Ponytail Audit — Recommended Changes

Ranked biggest cut first. No changes applied; this is a reference list.

---

## P0 — Delete

- **`src/onboardingCache.js`** — dead file, zero imports anywhere. Delete entirely.
- **`api/joinRequests.js:490`** — `module.exports = {}` at the end of a file that registers handlers via `app.http()` and exports nothing. Delete the line.
- **`jsonwebtoken` in `src/package.json` devDeps** — used only in `api/`, not in any frontend file. Remove from frontend deps.

## P1 — Shrink / Inline

- **`src/api.js`** — entire file is a 5-line conditional for one string value. Inline the ternary into its callers and delete the file.
- **`admin/src/session.js`** — exports only `useIdleTimeout`; rename to `useIdleTimeout.js` or inline into `admin/src/App.jsx` (single consumer). Current name creates confusion with the sibling teacher-app `session.js`.

## P2 — Minor Shrink

- **`admin/src/msalInstance.js` URL extraction** — triple ternary `typeof input === 'string' ? input : input instanceof URL ? input.href : input.url` → `typeof input === 'string' ? input : input.url`.
- **`src/hooks/usePwaInstall.js:75`** — exports both named and default for the same function. Pick one, remove the other.
- **`api/pageView.js:58–66`** — six repeated `.slice(0, N)` calls. Extract `const trunc = (v, n) => typeof v === 'string' ? v.slice(0, n) : v` and reuse.

## P3 — Sync Comments (Drift Risk)

- **`src/authConfig.js` + `admin/src/authConfig.js`** — ~80% identical CIAM config duplicated across both apps. Add `// mirrors admin/src/authConfig.js — keep in sync` (and vice versa) at minimum; ideally extract shared tenant constants to a `.env`-backed module so a CIAM tenant change only needs one edit.

---

**net: ~−50 lines, −1 dep possible.**
