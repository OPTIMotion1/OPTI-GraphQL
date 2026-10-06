# PowerShell script to check F00097 (864540081617540) command history via VoltCred API

$EMAIL = "support@optimotion.in"
$PASSWORD = "Onkar@123"
$GRAPHQL_URL = "https://api-stage.voltcred.com/v2/graphql"
$DEVICE_ID = 477

Write-Host "Step 1: Logging into VoltCred..." -ForegroundColor Cyan

# Login mutation
$loginBody = @{
    query = "mutation Login(`$email: String!, `$password: String!) { sessionCreateV2(data: { email: `$email, password: `$password }) { token success messageKey } }"
    variables = @{
        email = $EMAIL
        password = $PASSWORD
    }
} | ConvertTo-Json -Depth 10

$loginResponse = Invoke-RestMethod -Uri $GRAPHQL_URL -Method Post `
    -Headers @{
        "Content-Type" = "application/json"
        "Cookie" = "device=web"
    } -Body $loginBody

if (-not $loginResponse.data.sessionCreateV2.success) {
    Write-Host "❌ Login failed: $($loginResponse.data.sessionCreateV2.messageKey)" -ForegroundColor Red
    exit 1
}

$TOKEN = $loginResponse.data.sessionCreateV2.token
Write-Host "✅ Login successful! Token: $($TOKEN.Substring(0, 20))..." -ForegroundColor Green

Write-Host "`nStep 2: Fetching command history for device $DEVICE_ID..." -ForegroundColor Cyan

# Get device commands
$commandBody = @{
    query = "query GetDeviceCommands(`$deviceId: Int!) { deviceCommands(device_id: `$deviceId) { id command_code status execution_time response } }"
    variables = @{
        deviceId = $DEVICE_ID
    }
} | ConvertTo-Json -Depth 10

$commandResponse = Invoke-RestMethod -Uri $GRAPHQL_URL -Method Post `
    -Headers @{
        "Content-Type" = "application/json"
        "Cookie" = "authorization=$TOKEN; device=web"
    } -Body $commandBody

$commands = $commandResponse.data.deviceCommands

Write-Host "`n=== F00097 Command History (Device ID: $DEVICE_ID) ===" -ForegroundColor Yellow
Write-Host "Total commands: $($commands.Count)`n"

if ($commands.Count -eq 0) {
    Write-Host "❌ No commands found!" -ForegroundColor Red
    Write-Host "This device has no command history in VoltCred." -ForegroundColor Yellow
} else {
    foreach ($cmd in $commands) {
        $execTime = [DateTime]::Parse($cmd.execution_time).ToUniversalTime()
        $minutesAgo = [Math]::Floor(((Get-Date).ToUniversalTime() - $execTime).TotalMinutes)
        
        Write-Host "Command: $($cmd.command_code)" -ForegroundColor White
        Write-Host "  ID: $($cmd.id)"
        Write-Host "  Status: $($cmd.status)" -ForegroundColor $(if ($cmd.status -eq "failed") { "Red" } elseif ($cmd.status -eq "pending") { "Yellow" } else { "Green" })
        Write-Host "  Execution: $($cmd.execution_time) ($minutesAgo minutes ago)"
        Write-Host "  Response: $($cmd.response)"
        Write-Host ""
    }
}

Write-Host "`n=== Raw JSON Response ===" -ForegroundColor Cyan
$commandResponse | ConvertTo-Json -Depth 10
