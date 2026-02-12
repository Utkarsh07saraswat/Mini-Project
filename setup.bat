@echo off
echo Installing Root Dependencies...
call npm install

echo Installing Client Dependencies...
cd client
call npm install
cd ..

echo Installing Server Dependencies...
cd server
call npm install
cd ..

echo Setup Complete!
pause
