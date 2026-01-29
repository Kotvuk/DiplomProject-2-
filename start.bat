@echo off
chcp 65001 >nul
title KotvukAI — Crypto Analytics Platform

:: Обработчик Ctrl+C
if "%1"=="stop_confirm" goto STOP_CONFIRM

echo.
echo  ██╗  ██╗ ██████╗ ████████╗██╗   ██╗██╗   ██╗██╗  ██╗ █████╗ ██╗
echo  ██║ ██╔╝██╔═══██╗╚══██╔══╝██║   ██║██║   ██║██║ ██╔╝██╔══██╗██║
echo  █████╔╝ ██║   ██║   ██║   ██║   ██║██║   ██║█████╔╝ ███████║██║
echo  ██╔═██╗ ██║   ██║   ██║   ╚██╗ ██╔╝██║   ██║██╔═██╗ ██╔══██║██║
echo  ██║  ██╗╚██████╔╝   ██║    ╚████╔╝ ╚██████╔╝██║  ██╗██║  ██║██║
echo  ╚═╝  ╚═╝ ╚═════╝    ╚═╝     ╚═══╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
echo.
echo  Crypto Analytics Platform
echo  ================================================
echo.

set /p START_CONFIRM="  Запустить проект? (Y/N): "
if /i "%START_CONFIRM%" NEQ "Y" (
    echo.
    echo  Запуск отменён. До свидания!
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo  [1/3] Проверка Node.js...
node --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo.
    echo  [ОШИБКА] Node.js не установлен!
    echo  Скачайте с https://nodejs.org и установите версию LTS
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% найден

echo  [2/3] Проверка зависимостей backend...
cd /d "%~dp0backend"
if not exist node_modules (
    echo  Первый запуск — устанавливаем зависимости ^(1-2 минуты^)...
    npm install
    if %errorlevel% NEQ 0 (
        echo  [ОШИБКА] Не удалось установить зависимости backend
        pause
        exit /b 1
    )
)
echo  [OK] Backend зависимости готовы

echo  [3/3] Проверка зависимостей frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo  Устанавливаем зависимости frontend...
    npm install
    if %errorlevel% NEQ 0 (
        echo  [ОШИБКА] Не удалось установить зависимости frontend
        pause
        exit /b 1
    )
)
echo  [OK] Frontend зависимости готовы

echo.
echo  ================================================
echo   Запуск серверов...
echo  ================================================

cd /d "%~dp0backend"
start "KotvukAI Backend :3001" cmd /k "title KotvukAI Backend ^& node server.js"

timeout /t 5 >nul

cd /d "%~dp0frontend"
start "KotvukAI Frontend :5173" cmd /k "title KotvukAI Frontend ^& npm run dev"

timeout /t 4 >nul

echo.
echo  ================================================
echo.
echo   ПРОЕКТ ЗАПУЩЕН!
echo.
echo   Backend API :  http://localhost:3001/api/health
echo   Frontend    :  http://localhost:5173
echo.
echo   Откройте браузер: http://localhost:5173
echo.
echo  ================================================
echo.
echo  Нажмите Ctrl+C для управления сервером
echo.

start "" http://localhost:5173

:MAIN_LOOP
timeout /t 86400 >nul 2>&1
goto MAIN_LOOP

:STOP_CONFIRM
echo.
echo  ================================================
echo.
set /p STOP_CHOICE="  Остановить проект? (Y = выключить / N = продолжить): "
if /i "%STOP_CHOICE%"=="Y" (
    echo.
    echo  Останавливаем серверы...
    taskkill /fi "WindowTitle eq KotvukAI Backend :3001" /f >nul 2>&1
    taskkill /fi "WindowTitle eq KotvukAI Frontend :5173" /f >nul 2>&1
    echo  [OK] Серверы остановлены. До свидания!
    timeout /t 2 >nul
    exit /b 0
) else (
    echo  Продолжаем работу...
    goto MAIN_LOOP
)
