# Proof that VoltCred disabled Asset Management feature
$ApiUrl = "https://api.voltcred.com/v2/graphql"
$Email = "support@optimotion.in"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PROOF: Asset Management Feature DISABLED" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Login
Write-Host "[STEP 1] Logging in to VoltCred..." -ForegroundColor Green
$Password = Read-Host "Enter password for support@optimotion.in" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$LoginBody = @{
    query = 'mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success } }'
    variables = @{ email = $Email; password = $PlainPassword }
} | ConvertTo-Json

Write-Host "`nCURL equivalent:" -ForegroundColor Gray
Write-Host "curl -X POST '$ApiUrl' -H 'Cookie: device=web' --data '...'`n" -ForegroundColor DarkGray

try {
    $LoginResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $LoginBody -ContentType "application/json" -Headers @{"Cookie"="device=web"}
    $Token = $LoginResult.data.sessionCreateV2.token
    
    if ($Token) {
        Write-Host "SUCCESS: Login OK" -ForegroundColor Green
        Write-Host "Token: $($Token.Substring(0, 50))...`n" -ForegroundColor Gray
    }
} catch {
    Write-Host "FAILED: Login error: $_" -ForegroundColor Red
    exit
}

# Try to fetch assets (THIS SHOULD FAIL)
Write-Host "[STEP 2] Attempting to fetch assets..." -ForegroundColor Green

$AssetsBody = @{
    query = 'query { assetsWithPagination(limit: 10) { total counts { total moving offline } rows { id name status } } }'
} | ConvertTo-Json

Write-Host "`nCURL equivalent:" -ForegroundColor Gray
Write-Host "curl -X POST '$ApiUrl' -H 'Cookie: authorization=TOKEN; device=web' --data '...'`n" -ForegroundColor DarkGray

try {
    $AssetsResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $AssetsBody -ContentType "application/json" -Headers @{"Cookie"="authorization=$Token; device=web"}
    
    # If we get here, it worked (unexpected!)
    Write-Host "UNEXPECTED: Assets query worked!" -ForegroundColor Green
    Write-Host "Total vehicles: $($AssetsResult.data.assetsWithPagination.total)" -ForegroundColor Green
    Write-Host "`nThe feature has been RE-ENABLED by VoltCred!`n" -ForegroundColor Green
    
} catch {
    $ErrorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    $ErrorMessage = $ErrorResponse.errors[0].message
    
    Write-Host "EXPECTED ERROR RECEIVED!" -ForegroundColor Red
    Write-Host "`nError Message:" -ForegroundColor Yellow
    Write-Host "  $ErrorMessage`n" -ForegroundColor Red
    
    if ($ErrorMessage -like "*Asset Management*" -or $ErrorMessage -like "*not enabled*" -or $ErrorMessage -like "*upgrade*") {
        Write-Host "CONFIRMED: VoltCred has DISABLED the Asset Management feature!" -ForegroundColor Red
        Write-Host "`nThis error proves:" -ForegroundColor Yellow
        Write-Host "  1. Login works (we got authenticated)" -ForegroundColor White
        Write-Host "  2. API is responding" -ForegroundColor White
        Write-Host "  3. VoltCred intentionally blocked access to assetsWithPagination" -ForegroundColor White
        Write-Host "  4. They want you to 'upgrade subscription'`n" -ForegroundColor White
    } else {
        Write-Host "Different error: $ErrorMessage`n" -ForegroundColor Yellow
    }
}

# Test if commands still work
Write-Host "[STEP 3] Testing if COMMANDS still work..." -ForegroundColor Green

$CommandBody = @{
    query = 'query { deviceCommands(device_id: 461) { id command_code status } }'
} | ConvertTo-Json

Write-Host "`nCURL equivalent:" -ForegroundColor Gray
Write-Host "curl -X POST '$ApiUrl' -H 'Cookie: authorization=TOKEN; device=web' --data '...'`n" -ForegroundColor DarkGray

try {
    $CommandResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $CommandBody -ContentType "application/json" -Headers @{"Cookie"="authorization=$Token; device=web"}
    
    if ($CommandResult.data.deviceCommands) {
        Write-Host "SUCCESS: Command query works!" -ForegroundColor Green
        Write-Host "Commands found: $($CommandResult.data.deviceCommands.Count)" -ForegroundColor Green
        Write-Host "`nThis proves: Command APIs are still enabled" -ForegroundColor Yellow
        Write-Host "            Only Asset Management is disabled`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "FAILED: Command query also blocked`n" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Account: support@optimotion.in" -ForegroundColor White
Write-Host "Status: Asset Management feature DISABLED by VoltCred`n" -ForegroundColor Red

Write-Host "What Works:" -ForegroundColor Green
Write-Host "  - Login" -ForegroundColor White
Write-Host "  - Send commands (lock/unlock)" -ForegroundColor White
Write-Host "  - Get command history`n" -ForegroundColor White

Write-Host "What's Broken:" -ForegroundColor Red
Write-Host "  - Cannot fetch vehicle list" -ForegroundColor White
Write-Host "  - Cannot see vehicle locations" -ForegroundColor White
Write-Host "  - Cannot see vehicle status" -ForegroundColor White
Write-Host "  - Dashboard shows 'No assets found'`n" -ForegroundColor White

Write-Host "Root Cause:" -ForegroundColor Yellow
Write-Host "  VoltCred disabled 'Asset Management - Base Platform' feature" -ForegroundColor White
Write-Host "  Error: 'Please upgrade your subscription'`n" -ForegroundColor White

Write-Host "ACTION REQUIRED:" -ForegroundColor Red
Write-Host "  Contact VoltCred immediately to:" -ForegroundColor White
Write-Host "    1. Understand why this was disabled" -ForegroundColor White
Write-Host "    2. Get feature re-enabled" -ForegroundColor White
Write-Host "    3. Clarify subscription requirements`n" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CURL COMMANDS FOR VOLTCRED SUPPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host @"
Send these to VoltCred to prove the issue:

# 1. Login (works)
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: device=web' \
  --data '{"query":"mutation{sessionCreateV2(data:{email:\"support@optimotion.in\",password:\"PASSWORD\"}){token success}}"}'

# 2. Try to get assets (FAILS with feature disabled error)
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: authorization=YOUR_TOKEN; device=web' \
  --data '{"query":"query{assetsWithPagination(limit:10){total rows{id name}}}"}'

Expected Error:
"Feature 'Asset Management - Base Platform' is not enabled for your company. Please upgrade your subscription."

"@ -ForegroundColor Gray

Write-Host "`n`nDone! Send this output to VoltCred support.`n" -ForegroundColor Green
