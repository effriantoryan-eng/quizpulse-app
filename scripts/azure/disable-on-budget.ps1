# disable-on-budget.ps1
# Azure Automation PowerShell runbook. Triggered by an Action Group when the $100/month
# budget threshold is reached in Azure Cost Management.
#
# What it does:
#   1. Overwrites COSMOS_KEY with a placeholder so the app can't talk to the database even
#      if the Function App is manually restarted before the bill is reviewed.
#   2. Stops the Function App — all HTTP requests will return 503 Service Unavailable.
#      The SWA frontend continues serving the static shell.
#
# Re-enable manually:
#   Set COSMOS_KEY back to the Key Vault reference (see below) then start the app.
#
# Prerequisites:
#   - Automation Account must have Contributor or Website Contributor role on the Function App.
#   - Az.Accounts, Az.Websites, Az.Functions modules must be imported into the Automation Account.
#   - System-assigned managed identity enabled on the Automation Account.

param(
    [string]$ResourceGroupName = "quizpulse-app-rg",
    [string]$FunctionAppName   = "quizpulse-app-api-av5z18",
    [string]$KeyVaultRef       = "@Microsoft.KeyVault(VaultName=quizpulse-app-kv-av5z18;SecretName=COSMOS-KEY)"
)

$ErrorActionPreference = "Stop"

Write-Output "Budget limit reached. Disabling Function App '$FunctionAppName'..."

# Authenticate using the Automation Account's system-assigned managed identity.
Connect-AzAccount -Identity | Out-Null

# Step 1 — Overwrite the Cosmos DB key with a placeholder value.
# This survives a restart; the app will fail all DB operations until the key is restored.
$dummyKey = @{ COSMOS_KEY = "BUDGET_LIMIT_REACHED__DISABLED_$(Get-Date -Format 'yyyyMMdd')" }
Update-AzFunctionAppSetting `
    -ResourceGroupName $ResourceGroupName `
    -Name $FunctionAppName `
    -AppSetting $dummyKey `
    -Force | Out-Null

Write-Output "COSMOS_KEY replaced with placeholder. App will not access the database."

# Step 2 — Stop the Function App (HTTP → 503).
Stop-AzWebApp -ResourceGroupName $ResourceGroupName -Name $FunctionAppName | Out-Null

Write-Output "Function App stopped. API is now returning 503 Service Unavailable."
Write-Output ""
Write-Output "--- TO RE-ENABLE ---"
Write-Output "1. Review and confirm the Azure bill."
Write-Output "2. Restore COSMOS_KEY app setting to the Key Vault reference:"
Write-Output "   $KeyVaultRef"
Write-Output "3. Start the Function App:"
Write-Output "   Start-AzWebApp -ResourceGroupName $ResourceGroupName -Name $FunctionAppName"
Write-Output "--------------------"
