# v4.3.0 — LLM Provider Setup (AI Quiz Generation)

The sprint ships and is tested entirely against the **mock provider** (`LLM_PROVIDER=mock`,
the default) — no real LLM API key is required to build, test, or use v4.3.0 in its default
state. This doc covers activating a real provider later.

## Provisioned resource (2026-08-23)

An Azure OpenAI resource is now live and wired to the Function App (but **`LLM_PROVIDER` in
production is still `mock`** — not flipped until steps 4-5 below are done):

| Thing | Value |
|---|---|
| Resource | `quizpulse-openai-av5z18` (kind OpenAI, S0, **australiaeast**, resource group `quizpulse-app-rg`) |
| Endpoint | `https://quizpulse-openai-av5z18.openai.azure.com/` |
| Deployment | `gpt-5-mini` (version 2025-08-07, GlobalStandard, capacity 10) — **gpt-4o-mini is gone from Azure's catalog (deprecated for new deployments)**; gpt-5-mini is the current small/cheap chat tier |
| Key Vault secret | `LLM-API-KEY` in `quizpulse-app-kv-av5z18` |
| App settings set | `LLM_API_KEY` (KV ref), `LLM_ENDPOINT`, `LLM_MODEL=gpt-5-mini` |

**Two gotchas found live and fixed in `api/shared/llmProviders/azureOpenai.js`:**
1. **No `temperature`.** gpt-5-mini is a reasoning-family model and rejects any non-default
   temperature (`Unsupported value: 'temperature' does not support 0.4`). The provider no longer
   sends one.
2. **Setting the KV reference via `az` on this Windows machine drops the trailing `)`** (Known
   issue #7, but worse than documented — it truncates even from PowerShell with any quoting when
   other `--settings` args follow). **Fix: set app settings from a JSON file** —
   `az functionapp config appsettings set ... --settings @settings.json` — which bypasses the
   arg-parsing entirely. Verify afterward that `LLM_API_KEY` ends in `)`.

**Founder smoke test (2026-08-23): PASS.** Ran `generateDraft` (5 questions) and the
regenerate-shape call (1 question) against the live deployment with founder-authored material.
Both returned valid, factually-grounded questions passing `draftSchema` validation. **Two real
bugs caught and fixed** before any teacher use:
- Regenerate asked for 1 question but got 3 — the system prompt hardcoded "between 3 and 15
  questions", contradicting the user prompt's "exactly N". Invisible against the mock (which loops
  exactly N). Fixed in `api/shared/llmPrompts.js` (guarded by `tests/unit/api/llmPrompts.test.js`).
- **Latency is ~4-9s per call**, far above the mock's ~2s dev-delay proxy. The pending-UI copy
  (GenerateQuiz/ReviewDraft staged loader) must tolerate ~10s comfortably before go-live.

---

## Env vars

| Var | Purpose |
|---|---|
| `LLM_PROVIDER` | `mock` (default) \| `azureOpenai` \| `anthropic` |
| `LLM_API_KEY` | The provider API key. **Underscores, not hyphens** — hyphenated names are invalid Linux Function App setting names. |
| `LLM_ENDPOINT` | Required for `azureOpenai` only (the Azure OpenAI resource endpoint URL). |
| `LLM_MODEL` | Required for `azureOpenai` (deployment name); optional for `anthropic` (defaults to `claude-sonnet-5`). |

### Key Vault naming gotcha (same as VAPID)

The **app setting** is `LLM_API_KEY` (underscores) but the **Key Vault secret** should be named
`LLM-API-KEY` (hyphens) — Key Vault secret names don't allow underscores, so this project's
convention (see VAPID keys in CLAUDE.md) is: hyphenated secret name, underscored app-setting
reference. Set it from **PowerShell**, not cmd.exe (cmd mangles the `( ) ;` characters in a
`@Microsoft.KeyVault(...)` reference — see CLAUDE.md Known issue #7):

```powershell
az functionapp config appsettings set -g quizpulse-app-rg -n quizpulse-app-api-av5z18 --settings `
  'LLM_API_KEY=@Microsoft.KeyVault(VaultName=quizpulse-app-kv-av5z18;SecretName=LLM-API-KEY)'
```

---

## Activation checklist (required before switching `LLM_PROVIDER` away from `mock` in production)

1. **Provision the key** in Key Vault (`LLM-API-KEY` secret) and set `LLM_API_KEY`/`LLM_ENDPOINT`/
   `LLM_MODEL` app settings as above.
2. **Founder-authored smoke run** — before any pilot use, run `generateDraft` and a
   `regenerate-question` call against the real provider in a dev environment using
   **founder-authored material only** (no teacher-uploaded documents — real teacher content stays
   outside the solicitor-reviewed scope until this is done). Record latency, cost, and output
   quality. Pilot readiness gates on this run.
2b. Use the mock provider's `~2s` dev delay (see `api/shared/llmProviders/mock.js` caller in
   `api/generationDrafts.js`, once built) as a rough proxy for what the pending UI needs to
   tolerate — a real provider call will typically take longer.
3. ~~**Switch quota semantics**~~ — **DONE (2026-08-17, commit `04c8809`).**
   `api/shared/dailyQuota.js` now exports `checkAndIncrQuota`, an attempt-based counter (increments
   before the provider call, not after a persisted success) wired into both `POST
   /api/generation/drafts` and `POST /api/generation/expand` in `api/generationDrafts.js`.
   `checkAndIncrRegenQuota` is now a thin wrapper over the same helper. A failing/retried real-provider
   call now counts against the daily cap — a spend-cap alert (Azure OpenAI budget / Anthropic usage
   limit) is still good practice as a second backstop, but no longer a hard gate on activation.
4. **Flip `LLM_PROVIDER`** to `azureOpenai` or `anthropic` in Function App settings.
5. Confirm `api/shared/llmAdapter.js` returns 503 (not a 500 or a hang) if the key is ever removed
   or expires — this is already covered by `tests/unit/api/llmAdapter.test.js`'s
   missing-provider-key case, but re-verify against the live Function App once activated.

## Behavioural parity note

The adapter enforces the same ~60,000-character input cap for every provider, mock included —
this is deliberate (§3.7 of the CEO review addendum): if the mock behaved differently from a real
provider at the input-selection stage, that difference would only surface on activation day,
exactly when it's most expensive to debug.
