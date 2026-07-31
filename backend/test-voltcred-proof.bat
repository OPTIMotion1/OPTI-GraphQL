@echo off
echo.
echo ========================================
echo   VOLTCRED STATUS FIELD PROOF TEST
echo ========================================
echo.
echo STEP 1: Login to VoltCred
echo ----------------------------------------
echo.

REM Login
curl -X POST https://api.voltcred.com/v2/graphql ^
  -H "Content-Type: application/json" ^
  -H "Cookie: device=web" ^
  -d "{\"query\":\"mutation Login($email: String!, $password: String!) { sessionCreateV2(data: { email: $email, password: $password }) { token success messageKey } }\",\"variables\":{\"email\":\"hello@optimotion.in\",\"password\":\"Hello@1234\"}}" ^
  > login.json

echo.
echo Response saved to login.json
type login.json
echo.

REM Extract token (you'll need to copy it manually)
echo.
echo Copy the token from above and paste it below when prompted:
set /p TOKEN="Enter token: "

echo.
echo.
echo ========================================
echo STEP 2: Send Command WITH status field
echo ========================================
echo.

curl -X POST https://api.voltcred.com/v2/graphql ^
  -H "Content-Type: application/json" ^
  -H "Cookie: authorization=%TOKEN%; device=web" ^
  -d "{\"query\":\"mutation SendCommand($deviceId: Int!, $command: CommandType!) { executeDeviceCommand(device_id: $deviceId, command_type: $command) { id command_code status execution_time } }\",\"variables\":{\"deviceId\":306,\"command\":\"location_request\"}}"

echo.
echo.
echo ========================================
echo RESULT: Check the response above
echo ========================================
echo If you see "status": "pending" then
echo VoltCred DOES expose the status field!
echo.
pause
