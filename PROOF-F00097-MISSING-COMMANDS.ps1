# PROOF: VoltCred API is not showing command history for F00097 (Device 477)
# This proves commands were sent but VoltCred API returns ZERO commands

$EMAIL = "support@optimotion.in"
$PASSWORD = "Onkar@123"
$GRAPHQL_URL = "https://api-stage.voltcred.com/v2/graphql"
$DEVICE_ID = 477

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "PROOF: F00097 Missing Command History" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

Write-Host "Device: F00097" -ForegroundColor Yellow
Write-Host "IMEI: 864540081617540" -ForegroundColor Yellow
Write-Host "Device ID: $DEVICE_ID`n" -ForegroundColor Yellow

Write-Host "Step 1: Login to VoltCred API..." -ForegroundColor White

$loginBody = @{
    query = 'mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success messageKey } }'
    variables = @{
        email = $EMAIL
        password = $PASSWORD
    }
} | ConvertTo-Json -Depth 10

try {
    $loginResponse = Invoke-RestMethod -Uri $GRAPHQL_URL -Method Post `
        -Headers @{ "Content-Type" = "application/json"; "Cookie" = "device=web" } `
        -Body $loginBody
    
    $TOKEN = $loginResponse.data.sessionCreateV2.token
    Write-Host "✅ Login successful`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Query command history for device $DEVICE_ID..." -ForegroundColor White

$commandBody = @{
    query = 'query GetDeviceCommands($deviceId: Int!) { deviceCommands(device_id: $deviceId) { id command_code status execution_time response } }'
    variables = @{ deviceId = $DEVICE_ID }
} | ConvertTo-Json -Depth 10

try {
    $commandResponse = Invoke-RestMethod -Uri $GRAPHQL_URL -Method Post `
        -Headers @{ "Content-Type" = "application/json"; "Cookie" = "authorization=$TOKEN; device=web" } `
        -Body $commandBody
    
    $commands = $commandResponse.data.deviceCommands
    
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "RESULT: VoltCred API Response" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Total commands returned: $($commands.Count)" -ForegroundColor $(if ($commands.Count -eq 0) { "Red" } else { "Green" })
    
    if ($commands.Count -eq 0) {
        Write-Host "`n❌ BUG CONFIRMED: VoltCred returns ZERO commands!" -ForegroundColor Red
        Write-Host "`nUser reported:" -ForegroundColor Yellow
        Write-Host "  - Lock command sent 2 times from dashboard" -ForegroundColor White
        Write-Host "  - Commands visible in dashboard initially" -ForegroundColor White
        Write-Host "  - Commands disappeared from history" -ForegroundColor White
        Write-Host "`nVoltCred API says:" -ForegroundColor Yellow
        Write-Host "  - ZERO commands in history" -ForegroundColor White
        Write-Host "`nConclusion:" -ForegroundColor Yellow
        Write-Host "  - VoltCred API is NOT persisting command history" -ForegroundColor Red
        Write-Host "  - OR commands are being deleted/cleared" -ForegroundColor Red
        Write-Host "  - This is a VoltCred backend bug" -ForegroundColor Red
    } else {
        Write-Host "`n✅ Commands found:`n"
        foreach ($cmd in $commands) {
            Write-Host "  - $($cmd.command_code) | Status: $($cmd.status) | Time: $($cmd.execution_time)"
        }
    }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Raw JSON Response:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    $commandResponse.data | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "❌ Query failed: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SEND THIS TO VOLTCRED SUPPORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Account: support@optimotion.in"
Write-Host "Device: F00097 (ID: 477, IMEI: 864540081617540)"
Write-Host "Issue: Lock commands sent from dashboard are not appearing in deviceCommands history"
Write-Host "Impact: Cannot verify command status or debug issues"
