# Dependency Review — 2026-09-19

Scope: the three npm roots — root teacher app (`package.json`), API (`api/`), admin portal
(`admin/`). Data from `npm outdated --long` + `npm audit` run 2026-09-19.

---

## Upgrade sprint outcomes (2026-09-19, branch `chore/dependency-upgrades-2026-09`)

The thorough pass over the major-version jumps `npm audit fix` skipped. Baseline before any
change: **757/757 unit tests pass**, both frontends build clean. One deliberate commit per
decision. (Note: root already sat on Vite 8.3.0 / plugin-react 6.0.2 from the earlier `audit fix`
commit `6bf0055`, so the §2 "root vite 8.0.14→8.3.0" line was already handled.)

| # | Package(s) | Decision | Why |
|---|---|---|---|
| 1 | admin `vite` 6→8, `@vitejs/plugin-react` 4→6 | **KEPT** | Aligns admin to root's tooling; clears admin vite/postcss build-time advisories; `admin` build clean on vite 8.3.0. |
| 2 | api `jwks-rsa` 3→4 | **DEFERRED** | v4 swaps its crypto backend to `jose`, whose `dist/webapi` build is **ESM-only**. The func runtime (Node 22 `require(esm)`) handles it — a live JWKS fetch against the real CIAM keys endpoint passed with the exact `auth.js` call sequence — but the CommonJS jest harness can't parse it, so **7 API test suites fail to load**. No CVE forces v4 (v3 is unflagged by `npm audit`); making it "safe" means adding a babel/`@babel/preset-env` transform purely so jest can swallow an ESM-only transitive dep. Not worth it for a currency bump. **Add when:** the jest harness moves to ESM/babel, or a v3 CVE lands. |
| 3 | root + admin `react-router-dom` 6→7 | **KEPT** | The only flagged runtime advisory. App uses only the declarative core (`BrowserRouter/Routes/Route/Navigate/Link/NavLink/useNavigate/useLocation/useParams/useSearchParams`) — none of the data-router APIs where RR7's breaking changes live. Both builds clean, **0 vulnerabilities** in both roots after. Nav smoke test (teacher app, live): route matching, `Link` client-side nav, and `useLocation`-driven title updates all work with no router errors. No jest test imports the router. |
| 4 | root `qrcode-generator` 1→2 | _pending_ | |
| 5 | api `pdfkit` 0.19→0.20 | _pending_ | |
| 6 | root `@types/react` / `-dom` 19→18 | _pending_ | |

**Out of scope (untouched, no forcing CVE):** MSAL 3→5 (auth is hard-won/fragile — see
`reference_admin_portal_auth_gotchas`), React 18→19 (600+ call sites, no payoff).

---

## TL;DR

- **23 security vulnerabilities across the three roots** (root 11, api 7, admin 6). Most are
  **dev/build-time only** and fixed by a plain `npm audit fix` (no breaking changes).
- **Two runtime deps carry real advisories**: `react-router-dom` (admin, moderate — open
  redirect / SSR hydration) and `jwks-rsa` (api, the token-validation library — a major bump is
  available). Everything else vulnerable is tooling that never ships to a user.
- **The version drift is mostly noise.** ~15 of the outdated packages are patch/minor bumps.
  The decisions that actually matter are **5 major-version jumps** (MSAL 3→5, React 18→19,
  react-router 6→7, admin's Vite 6→8, qrcode-generator 1→2) — all optional, none blocking.

**Recommended action: run `npm audit fix` (non-`--force`) in all three roots. That clears the
build-time advisories with zero code changes. Everything below that line is a judgment call, not
a fire.**

---

## 1. Security vulnerabilities (the part that matters)

### Root (`package.json`) — 11 vulns (1 low, 4 moderate, 6 high)
| Package | Sev | Ships to users? | Fix |
|---|---|---|---|
| `postcss` (via vite) | high | No — build only | `npm audit fix` |
| `vite` 8.0.0–8.0.15 | high | No — dev server / build only (launch-editor NTLM disclosure, `fs.deny` bypass) | `npm audit fix` → 8.3.0 |

Both are **local-dev / CI-only** attack surface. The advisories are about a dev server on a
Windows box, not the deployed SWA static bundle.

### API (`api/`) — 7 vulns (1 moderate, 6 high)
| Package | Sev | Ships to users? | Fix |
|---|---|---|---|
| `js-yaml` (via azure-functions-core-tools) | high | **No** — `core-tools` is a *devDependency* (the `func` CLI). Never in the deployed Function App. | `npm audit fix` |
| `extract-zip` (via azure-functions-core-tools) | — | No — dev only | `npm audit fix` |

**None of the API's runtime deps are flagged.** Every API advisory traces back to
`azure-functions-core-tools`, which is the local `func` CLI and is never published to Azure. Low
urgency.

### Admin (`admin/`) — 6 vulns (3 moderate, 3 high)
| Package | Sev | Ships to users? | Fix |
|---|---|---|---|
| `react-router` / `react-router-dom` 6.x | moderate | **Yes — runtime** (open redirect via backslash in `<Link>`/`useNavigate`; SSR-hydration constructor injection) | `npm audit fix` → patched 6.30.x |
| `postcss` (via vite) | high | No — build only | `npm audit fix` |

The react-router one is the **only user-facing runtime advisory in the admin app**. The SSR
vector doesn't apply (this is a client-only SPA), and the open-redirect needs an
attacker-controlled link target — low real-world exposure for an operator-only portal, but it's a
free patch-level fix, so take it.

> The **root app runs the same react-router-dom 6.30.x** but `npm audit` didn't flag it there
> because the root already sits on a patched 6.30.6 wanted-version. Run `npm audit fix` in root
> too to be sure both land on the fixed patch.

---

## 2. Outdated packages — full inventory

Legend: **patch/minor** = safe, semver-compatible, `npm update` picks it up · **MAJOR** = breaking,
deliberate upgrade.

### Root
| Package | Current | Latest | Gap | Notes |
|---|---|---|---|---|
| `@azure/msal-browser` | 3.30.0 | **5.22.0** | MAJOR ×2 | Auth core. See §3. |
| `@azure/msal-react` | 2.2.0 | **5.7.1** | MAJOR ×3 | Pairs with msal-browser. |
| `react` / `react-dom` | 18.3.1 | **19.3.0** | MAJOR | See §3. |
| `react-router-dom` | 6.30.3 | **7.18.4** | MAJOR | See §3. |
| `qrcode-generator` | 1.4.4 | **2.0.4** | MAJOR | Used by student QR (v4.7.0). See §3. |
| `@playwright/test` | 1.60.0 | 1.63.0 | minor | E2E only. |
| `@types/react` / `-dom` | 19.2.x | 19.3.0 | patch | Types only — and pinned to **19** while runtime React is **18**, see §4. |
| `@vitejs/plugin-react` | 6.0.2 | 6.1.1 | minor | Build only. |
| `eslint` | 10.4.0 | 10.11.0 | minor | Lint only. |
| `eslint-plugin-react-refresh` | 0.5.2 | 0.5.7 | patch | Lint only. |
| `globals` | 17.6.0 | 17.12.0 | minor | Lint only. |
| `jest` | 30.4.2 | 30.5.2 | patch | Test only. |
| `jest-html-reporter` | 4.4.0 | 4.4.2 | patch | Test only. |
| `vite` | 8.0.14 | 8.3.0 | minor | **Also the security fix — take it.** |

### API
| Package | Current | Latest | Gap | Notes |
|---|---|---|---|---|
| `jwks-rsa` | 3.2.2 | **4.1.0** | MAJOR | Token-validation lib. See §3. |
| `pdfkit` | 0.19.1 | **0.20.2** | pre-1.0 minor (treat as breaking) | Evidence-export PDFs. See §3. |
| `unpdf` | 1.6.2 | 1.8.1 | minor | PDF text extraction (AI gen). Safe bump. |
| `@azure/cosmos` | 4.9.3 | 4.10.1 | patch | DB SDK. Safe. |
| `@azure/functions` | 4.16.0 | 4.16.5 | patch | Runtime. Safe. |
| `fuse.js` | 7.4.2 | 7.5.0 | minor | Name-match. Safe. |
| `mammoth` | 1.12.0 | 1.12.3 | patch | docx extraction. Safe. |
| `azure-functions-core-tools` | 4.11.0 | 4.14.0 | minor | Dev CLI only + the js-yaml fix. Safe. |
| `jest` | 30.4.2 | 30.5.2 | patch | Test only. |

### Admin
| Package | Current | Latest | Gap | Notes |
|---|---|---|---|---|
| `@azure/msal-browser` | 3.30.0 | **5.22.0** | MAJOR ×2 | Same as root. |
| `@azure/msal-react` | 2.2.0 | **5.7.1** | MAJOR ×3 | Same as root. |
| `@vitejs/plugin-react` | 4.7.0 | **6.1.1** | MAJOR ×2 | Admin is a full major behind root (root is on 6.x). |
| `vite` | 6.4.3 | **8.3.0** | MAJOR ×2 | Admin is two majors behind root's Vite 8. |
| `react` / `react-dom` | 18.3.1 | **19.3.0** | MAJOR | Same as root. |
| `react-router-dom` | 6.30.4 | **7.18.4** | MAJOR | Same as root + the audit fix. |

---

## 3. The major-version decisions (each optional, ranked by payoff)

1. **MSAL 3→5 (browser) / 2→5 (react)** — *skip for now.* Auth is the single most fragile,
   already-hard-won part of this app (the admin CIAM saga in `reference_admin_portal_auth_gotchas`).
   No advisory forces it. v3 is still maintained. Upgrading risks re-breaking the CIAM/issuer
   handling for zero user benefit. Revisit only if a v3 CVE lands.

2. **`jwks-rsa` 3→4 (api)** — *worth doing, carefully.* It validates every bearer token. v4 dropped
   Node <14 and tweaked the caching API. Low surface, but test the JWKS fetch path
   (`api/auth.js`) against the CIAM keys endpoint before shipping. No advisory forces it either.

3. **React 18→19 + react-router 6→7** — *skip.* Both apps are on React 18 with 600+ call sites and
   a working router. React 19 + RR7 is a multi-day migration (RR7 restructures the whole package).
   No payoff for a formative-assessment SPA. The router *security* fix is available on the 6.30.x
   patch line (§1) — take that, not the major.

4. **Admin Vite 6→8 + plugin-react 4→6** — *worth aligning.* The admin portal is 1–2 majors behind
   the root app's build tooling for no reason. Bumping it to match root (Vite 8, plugin-react 6)
   also clears the admin `vite`/`postcss` advisories. Admin is bare operator UI — low blast radius,
   good hygiene. **This is the highest-value major to actually do.**

5. **`qrcode-generator` 1→2 (root)** — *low priority.* Only used by `src/components/QRCode.jsx`.
   Verify the v2 API still matches how `ClassJoinQR` calls it; if it's a drop-in, take it, else leave.

6. **`pdfkit` 0.19→0.20 (api)** — *low priority.* Powers the APST evidence PDFs. Pre-1.0, so 0.20
   can break. The known footer-pagination bug (CLAUDE.md) means this file is delicate — only bump
   with `tests/unit/api/pdfEvidence.test.js` green.

---

## 4. Odd thing worth fixing regardless

`@types/react` / `@types/react-dom` are pinned to **v19** while the actual React runtime is **v18**
(root `devDependencies`). Types a full major ahead of the runtime can hand you autocomplete for
APIs that don't exist at runtime. Either pin the types back to `^18` to match React 18, or commit
to the React 19 upgrade — but don't leave them mismatched.

---

## 5. Recommended sequence

```bash
# 1. Zero-risk: clears most advisories + safe minor/patch bumps, no code changes.
#    Run in each root. (non-force = no majors touched)
npm audit fix        # root
cd api && npm audit fix
cd ../admin && npm audit fix

# 2. Then the safe API minors (no advisory, just currency):
cd api && npm update @azure/cosmos @azure/functions fuse.js mammoth unpdf
```

Then, as separate deliberate PRs when there's appetite (not urgent):
- Align admin build tooling to Vite 8 / plugin-react 6 (decision #4).
- `jwks-rsa` 3→4 with an auth-path test (decision #2).

**Leave alone:** MSAL, React 19, react-router 7. No advisage forces them and each is a real
migration against a working, hard-won setup.
