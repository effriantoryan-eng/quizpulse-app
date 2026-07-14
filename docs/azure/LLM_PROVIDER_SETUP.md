# v4.3.0 — LLM Provider Setup (AI Quiz Generation)

The sprint ships and is tested entirely against the **mock provider** (`LLM_PROVIDER=mock`,
the default) — no real LLM API key is required to build, test, or use v4.3.0 in its default
state. This doc covers activating a real provider later.

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
3. **Switch quota semantics** — the shipped quota (`api/shared/dailyQuota.js`) counts
   **successful** generations/uploads only. Before activating a real (paid) provider, either:
   - switch quota counting to attempt-based (count every call, success or failure), **or**
   - set a hard provider-side spend cap (Azure OpenAI budget alert / Anthropic usage limit).
   Skipping this step means a buggy client retry loop could burn unlimited real-provider spend
   without ever tripping the daily quota, since failed attempts don't count against it today.
4. **Flip `LLM_PROVIDER`** to `azureOpenai` or `anthropic` in Function App settings.
5. Confirm `api/shared/llmAdapter.js` returns 503 (not a 500 or a hang) if the key is ever removed
   or expires — this is already covered by `tests/unit/api/llmAdapter.test.js`'s
   missing-provider-key case, but re-verify against the live Function App once activated.

## Behavioural parity note

The adapter enforces the same ~60,000-character input cap for every provider, mock included —
this is deliberate (§3.7 of the CEO review addendum): if the mock behaved differently from a real
provider at the input-selection stage, that difference would only surface on activation day,
exactly when it's most expensive to debug.
