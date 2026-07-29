@echo off
echo ========================================
echo Installing Security Packages
echo ========================================
echo.

npm install jsonwebtoken bcryptjs express-rate-limit

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Security features installed:
echo  - JWT authentication
echo  - Password hashing
echo  - Rate limiting
echo.
echo Default credentials:
echo  Username: admin
echo  Password: opti2024
echo.
echo Start the backend with: npm start
echo.
pause
