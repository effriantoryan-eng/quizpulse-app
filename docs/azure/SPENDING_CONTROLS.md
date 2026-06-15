# Azure spending controls — QuizPulse

Hard monthly limit: **$100 USD**. If the budget is reached, the Function App is
automatically stopped (API → 503). The SWA frontend keeps serving. Re-enable manually
after reviewing the bill.

---

## 1. Create the $100 budget

1. Azure Portal → **Cost Management + Billing** → **Cost Management** → **Budgets**
2. Click **+ Add**
3. Scope: subscription (or resource group `quizpulse-app-rg` for tighter scoping)
4. Name: `quizpulse-monthly-100`
5. Reset period: **Monthly**
6. Budget amount: **$100**
7. Click **Next**

---

## 2. Add budget alerts

Still in the budget wizard, add three alert conditions:

| Alert type | % of budget | Recipients |
|---|---|---|
| Actual | 50% | your email |
| Actual | 80% | your email |
| Actual | 100% | Action Group (see §3) |

The 50% and 80% alerts are email-only (notification, no automated action).

---

## 3. Create an Action Group for the 100% alert

1. Azure Portal → **Monitor** → **Alerts** → **Action groups** → **+ Create**
2. Resource group: `quizpulse-app-rg`
3. Action group name: `quizpulse-budget-stop`
4. Display name: `budget-stop`
5. Under **Actions**, add:
   - Action type: **Automation Runbook**
   - Runbook source: **User** (select the Automation Account and runbook — see §4)
6. Save

---

## 4. Set up Azure Automation + runbook

### 4a. Create Automation Account

1. Azure Portal → **Automation Accounts** → **+ Create**
2. Resource group: `quizpulse-app-rg`
3. Name: `quizpulse-automation`
4. Region: `Australia East`
5. Enable **System-assigned managed identity** on the Identity tab

### 4b. Grant the Automation Account access

The managed identity needs rights to stop the Function App and update its settings:

```powershell
$automationPrincipalId = "<paste object ID from Automation Account → Identity>"
$resourceGroup = "quizpulse-app-rg"
$functionApp = "quizpulse-app-api-av5z18"

$scope = (Get-AzWebApp -ResourceGroupName $resourceGroup -Name $functionApp).Id

New-AzRoleAssignment `
    -ObjectId $automationPrincipalId `
    -RoleDefinitionName "Website Contributor" `
    -Scope $scope
```

### 4c. Import Az modules

In the Automation Account → **Modules** → **Browse gallery**, import:
- `Az.Accounts`
- `Az.Websites`
- `Az.Functions`

(Import in that order; `Az.Accounts` must finish first.)

### 4d. Create the runbook

1. Automation Account → **Runbooks** → **+ Create a runbook**
2. Name: `disable-on-budget`
3. Runbook type: **PowerShell**
4. Runtime version: **7.2**
5. Paste the contents of `scripts/azure/disable-on-budget.ps1`
6. **Save** then **Publish**
7. Test it manually once with `ResourceGroupName` and `FunctionAppName` params filled in

### 4e. Wire runbook to Action Group

Go back to the Action Group created in §3 → Actions → select the Automation Runbook
you just published.

---

## 5. Per-resource caps

### Cosmos DB — RU cap per container

1. Azure Portal → `quizpulse-app-db-av5z18` → **Data Explorer**
2. For each container (`questions`, `quizzes`, `responses`, `classes`, `schools`, `teachers`):
   - Click the container → **Settings** → **Scale**
   - Set **Max RU/s** to **400** (minimum for serverless; adjust upward only if needed)
   - Cosmos serverless bills per actual RU consumed, so this is a soft guidance cap only —
     serverless containers do not have a configurable hard RU ceiling. Monitor via
     **Cost Management** → **Cost by resource**.

### Function App — execution throttle (host.json)

`api/host.json` is already configured with:

```json
{
  "functionTimeout": "00:05:00",
  "extensions": {
    "http": {
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100,
      "dynamicThrottlesEnabled": true
    }
  }
}
```

For the **daily execution quota** (hard stop in portal):

1. Azure Portal → `quizpulse-app-api-av5z18` → **Settings** → **Configuration** → **General settings**
2. Set **Daily Usage Quota (GB-s)**: `400` — ~13 GB-seconds/hour peak, comfortable for demo load.
   The Function App will stop accepting requests for the rest of the day if the quota is hit,
   preventing runaway costs from a bug or attack.

### App Insights — daily data cap

1. Azure Portal → `quizpulse-app-insights-av5z18` → **Usage and estimated costs** → **Daily cap**
2. Set cap to **1 GB/day**
3. Enable the email alert when cap is reached

---

## 6. Re-enabling after a shutdown

After the budget runbook fires:

```powershell
$rg  = "quizpulse-app-rg"
$app = "quizpulse-app-api-av5z18"
$kvRef = "@Microsoft.KeyVault(VaultName=quizpulse-app-kv-av5z18;SecretName=COSMOS-KEY)"

# Restore the Key Vault reference for COSMOS_KEY
Update-AzFunctionAppSetting -ResourceGroupName $rg -Name $app `
    -AppSetting @{ COSMOS_KEY = $kvRef } -Force

# Start the Function App
Start-AzWebApp -ResourceGroupName $rg -Name $app
```

Verify the app is healthy: `curl https://quizpulse-app-api-av5z18.azurewebsites.net/api/health`
(if a health endpoint exists) or check Application Insights live metrics.
