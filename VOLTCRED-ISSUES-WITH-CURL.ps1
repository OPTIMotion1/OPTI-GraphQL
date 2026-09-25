# ========================================
# VoltCred API Issues - PowerShell Script
# ========================================
# This script demonstrates the issues we're facing with VoltCred API
# Run each section to see the actual API responses

$ApiUrl = "https://api.voltcred.com/v2/graphql"
$Email = "support@optimotion.in"
# Password: (user will enter when running)

Write-Host "`n=== VOLTCRED API ISSUES DEMONSTRATION ===" -ForegroundColor Cyan
Write-Host "This script will show actual API responses proving the issues`n" -ForegroundColor Yellow

# ========================================
# STEP 1: LOGIN TO GET TOKEN
# ========================================
Write-Host "`n[STEP 1] Logging in to get authentication token..." -ForegroundColor Green

$Password = Read-Host "Enter VoltCred password for support@optimotion.in" -AsSecureString
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

try {
    $LoginResponse = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $LoginHeaders -Body $LoginQuery
    $Token = $LoginResponse.data.sessionCreateV2.token
    
    if ($Token) {
        Write-Host "✓ Login successful! Token obtained." -ForegroundColor Green
        Write-Host "Token (first 50 chars): $($Token.Substring(0, 50))..." -ForegroundColor Gray
    } else {
        Write-Host "✗ Login failed!" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "✗ Login error: $_" -ForegroundColor Red
    exit
}

# ========================================
# ISSUE 1: IMMOBILIZER STATUS ALWAYS NULL
# ========================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "ISSUE #1: IMMOBILIZER STATUS ALWAYS NULL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected: immobilized.value should show true/false" -ForegroundColor Yellow
Write-Host "Actual: Always returns null even for 'observed: true' devices`n" -ForegroundColor Yellow

$AssetsQuery = @{
    query = "query { assetsWithPagination(limit: 5) { rows { name iot_devices { id device_id iot_type_code connection_status state { key value observed writable updated_at stale } } } } }"
} | ConvertTo-Json -Compress

$Headers = @{
    "Content-Type" = "application/json"
    "Cookie" = "authorization=$Token; device=web"
}

Write-Host "Running curl command to fetch asset states..." -ForegroundColor Gray
Write-Host "curl '$ApiUrl' -H 'Cookie: authorization=TOKEN; device=web' --data-raw '$AssetsQuery'`n" -ForegroundColor DarkGray

$AssetsResponse = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $Headers -Body $AssetsQuery
$Assets = $AssetsResponse.data.assetsWithPagination.rows

Write-Host "RESULTS:" -ForegroundColor White
foreach ($Asset in $Assets | Select-Object -First 3) {
    $Device = $Asset.iot_devices[0]
    $ImmobilizerState = $Device.state | Where-Object { $_.key -eq "immobilized" }
    
    Write-Host "`nVehicle: $($Asset.name)" -ForegroundColor White
    Write-Host "  Device: $($Device.device_id)" -ForegroundColor Gray
    Write-Host "  Connection: $($Device.connection_status)" -ForegroundColor Gray
    
    if ($ImmobilizerState) {
        Write-Host "  Immobilizer State:" -ForegroundColor White
        Write-Host "    - value: $($ImmobilizerState.value)" -ForegroundColor $(if ($null -eq $ImmobilizerState.value) { "Red" } else { "Green" })
        Write-Host "    - observed: $($ImmobilizerState.observed)" -ForegroundColor Gray
        Write-Host "    - writable: $($ImmobilizerState.writable)" -ForegroundColor Gray
        Write-Host "    - updated_at: $($ImmobilizerState.updated_at)" -ForegroundColor Gray
        Write-Host "    - stale: $($ImmobilizerState.stale)" -ForegroundColor Gray
        
        if ($null -eq $ImmobilizerState.value) {
            Write-Host "  ⚠️  ISSUE: Value is NULL (cannot determine lock state)" -ForegroundColor Red
        }
        
        if ($ImmobilizerState.stale -eq $true) {
            Write-Host "  ⚠️  ISSUE: Data is STALE (outdated)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️  No immobilizer state found" -ForegroundColor Red
    }
}

# ========================================
# ISSUE 2: STALE TIMESTAMPS (38+ DAYS OLD)
# ========================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "ISSUE #2: STALE IMMOBILIZER TIMESTAMPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected: Recent timestamps (within hours/days)" -ForegroundColor Yellow
Write-Host "Actual: Last update was August 2, 2026 (38+ days ago)`n" -ForegroundColor Yellow

Write-Host "Checking devices marked as 'observed: true'..." -ForegroundColor Gray

foreach ($Asset in $Assets) {
    $Device = $Asset.iot_devices[0]
    $ImmobilizerState = $Device.state | Where-Object { $_.key -eq "immobilized" }
    
    if ($ImmobilizerState.observed -eq $true) {
        Write-Host "`nDevice: $($Device.device_id)" -ForegroundColor White
        Write-Host "  Last Updated: $($ImmobilizerState.updated_at)" -ForegroundColor Gray
        
        if ($ImmobilizerState.updated_at) {
            $UpdatedDate = [DateTime]::Parse($ImmobilizerState.updated_at)
            $DaysOld = ([DateTime]::Now - $UpdatedDate).Days
            Write-Host "  Days Old: $DaysOld days" -ForegroundColor $(if ($DaysOld -gt 7) { "Red" } else { "Green" })
            
            if ($DaysOld -gt 7) {
                Write-Host "  ⚠️  ISSUE: Data is $DaysOld days old!" -ForegroundColor Red
            }
        }
    }
}

# ========================================
# ISSUE 3: COMMAND STATUS - NO EXECUTION CONFIRMATION
# ========================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "ISSUE #3: NO EXECUTION CONFIRMATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected: Status 'completed' when command executes" -ForegroundColor Yellow
Write-Host "Actual: Status stays 'delivered' - no confirmation of execution`n" -ForegroundColor Yellow

# Get command history for a device
$DeviceId = 245  # Device with observed: true

$CommandsQuery = @{
    query = "query GetDeviceCommands(`$deviceId: Int!) { deviceCommands(device_id: `$deviceId) { id command_code status execution_time response } }"
    variables = @{
        deviceId = $DeviceId
    }
} | ConvertTo-Json -Compress

Write-Host "Fetching command history for device ID $DeviceId..." -ForegroundColor Gray
Write-Host "curl '$ApiUrl' -H 'Cookie: authorization=TOKEN; device=web' --data-raw '$CommandsQuery'`n" -ForegroundColor DarkGray

$CommandsResponse = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $Headers -Body $CommandsQuery
$Commands = $CommandsResponse.data.deviceCommands | Select-Object -First 5

Write-Host "RECENT COMMANDS:" -ForegroundColor White
foreach ($Cmd in $Commands) {
    $StatusColor = switch ($Cmd.status) {
        "delivered" { "Yellow" }
        "completed" { "Green" }
        "failed" { "Red" }
        default { "Gray" }
    }
    
    Write-Host "`nCommand ID: $($Cmd.id)" -ForegroundColor White
    Write-Host "  Code: $($Cmd.command_code)" -ForegroundColor Gray
    Write-Host "  Status: $($Cmd.status)" -ForegroundColor $StatusColor
    Write-Host "  Time: $($Cmd.execution_time)" -ForegroundColor Gray
    Write-Host "  Response: $($Cmd.response)" -ForegroundColor Gray
    
    if ($Cmd.status -eq "delivered" -and $Cmd.command_code -like "engine_*") {
        Write-Host "  ⚠️  ISSUE: Status is 'delivered' but did it execute? No confirmation!" -ForegroundColor Red
    }
    
    if ($null -eq $Cmd.response -or $Cmd.response -eq "") {
        Write-Host "  ⚠️  ISSUE: Response is NULL (no feedback from device)" -ForegroundColor Red
    }
}

# ========================================
# ISSUE 4: DEVICE NEVER CONNECTED
# ========================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "ISSUE #4: DEVICE 864540080665904 NEVER CONNECTED" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected: Device shows 'connected' or 'disconnected'" -ForegroundColor Yellow
Write-Host "Actual: Shows 'unknown' and last_communication is NULL`n" -ForegroundColor Yellow

$SpecificDeviceQuery = @{
    query = "query { assetsWithPagination(limit: 20) { rows { name iot_devices { id device_id connection_status last_communication } } } }"
} | ConvertTo-Json -Compress

$AllAssets = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $Headers -Body $SpecificDeviceQuery
$ProblemDevice = $AllAssets.data.assetsWithPagination.rows | Where-Object { 
    $_.iot_devices[0].device_id -eq "864540080665904" 
}

if ($ProblemDevice) {
    $Dev = $ProblemDevice.iot_devices[0]
    Write-Host "Vehicle: $($ProblemDevice.name)" -ForegroundColor White
    Write-Host "  IMEI: $($Dev.device_id)" -ForegroundColor Gray
    Write-Host "  Device ID: $($Dev.id)" -ForegroundColor Gray
    Write-Host "  Connection Status: $($Dev.connection_status)" -ForegroundColor $(if ($Dev.connection_status -eq "unknown") { "Red" } else { "Green" })
    Write-Host "  Last Communication: $($Dev.last_communication)" -ForegroundColor $(if ($null -eq $Dev.last_communication) { "Red" } else { "Green" })
    
    Write-Host "`n  ⚠️  CRITICAL: Device has NEVER connected since registration!" -ForegroundColor Red
    Write-Host "  We need VoltCred to:" -ForegroundColor Yellow
    Write-Host "    1. Check backend logs for connection attempts" -ForegroundColor Yellow
    Write-Host "    2. Provide SMS configuration commands for gt06" -ForegroundColor Yellow
    Write-Host "    3. Verify device is authorized to connect" -ForegroundColor Yellow
}

# ========================================
# SUMMARY OF ISSUES
# ========================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY - WHAT WE NEED FROM VOLTCRED" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "1. FIX IMMOBILIZER STATUS" -ForegroundColor White
Write-Host "   - Update 'immobilized.value' when commands reach 'delivered' status" -ForegroundColor Gray
Write-Host "   - OR clearly document that gt06 devices cannot report this" -ForegroundColor Gray

Write-Host "`n2. FIX STALE DATA" -ForegroundColor White
Write-Host "   - Immobilizer 'updated_at' is 38+ days old" -ForegroundColor Gray
Write-Host "   - Either update regularly OR mark field as 'not supported'" -ForegroundColor Gray

Write-Host "`n3. ADD EXECUTION CONFIRMATION" -ForegroundColor White
Write-Host "   - Change status from 'delivered' to 'completed' when device executes" -ForegroundColor Gray
Write-Host "   - OR add a new field 'last_command_executed'" -ForegroundColor Gray

Write-Host "`n4. FIX DISCONNECTED DEVICE" -ForegroundColor White
Write-Host "   - Device 864540080665904 (ID: 239) never connected" -ForegroundColor Gray
Write-Host "   - Need help diagnosing and configuring this device" -ForegroundColor Gray

Write-Host "`n5. IMPROVE DOCUMENTATION" -ForegroundColor White
Write-Host "   - Clarify what 'observed: true' means" -ForegroundColor Gray
Write-Host "   - Document state field behavior for each device type" -ForegroundColor Gray
Write-Host "   - Provide webhook/push notification option" -ForegroundColor Gray

Write-Host "`n`n=== SCRIPT COMPLETE ===" -ForegroundColor Green
Write-Host "Save this output and send to VoltCred support`n" -ForegroundColor Yellow

# ========================================
# CURL COMMANDS FOR MANUAL TESTING
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CURL COMMANDS FOR VOLTCRED SUPPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "If VoltCred needs raw curl commands:`n" -ForegroundColor Yellow

Write-Host "# 1. Get Assets with State" -ForegroundColor White
Write-Host "curl 'https://api.voltcred.com/v2/graphql' \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -H 'Cookie: authorization=$Token; device=web' \\" -ForegroundColor Gray
Write-Host "  --data-raw '{""query"":""query { assetsWithPagination(limit: 20) { rows { name iot_devices { id device_id connection_status state { key value observed writable updated_at } } } } }""}'`n" -ForegroundColor Gray

Write-Host "# 2. Get Command History for Device 245" -ForegroundColor White
Write-Host "curl 'https://api.voltcred.com/v2/graphql' \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -H 'Cookie: authorization=$Token; device=web' \\" -ForegroundColor Gray
Write-Host "  --data-raw '{""query"":""query { deviceCommands(device_id: 245) { id command_code status execution_time response } }""}'`n" -ForegroundColor Gray





curl -i -X POST "https://api.voltcred.com/v2/graphql" -H "Content-Type: application/json" -H "Cookie: device=web" --data-raw "{\"query\":\"mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success messageKey } }\",\"variables\":{\"email\":\"support@optimotion.in\",\"password\":\"YOUR_PASSWORD\"}}"
curl -i -X POST "https://api.voltcred.com/v2/graphql" -H "Content-Type: application/json" -H "Cookie: authorization=YOUR_TOKEN; device=web" --data-raw "{\"query\":\"query { assetsWithPagination(limit: 20) { rows { name iot_devices { id device_id iot_type_code connection_status last_communication state { key value observed writable updated_at stale } } } } }\"}"
curl -i -X POST "https://api.voltcred.com/v2/graphql" -H "Content-Type: application/json" -H "Cookie: authorization=YOUR_TOKEN; device=web" --data-raw "{\"query\":\"query { deviceCommands(device_id: 245) { id command_code status execution_time response } }\"}"
curl.exe -X POST "https://api.voltcred.com/v2/graphql" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: authorization=%TOKEN%; device=web" ^
  --data-raw "{\"query\":\"query { deviceCommands(device_id: 449) { id command_code status execution_time response } }\"}"
