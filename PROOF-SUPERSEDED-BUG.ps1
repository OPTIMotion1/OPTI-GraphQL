# ========================================
# PROOF: VoltCred "superseded" Status Bug
# Device: 864540081618118 (ID: 449)
# ========================================

$ApiUrl = "https://api.voltcred.com/v2/graphql"
$Email = "support@optimotion.in"
$DeviceId = 449

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PROOF: VoltCred 'superseded' Status Bug" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Device: 864540081618118" -ForegroundColor White
Write-Host "Device ID: 449" -ForegroundColor White
Write-Host "Issue: Multiple commands show 'sent' instead of 'superseded'`n" -ForegroundColor Yellow

# ========================================
# STEP 1: LOGIN
# ========================================
Write-Host "[STEP 1] Logging in..." -ForegroundColor Green

$Password = Read-Host "Enter password for support@optimotion.in" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$LoginQuery = @{
    query = "mutation Login(`$email: String!, `$password: String!) { sessionCreateV2(data: { email: `$email, password: `$password }) { token success messageKey } }"
    variables = @{
        email = $Email
        password = $PlainPassword
    }
} | ConvertTo-Json -Compress

$LoginHeaders = @{
    "Content-Type" = "application/json"
    "Cookie" = "device=web"
}

Write-Host "`nCURL Command:" -ForegroundColor Gray
Write-Host "curl -X POST '$ApiUrl' -H 'Content-Type: application/json' -H 'Cookie: device=web' --data-raw '{...login mutation...}'`n" -ForegroundColor DarkGray

try {
    $LoginResponse = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $LoginHeaders -Body $LoginQuery
    $Token = $LoginResponse.data.sessionCreateV2.token
    
    if ($Token) {
        Write-Host "✓ Login successful!" -ForegroundColor Green
        Write-Host "Token: $($Token.Substring(0, 50))...`n" -ForegroundColor Gray
    } else {
        Write-Host "✗ Login failed!" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "✗ Login error: $_" -ForegroundColor Red
    exit
}

# ========================================
# STEP 2: GET COMMAND HISTORY
# ========================================
Write-Host "[STEP 2] Fetching command history for device $DeviceId..." -ForegroundColor Green

$CommandsQuery = @{
    query = "query GetCommands(`$deviceId: Int!) { deviceCommands(device_id: `$deviceId) { id command_code status execution_time response } }"
    variables = @{
        deviceId = $DeviceId
    }
} | ConvertTo-Json -Compress

$Headers = @{
    "Content-Type" = "application/json"
    "Cookie" = "authorization=$Token; device=web"
}

Write-Host "`nCURL Command:" -ForegroundColor Gray
Write-Host "curl -X POST '$ApiUrl' -H 'Cookie: authorization=TOKEN; device=web' --data-raw '{...deviceCommands query...}'`n" -ForegroundColor DarkGray

try {
    $CommandsResponse = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $Headers -Body $CommandsQuery
    $Commands = $CommandsResponse.data.deviceCommands
    
    if (!$Commands -or $Commands.Count -eq 0) {
        Write-Host "⚠️  No commands found for this device" -ForegroundColor Yellow
        exit
    }
    
    Write-Host "✓ Command history retrieved: $($Commands.Count) commands`n" -ForegroundColor Green
    
} catch {
    Write-Host "✗ Error fetching commands: $_" -ForegroundColor Red
    exit
}

# ========================================
# STEP 3: ANALYZE THE BUG
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COMMAND HISTORY (Raw API Response)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Group commands by type
$engineCutoffCommands = $Commands | Where-Object { $_.command_code -eq "engine_cutoff" }
$engineRestoreCommands = $Commands | Where-Object { $_.command_code -eq "engine_restore" }

Write-Host "Total Commands: $($Commands.Count)" -ForegroundColor White
Write-Host "Lock (engine_cutoff): $($engineCutoffCommands.Count)" -ForegroundColor White
Write-Host "Unlock (engine_restore): $($engineRestoreCommands.Count)`n" -ForegroundColor White

# Display all commands
foreach ($cmd in $Commands) {
    $statusColor = switch ($cmd.status) {
        "sent" { "Yellow" }
        "delivered" { "Green" }
        "completed" { "Green" }
        "failed" { "Red" }
        "superseded" { "Gray" }
        "pending" { "Cyan" }
        default { "White" }
    }
    
    $emoji = switch ($cmd.command_code) {
        "engine_cutoff" { "🔒" }
        "engine_restore" { "🔓" }
        default { "•" }
    }
    
    Write-Host "$emoji Command ID: $($cmd.id)" -ForegroundColor White
    Write-Host "   Type: $($cmd.command_code)" -ForegroundColor Gray
    Write-Host "   Status: $($cmd.status)" -ForegroundColor $statusColor
    Write-Host "   Time: $($cmd.execution_time)" -ForegroundColor Gray
    if ($cmd.response) {
        Write-Host "   Response: $($cmd.response)" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# ========================================
# STEP 4: CHECK FOR BUG
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BUG ANALYSIS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$bugFound = $false

# Check lock commands
if ($engineCutoffCommands.Count -gt 1) {
    $sentLocks = $engineCutoffCommands | Where-Object { $_.status -eq "sent" -or $_.status -eq "delivered" -or $_.status -eq "pending" }
    
    if ($sentLocks.Count -gt 1) {
        Write-Host "🚨 BUG DETECTED: Multiple LOCK commands with active status!" -ForegroundColor Red
        Write-Host "" 
        Write-Host "Commands with active status:" -ForegroundColor Yellow
        foreach ($cmd in $sentLocks) {
            Write-Host "   - ID $($cmd.id): Status '$($cmd.status)' (Time: $($cmd.execution_time))" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "EXPECTED: Only the NEWEST command should have status 'sent'" -ForegroundColor White
        Write-Host "          Older commands should be marked as 'superseded'" -ForegroundColor White
        Write-Host ""
        
        # Identify which should be superseded
        $sortedLocks = $sentLocks | Sort-Object execution_time
        $oldestLock = $sortedLocks[0]
        $newestLock = $sortedLocks[-1]
        
        Write-Host "✅ Newest command (CORRECT):" -ForegroundColor Green
        Write-Host "   ID $($newestLock.id) - Status: '$($newestLock.status)' - Time: $($newestLock.execution_time)" -ForegroundColor Green
        Write-Host ""
        Write-Host "❌ Older command (WRONG):" -ForegroundColor Red
        Write-Host "   ID $($oldestLock.id) - Status: '$($oldestLock.status)'" -ForegroundColor Red
        Write-Host "   SHOULD BE: 'superseded'" -ForegroundColor Red
        Write-Host ""
        
        $bugFound = $true
    }
}

# Check unlock commands
if ($engineRestoreCommands.Count -gt 1) {
    $sentUnlocks = $engineRestoreCommands | Where-Object { $_.status -eq "sent" -or $_.status -eq "delivered" -or $_.status -eq "pending" }
    
    if ($sentUnlocks.Count -gt 1) {
        Write-Host "🚨 BUG DETECTED: Multiple UNLOCK commands with active status!" -ForegroundColor Red
        Write-Host "" 
        Write-Host "Commands with active status:" -ForegroundColor Yellow
        foreach ($cmd in $sentUnlocks) {
            Write-Host "   - ID $($cmd.id): Status '$($cmd.status)' (Time: $($cmd.execution_time))" -ForegroundColor Yellow
        }
        Write-Host ""
        $bugFound = $true
    }
}

if (!$bugFound) {
    Write-Host "✅ No 'superseded' bug detected on this device" -ForegroundColor Green
    Write-Host "   VoltCred is correctly marking old commands as superseded" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "CONCLUSION" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "❌ VoltCred API BUG CONFIRMED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Issue: When multiple commands of the same type are sent," -ForegroundColor White
    Write-Host "       VoltCred does NOT mark old commands as 'superseded'" -ForegroundColor White
    Write-Host ""
    Write-Host "Impact:" -ForegroundColor Yellow
    Write-Host "  - Dashboard shows multiple pending commands" -ForegroundColor Yellow
    Write-Host "  - Cannot determine which command is active" -ForegroundColor Yellow
    Write-Host "  - Lock state is ambiguous" -ForegroundColor Yellow
    Write-Host "  - Confusing user experience" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Required Fix:" -ForegroundColor White
    Write-Host "  VoltCred must update their backend to automatically mark" -ForegroundColor White
    Write-Host "  old commands as 'superseded' when a new command is sent" -ForegroundColor White
    Write-Host ""
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CURL COMMANDS FOR VOLTCRED SUPPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Send these to VoltCred to reproduce the issue:`n" -ForegroundColor Yellow

Write-Host "# 1. Login" -ForegroundColor White
Write-Host "curl -X POST 'https://api.voltcred.com/v2/graphql' \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -H 'Cookie: device=web' \\" -ForegroundColor Gray
Write-Host "  --data-raw '{""query"":""mutation Login(`$email: String!, `$password: String!) { sessionCreateV2(data: { email: `$email, password: `$password }) { token success } }"",""variables"":{""email"":""support@optimotion.in"",""password"":""YOUR_PASSWORD""}}'" -ForegroundColor Gray
Write-Host ""

Write-Host "# 2. Get Command History (replace YOUR_TOKEN)" -ForegroundColor White
Write-Host "curl -X POST 'https://api.voltcred.com/v2/graphql' \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -H 'Cookie: authorization=YOUR_TOKEN; device=web' \\" -ForegroundColor Gray
Write-Host "  --data-raw '{""query"":""query { deviceCommands(device_id: 449) { id command_code status execution_time } }""}'" -ForegroundColor Gray
Write-Host ""

Write-Host "`n=== SCRIPT COMPLETE ===" -ForegroundColor Green
Write-Host "Save this output and send to VoltCred support`n" -ForegroundColor Yellow
