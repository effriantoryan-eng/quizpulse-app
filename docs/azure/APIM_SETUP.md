# Azure API Management — Setup & Rate-Limit Policies

This document covers the one-time Azure Portal steps to create an API Management instance in
Consumption tier, import the Function App, and configure the per-endpoint rate-limit policies
that replace the in-memory `rateLimit.js` sliding window. The in-memory store was per-instance
and not shared across replicas; APIM enforces limits globally.

---

## Why Consumption tier

Consumption tier has:
- No idle cost (billed per call, ~$3.50 per million calls — well within the $100 budget)
- Shared gateway infrastructure (no VNet required)
- Full policy engine (rate limiting, JWT validation, caching)
- Scales automatically

Limitations: no custom domains (not needed yet), no caching policies (not used yet).

---

## Step 1 — Create the APIM instance

1. Azure Portal → **+ Create a resource** → search "API Management"
2. Fill in:
   - **Resource name**: `quizpulse-apim-av5z18`
   - **Resource group**: `quizpulse-app-rg`
   - **Region**: Australia East (same as the Function App)
   - **Organization name**: QuizPulse
   - **Administrator email**: admin@quizpulse.app
   - **Pricing tier**: Consumption
3. Click **Review + Create** → **Create** (takes ~5 minutes)

---

## Step 2 — Import the Function App

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
