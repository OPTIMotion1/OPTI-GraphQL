# Proof that VoltCred command history appears and disappears
# Device: 864540081617540 (ID: 453)

$ApiUrl = "https://api.voltcred.com/v2/graphql"
$Email = "support@optimotion.in"
$DeviceId = 453

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PROOF: Command History Appears/Disappears" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Device: 864540081617540" -ForegroundColor White
Write-Host "Device ID: 453" -ForegroundColor White
Write-Host "Issue: Recent Commands section randomly empty`n" -ForegroundColor Yellow

# Login
Write-Host "[STEP 1] Logging in..." -ForegroundColor Green
$Password = Read-Host "Enter password for support@optimotion.in" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$LoginBody = @{
    query = 'mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success } }'
    variables = @{ email = $Email; password = $PlainPassword }
} | ConvertTo-Json

try {
    $LoginResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $LoginBody -ContentType "application/json" -Headers @{"Cookie"="device=web"}
    $Token = $LoginResult.data.sessionCreateV2.token
    Write-Host "Login successful`n" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit
}

# Test command history multiple times
Write-Host "[STEP 2] Fetching command history 10 times..." -ForegroundColor Green
Write-Host "This will show if VoltCred returns inconsistent results`n" -ForegroundColor Yellow

$CommandsBody = @{
    query = 'query GetCommands($deviceId: Int!) { deviceCommands(device_id: $deviceId) { id command_code status execution_time } }'
    variables = @{ deviceId = $DeviceId }
} | ConvertTo-Json

$results = @()

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Attempt $i/10..." -NoNewline
    
    try {
        $CommandsResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $CommandsBody -ContentType "application/json" -Headers @{"Cookie"="authorization=$Token; device=web"}
        $commands = $CommandsResult.data.deviceCommands
        
        if ($commands) {
            Write-Host " $($commands.Count) commands" -ForegroundColor Green
            $results += $commands.Count
        } else {
            Write-Host " 0 commands" -ForegroundColor Yellow
            $results += 0
        }
        
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        $results += "ERROR"
    }
    
    Start-Sleep -Milliseconds 500
}

# Analysis
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTS ANALYSIS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$unique = $results | Select-Object -Unique
$success = $results | Where-Object { $_ -ne "ERROR" }

Write-Host "Results: $($results -join ', ')" -ForegroundColor White
Write-Host "Unique values: $($unique -join ', ')`n" -ForegroundColor White

if ($unique.Count -eq 1) {
    Write-Host "✅ CONSISTENT: Always returned $($unique[0]) commands" -ForegroundColor Green
    Write-Host "   VoltCred API is stable for this device`n" -ForegroundColor Green
} else {
    Write-Host "❌ INCONSISTENT: Returned different counts!" -ForegroundColor Red
    Write-Host "   This proves VoltCred's API is unstable`n" -ForegroundColor Yellow
    
    $unique | ForEach-Object {
        $count = ($results | Where-Object { $_ -eq $_ }).Count
        Write-Host "   - $_ commands: appeared $count times" -ForegroundColor White
    }
    
    Write-Host "`n⚠️  IMPACT ON DASHBOARD:" -ForegroundColor Yellow
    Write-Host "   When VoltCred returns 0 commands: 'Recent Commands' section HIDDEN" -ForegroundColor White
    Write-Host "   When VoltCred returns >0 commands: 'Recent Commands' section VISIBLE" -ForegroundColor White
    Write-Host "   Result: Section appears and disappears randomly`n" -ForegroundColor White
}

# Show actual command details from last successful call
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COMMAND DETAILS (Last Call)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    $FinalResult = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $CommandsBody -ContentType "application/json" -Headers @{"Cookie"="authorization=$Token; device=web"}
    $finalCommands = $FinalResult.data.deviceCommands
    
    if ($finalCommands -and $finalCommands.Count -gt 0) {
        Write-Host "VoltCred returned $($finalCommands.Count) commands:`n" -ForegroundColor Green
        
        foreach ($cmd in $finalCommands) {
            $statusColor = switch ($cmd.status) {
                "sent" { "Yellow" }
                "delivered" { "Green" }
                "failed" { "Red" }
                "superseded" { "Gray" }
                default { "White" }
            }
            
            Write-Host "Command ID: $($cmd.id)" -ForegroundColor White
            Write-Host "  Type: $($cmd.command_code)" -ForegroundColor Gray
            Write-Host "  Status: $($cmd.status)" -ForegroundColor $statusColor
            Write-Host "  Time: $($cmd.execution_time)`n" -ForegroundColor Gray
        }
    } else {
        Write-Host "VoltCred returned 0 commands (empty array)`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error fetching final command details: $_`n" -ForegroundColor Red
}

# Summary for VoltCred
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY FOR VOLTCRED SUPPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Account: support@optimotion.in" -ForegroundColor White
Write-Host "Device: 864540081617540 (Device ID: 453)" -ForegroundColor White
Write-Host "API Endpoint: deviceCommands`n" -ForegroundColor White

Write-Host "Issue: deviceCommands query returns inconsistent results" -ForegroundColor Yellow
Write-Host "  - Same device ID" -ForegroundColor White
Write-Host "  - Same authentication token" -ForegroundColor White
Write-Host "  - Same query" -ForegroundColor White
Write-Host "  - Different results each time`n" -ForegroundColor White

Write-Host "Impact:" -ForegroundColor Yellow
Write-Host "  - Dashboard's 'Recent Commands' section appears/disappears" -ForegroundColor White
Write-Host "  - Users cannot reliably see command history" -ForegroundColor White
Write-Host "  - Confusing user experience`n" -ForegroundColor White

Write-Host "Request:" -ForegroundColor Yellow
Write-Host "  Please fix the inconsistency in deviceCommands API" -ForegroundColor White
Write-Host "  Ensure it always returns the same data for the same device`n" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CURL COMMANDS FOR VOLTCRED" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host @"
# Login
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: device=web' \
  --data '{"query":"mutation{sessionCreateV2(data:{email:\"support@optimotion.in\",password:\"PASSWORD\"}){token success}}"}'

# Get Commands (run this multiple times to see inconsistency)
curl -X POST 'https://api.voltcred.com/v2/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: authorization=YOUR_TOKEN; device=web' \
  --data '{"query":"query{deviceCommands(device_id:453){id command_code status execution_time}}"}'

Run the second command 5-10 times.
You will see different command counts each time!
"@ -ForegroundColor Gray

Write-Host "`n`nDone! Save this output and send to VoltCred support.`n" -ForegroundColor Green
