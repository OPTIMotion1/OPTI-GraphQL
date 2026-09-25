# Proof script for VoltCred superseded bug
# Device: 864540081618118 (ID: 449)

$ApiUrl = "https://api.voltcred.com/v2/graphql"
$Email = "support@optimotion.in"
$DeviceId = 449

Write-Host "`n=== VOLTCRED SUPERSEDED BUG PROOF ===" -ForegroundColor Cyan
Write-Host "Device: 864540081618118 (ID: 449)`n" -ForegroundColor White

# Login
Write-Host "[1] Logging in..." -ForegroundColor Green
$Password = Read-Host "Enter password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$LoginBody = @{
    query = 'mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success } }'
    variables = @{ email = $Email; password = $PlainPassword }
} | ConvertTo-Json

try {
    $LoginResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $LoginBody -ContentType "application/json" -Headers @{"Cookie"="device=web"}
    $Token = $LoginResult.data.sessionCreateV2.token
    Write-Host "Login OK`n" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit
}

# Get commands
Write-Host "[2] Fetching command history..." -ForegroundColor Green

$CommandsBody = @{
    query = 'query($deviceId: Int!) { deviceCommands(device_id: $deviceId) { id command_code status execution_time } }'
    variables = @{ deviceId = $DeviceId }
} | ConvertTo-Json

try {
    $CommandsResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $CommandsBody -ContentType "application/json" -Headers @{"Cookie"="authorization=$Token; device=web"}
    $Commands = $CommandsResult.data.deviceCommands
    Write-Host "Retrieved $($Commands.Count) commands`n" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit
}

# Display commands
Write-Host "=== COMMAND HISTORY ===" -ForegroundColor Cyan
foreach ($cmd in $Commands) {
    Write-Host "`nID: $($cmd.id)"
    Write-Host "  Type: $($cmd.command_code)"
    Write-Host "  Status: $($cmd.status)" -ForegroundColor Yellow
    Write-Host "  Time: $($cmd.execution_time)"
}

# Analyze
Write-Host "`n=== ANALYSIS ===" -ForegroundColor Cyan
$locks = $Commands | Where-Object { $_.command_code -eq "engine_cutoff" }
$activeLocks = $locks | Where-Object { $_.status -in @("sent","pending","delivered") }

if ($activeLocks.Count -gt 1) {
    Write-Host "`nBUG CONFIRMED!" -ForegroundColor Red
    Write-Host "Multiple lock commands have active status:" -ForegroundColor Yellow
    foreach ($lock in $activeLocks) {
        Write-Host "  - ID $($lock.id): $($lock.status) ($($lock.execution_time))"
    }
    Write-Host "`nExpected: Only the newest should be 'sent', older should be 'superseded'" -ForegroundColor White
} else {
    Write-Host "`nNo bug detected" -ForegroundColor Green
}

Write-Host "`n=== CURL COMMANDS TO SHARE ===" -ForegroundColor Cyan
Write-Host @"

# Step 1: Login
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: device=web' \
  --data '{"query":"mutation{sessionCreateV2(data:{email:\"support@optimotion.in\",password:\"PASSWORD\"}){token}}"}' 

# Step 2: Get Commands (replace TOKEN)
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: authorization=TOKEN; device=web' \
  --data '{"query":"query{deviceCommands(device_id:449){id command_code status execution_time}}"}'

"@

Write-Host "`nDone!`n" -ForegroundColor Green
