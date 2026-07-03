# Azure API Management — Setup & Rate-Limit Policies

This document covers the one-time Azure Portal steps to create an API Management instance,
import the Function App, and configure the per-endpoint rate-limit policies that replace the
in-memory `rateLimit.js` sliding window. The in-memory store was per-instance and not shared
across replicas; APIM enforces limits globally.

> **Correction (2026-07-03):** this doc previously recommended Consumption tier for the
> rate-limit policies below. **That's wrong — Consumption tier rejects `rate-limit-by-key`
> outright** (`ValidationError: Policy is not allowed in 'Consumption' sku`), confirmed against
> the live `quizpulse-apim-av5z18` instance. Consumption tier has no dedicated compute for the
> counter state rate-limit policies need. If you want the policies in this doc to actually work,
> provision **Developer tier** (~$50/mo, no SLA — fine for a pilot) or **Basic tier** (~$150/mo,
> has SLA) instead. See CLAUDE.md Known issues for the current decision status — as of this
> writing, the app has chosen to leave APIM as a monitoring-only sidecar rather than pay for a
> tier upgrade, so rate limiting remains a no-op in production.

---

## Why Consumption tier was picked (and why it doesn't fully work)

Consumption tier has:
- No idle cost (billed per call, ~$3.50 per million calls — well within the $100 budget)
- Shared gateway infrastructure (no VNet required)
- Scales automatically

But it does **not** support `rate-limit` / `rate-limit-by-key` policies (see correction above),
which is most of what this doc exists to configure. It's fine for API import + monitoring, not
for the throttling this doc's Step 3 describes.

Other limitations: no custom domains (not needed yet), no caching policies (not used yet).

---

## Step 1 — Create the APIM instance

**Already done.** `quizpulse-apim-av5z18` exists — but note it landed in **`quizpulse-rg`**, not
`quizpulse-app-rg` like every other app resource (verified 2026-07-03; harmless but inconsistent
naming, don't "fix" it by recreating — APIM names are globally unique across all of Azure and
recreating means picking a new name). If provisioning from scratch elsewhere:

1. Azure Portal → **+ Create a resource** → search "API Management"
2. Fill in:
   - **Resource name**: `quizpulse-apim-av5z18` (or a new globally-unique name if that one's taken)
   - **Resource group**: `quizpulse-app-rg` (keep it consistent with everything else)
   - **Region**: Australia East (same as the Function App)
   - **Organization name**: QuizPulse
   - **Administrator email**: admin@quizpulse.app
   - **Pricing tier**: **Developer** or **Basic**, not Consumption — see correction at the top of
     this doc
3. Click **Review + Create** → **Create** (Consumption takes ~5 min; Developer/Basic ~30-45 min)

---

## Step 2 — Import the Function App

**Already done, kept in sync as of 2026-07-03** — the `quizpulse-app-api-av5z18` API in APIM has
all 50 current operations (re-synced same day as the v4.0.0 deploy via direct ARM calls, since the
Azure CLI's `az apim api import` doesn't support `--specification-format Function` for re-import —
new operations were added individually with `az rest --method put .../operations/{id}`). Re-check
this list after any sprint that adds/removes an endpoint; it does not auto-sync with deploys.

1. In the new APIM resource → **APIs** → **+ Add API** → **Function App**
2. Select `quizpulse-app-api-av5z18` and import all functions
3. Set **API URL suffix**: (leave blank — functions already have `/api/` prefix)
4. Save

After import, APIM will proxy all requests to the Function App. The SWA linked backend still
hits APIM, so the chain is: Browser → SWA → APIM → Function App.

> **CORS note:** After adding APIM as an intermediary, CORS is handled at SWA (browser ↔ SWA),
> not at the Function App (SWA ↔ APIM ↔ Functions is server-to-server). No additional CORS
> config needed.

---

## Step 3 — Configure rate-limit policies

Open the **Design** tab of the imported API. Use the **Policy editor** on each scope described
below. Policies are applied in order: global → product → API → operation.

### 3a — Global inbound policy (all operations, 30 req/min/IP)

```xml
<policies>
  <inbound>
    <rate-limit-by-key
      calls="30"
      renewal-period="60"
      counter-key="@(context.Request.IpAddress)"
      increment-condition="@(true)"
      remaining-calls-header-name="X-RateLimit-Remaining"
      retry-after-header-name="Retry-After" />
    <base />
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
```

### 3b — POST /api/send-notification (5 req/min/teacher)

Scope: operation `sendNotification` → **Inbound** policy

```xml
<inbound>
  <rate-limit-by-key
    calls="5"
    renewal-period="60"
    counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","anon"))"
    increment-condition="@(true)" />
  <base />
</inbound>
```

> The `Authorization` header carries the teacher's MSAL ID token, making it a
> per-token limit. For a stricter per-teacher limit, extract the `oid` claim from the JWT
> using `<set-variable name="oid" value="@(((Jwt)context.Variables["jwt"]).Claims["oid"][0])" />`
> after a `<validate-jwt>` step.

### 3c — GET /api/analytics/export (10 req/hr/teacher)

Scope: operation `analyticsExport` → **Inbound** policy

```xml
<inbound>
  <rate-limit-by-key
    calls="10"
    renewal-period="3600"
    counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","anon"))" />
  <base />
</inbound>
```

### 3d — GET /api/manage/metrics (60 req/hr/teacher)

Scope: operation `manageMetrics` → **Inbound** policy

```xml
<inbound>
  <rate-limit-by-key
    calls="60"
    renewal-period="3600"
    counter-key="@(context.Request.Headers.GetValueOrDefault("Authorization","anon"))" />
  <base />
</inbound>
```

### 3e — POST /api/subscribe (20 req/hr — keyed by Authorization + IP)

Scope: operation `subscribe` → **Inbound** policy

```xml
<inbound>
  <rate-limit-by-key
    calls="20"
    renewal-period="3600"
    counter-key="@(context.Request.IpAddress)" />
  <base />
</inbound>
```

---

## Step 4 — Update the SWA backend URL

After APIM is set up, the SWA linked backend should point to APIM rather than the Function App
directly. This ensures all traffic passes through APIM's rate limiting and monitoring.

1. Azure Portal → Static Web Apps → `nice-field-0127b5b00` → **Settings → APIs**
2. Unlink the current Function App backend
3. Re-link using **APIM** as the backend type (if SWA supports APIM linked backend)
   - If SWA doesn't support APIM directly, set the Function App's backend URL in APIM and
     leave SWA pointing at the Function App. APIM's subscription key or IP restriction can
     then block direct-to-Functions traffic, forcing all calls through APIM.

> **Simple alternative:** Leave SWA → Function App direct, and configure APIM's IP restriction
> to only allow the SWA outbound IPs. This isn't available on Consumption plan (no static IPs),
> so it requires upgrading to Developer tier. For now, APIM sits as a sidecar for monitoring
> and rate limiting, with the Function App still accessible directly from SWA.

---

## What the in-memory rateLimit.js used to enforce

For reference, these limits from the security table were enforced in-process. APIM policies
above replace them:

| Endpoint | Old limit | APIM policy |
|---|---|---|
| General | 30 req/min/IP | Step 3a (global) |
| send-notification | 5 req/min/teacher | Step 3b |
| analytics CSV export | 10/hr/teacher | Step 3c |
| manage/metrics | 60 req/hr/teacher | Step 3d |
| subscribe | 20/hr/IP | Step 3e |
| quizzes:create | 10 req/min/IP | covered by 3a global |

The school-merge serialisation lock (1 concurrent merge platform-wide) is **not** handled by
APIM — it uses a module-level boolean flag in `api/schoolAdmin.js` because it is a concurrency
guard, not a throughput limit.

---

## Monitoring

APIM emits metrics to Azure Monitor automatically:
- **TotalRequests**, **SuccessfulRequests**, **BlockedRequests** (rate-limited)
- **Latency** (gateway to backend)

View in Azure Portal → APIM → **Monitoring → Metrics**, or create an Application Insights
integration (Settings → Application Insights → attach existing AI resource).
