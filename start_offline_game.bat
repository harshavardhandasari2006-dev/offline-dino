@echo off
title OFFLINE DINO - 100% Offline Game Launcher
cd /d "%~dp0"

echo ====================================================
echo   OFFLINE DINO - 100%% Offline Edition
echo ====================================================
echo.
echo Starting local offline game server...
echo Internet connection is NOT required.
echo.

start "" "http://localhost:3000"
node server.js
