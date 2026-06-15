<#
.SYNOPSIS
  Provisions the QuizPulse Azure infrastructure for the Sprint 1 (v1.0.0) PWA rebuild.

.DESCRIPTION
  Creates a dedicated resource group and all resources: Cosmos DB (serverless),
  Storage, Function App (Linux, Node 24, Functions v4, Consumption), Static Web App (Free),
  Key Vault (RBAC) with the Cosmos key, and Application Insights with a 1 GB daily cap.

  Re-running is largely idempotent (most `az ... create` calls are no-ops if the resource
  already exists). The script never writes secrets to disk in the repo.

  NOTE: The Azure AD B2C tenant is created manually in the portal — see docs/azure/B2C_SETUP.md.

.EXAMPLE
  pwsh ./scripts/azure/provision.ps1 -Suffix av5z18
#>
param(
  [string]$ResourceGroup = "quizpulse-app-rg",
  [string]$Location      = "australiaeast",
  [string]$SwaLocation   = "eastasia",
  [Parameter(Mandatory = $true)][string]$Suffix
)

$ErrorActionPreference = "Stop"

$cosmos   = "quizpulse-app-db-$Suffix"
$storage  = "quizpulseappst$Suffix"
$func     = "quizpulse-app-api-$Suffix"
$kv       = "quizpulse-app-kv-$Suffix"
$ai       = "quizpulse-app-insights"
$swa      = "quizpulse-app-swa"
$db       = "quizpulse"

Write-Host "==> Resource group"
az group create --name $ResourceGroup --location $Location -o none

Write-Host "==> Cosmos DB (serverless)"
az cosmosdb create --name $cosmos --resource-group $ResourceGroup `
  --locations regionName=$Location failoverPriority=0 isZoneRedundant=False `
  --capabilities EnableServerless --default-consistency-level Session -o none
az cosmosdb sql database create --account-name $cosmos --resource-group $ResourceGroup --name $db -o none

$containers = @(
  @{ n = "questions"; pk = "/teacherId" },
  @{ n = "quizzes";   pk = "/teacherId" },
  @{ n = "responses"; pk = "/quizId" },
  @{ n = "pageviews"; pk = "/teacherId" },
  @{ n = "classes";   pk = "/teacherId" },
  @{ n = "schools";   pk = "/id" }
)
foreach ($c in $containers) {
  az cosmosdb sql container create --account-name $cosmos --resource-group $ResourceGroup `
    --database-name $db --name $c.n --partition-key-path $c.pk -o none
}

Write-Host "==> Application Insights (+ 1 GB daily cap)"
az extension add --name application-insights --only-show-errors 2>$null
az monitor app-insights component create --app $ai --location $Location --resource-group $ResourceGroup --application-type web --only-show-errors -o none
az monitor app-insights component billing update --app $ai --resource-group $ResourceGroup --cap 1.0 --only-show-errors -o none

Write-Host "==> Storage + Function App (Linux, Node 24, Functions v4)"
az storage account create --name $storage --resource-group $ResourceGroup --location $Location --sku Standard_LRS --kind StorageV2 --only-show-errors -o none
az functionapp create --name $func --resource-group $ResourceGroup --storage-account $storage `
  --consumption-plan-location $Location --runtime node --runtime-version 24 `
  --functions-version 4 --os-type Linux --app-insights $ai --assign-identity "[system]" --only-show-errors -o none

Write-Host "==> Key Vault (RBAC) + Cosmos key secret + role grants"
az keyvault create --name $kv --resource-group $ResourceGroup --location $Location --enable-rbac-authorization true --only-show-errors -o none
$kvId = az keyvault show --name $kv --resource-group $ResourceGroup --query id -o tsv
$me   = az ad signed-in-user show --query id -o tsv
az role assignment create --assignee $me --role "Key Vault Secrets Officer" --scope $kvId --only-show-errors -o none
$faPrincipal = az functionapp identity show --name $func --resource-group $ResourceGroup --query principalId -o tsv
az role assignment create --assignee-object-id $faPrincipal --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope $kvId --only-show-errors -o none

$cosmosKey = az cosmosdb keys list --name $cosmos --resource-group $ResourceGroup --query primaryMasterKey -o tsv
for ($i = 1; $i -le 6; $i++) {
  az keyvault secret set --vault-name $kv --name "COSMOS-KEY" --value $cosmosKey --only-show-errors -o none
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 15
}

Write-Host "==> Function App settings (Cosmos + Key Vault reference)"
$kvRef = "@Microsoft.KeyVault(VaultName=$kv;SecretName=COSMOS-KEY)"
az functionapp config appsettings set --name $func --resource-group $ResourceGroup --only-show-errors -o none --settings `
  "COSMOS_ENDPOINT=https://$cosmos.documents.azure.com:443/" `
  "COSMOS_DATABASE=$db" "COSMOS_CONTAINER_QUESTIONS=questions" `
  "COSMOS_CONTAINER_QUIZZES=quizzes" "COSMOS_CONTAINER_RESPONSES=responses"
# The Key Vault reference contains () and ; — pass it via a temp JSON file to avoid Windows
# az.cmd argument re-parsing breaking on those characters.
$tmp = New-TemporaryFile
"[{`"name`":`"COSMOS_KEY`",`"value`":`"$kvRef`",`"slotSetting`":false}]" | Out-File $tmp -Encoding ascii
az functionapp config appsettings set --name $func --resource-group $ResourceGroup --only-show-errors -o none --settings "@$tmp"
Remove-Item $tmp -Force

Write-Host "==> Static Web App (Free)"
az staticwebapp create --name $swa --resource-group $ResourceGroup --location $SwaLocation --sku Free --only-show-errors -o none
$swaHost = az staticwebapp show --name $swa --resource-group $ResourceGroup --query defaultHostname -o tsv

Write-Host "==> Function App CORS"
az functionapp cors add --name $func --resource-group $ResourceGroup --allowed-origins "https://$swaHost" "http://localhost:5173" --only-show-errors -o none

Write-Host ""
Write-Host "Done. SWA host: https://$swaHost"
Write-Host "Function App:   https://$func.azurewebsites.net/api"
Write-Host "Next: store the SWA deploy token as the GitHub secret AZURE_STATIC_WEB_APPS_API_TOKEN:"
Write-Host "  az staticwebapp secrets list --name $swa --resource-group $ResourceGroup --query properties.apiKey -o tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN"
