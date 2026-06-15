# QuizPulse — Azure Infrastructure (Sprint 1, v1.0.0)

This project runs in a **dedicated, brand-new resource group** created for the PWA rebuild.
It is fully separate from the original `quizpulse-rg` / `quizpulse-pwa-test-rg`.

## Subscription & resource group

| Item | Value |
|---|---|
| Subscription | `Azure subscription 1` (`5ef66cdf-40e2-40af-9720-a9c881171fa9`) |
| Resource group | `quizpulse-app-rg` |
| Primary region | `australiaeast` (SWA in `eastasia` — nearest SWA-supported region) |
| Unique suffix | `av5z18` |

## Resources

| Resource | Name | Notes |
|---|---|---|
| Cosmos DB (NoSQL, **serverless**) | `quizpulse-app-db-av5z18` | Endpoint `https://quizpulse-app-db-av5z18.documents.azure.com:443/` |
| Cosmos database | `quizpulse` | Containers below |
| Storage account | `quizpulseappstav5z18` | Backs the Function App |
| Function App (Linux, Node 24, Functions v4, Consumption) | `quizpulse-app-api-av5z18` | `https://quizpulse-app-api-av5z18.azurewebsites.net/api` |
| Static Web App (Free) | `quizpulse-app-swa` | `https://nice-field-0127b5b00.7.azurestaticapps.net` |
| Key Vault (RBAC) | `quizpulse-app-kv-av5z18` | Holds secret `COSMOS-KEY` |
| Application Insights | `quizpulse-app-insights` | Daily cap **1 GB** |

## Cosmos containers (partition keys)

| Container | Partition key | Sprint |
|---|---|---|
| `questions` | `/teacherId` | current |
| `quizzes` | `/teacherId` | current |
| `responses` | `/quizId` | current |
| `pageviews` | `/teacherId` | current (auto-created by `pageView.js`) |
| `classes` | `/teacherId` | **Sprint 1** (real CRUD) |
| `schools` | `/id` | **Sprint 1** (school identity model) |

## Secrets & identity

- Function App has a **system-assigned managed identity** (`60c2cde6-f6d2-49b2-a231-193609d605de`).
- It holds the **Key Vault Secrets User** role on `quizpulse-app-kv-av5z18`.
- `COSMOS_KEY` app setting is a Key Vault reference:
  `@Microsoft.KeyVault(VaultName=quizpulse-app-kv-av5z18;SecretName=COSMOS-KEY)`.
- B2C app settings (`B2C_TENANT_NAME`, `B2C_TENANT_ID`, `B2C_CLIENT_ID`, `B2C_POLICY`) are
  populated after the B2C tenant is created (see `docs/azure/B2C_SETUP.md`).

## CORS

The frontend calls the Function App **directly** (SWA free tier does not proxy POST/PUT/DELETE —
see CLAUDE.md). Function App platform CORS allows:

- `https://nice-field-0127b5b00.7.azurestaticapps.net`
- `http://localhost:5173`

## Deploy

- **Frontend** — push to `main` → GitHub Actions (`.github/workflows/azure-static-web-apps.yml`)
  builds and deploys to SWA. Token stored in repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
- **API** — deployed separately whenever `api/` changes:

  ```powershell
  cd api
  func azure functionapp publish quizpulse-app-api-av5z18
  ```

## Reprovision

All commands used to create this infrastructure are scripted in
`scripts/azure/provision.ps1` (idempotent where possible). Secrets are never stored in the repo.
