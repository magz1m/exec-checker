@echo off
chcp 65001 >nul
title ExecChecker
setlocal EnableDelayedExpansion

:: ================================================================
::   ExecChecker v2.2
::   Авторы: magz1m & DeepSeek
:: ================================================================

set "HAS_PS=1"
where powershell >nul 2>&1
if !errorlevel! neq 0 set "HAS_PS=0"

set /a FOUND=0
set /a CHECKED=0
set /a FOLDER_COUNT=0
set /a FOLDERS_FOUND=0
set /a PROCS_FOUND=0
set /a REG_FOUND=0
set /a LNK_FOUND=0
set /a TEMP_FOUND=0
set /a STARTUP_FOUND=0
set "REPORT=%~dp0ExecChecker_report.txt"
set "HTML=%~dp0ExecChecker_report.html"

> "%REPORT%" echo Отчет ExecChecker v2.2 - %DATE% %TIME%
>>"%REPORT%" echo ================================================

color 0A
cls
call :banner
call :admin_check
call :mode_select

call :anim "Сканирую систему"
call :section "1 / 6" "■□□□□□" "ПОИСК ПАПОК ЭКЗЕКЬЮТЕРОВ"
call :scan_folders

call :section "2 / 6" "■■□□□□" "ПРОВЕРКА ЗАПУЩЕННЫХ ПРОЦЕССОВ"
call :scan_processes

call :section "3 / 6" "■■■□□□" "ПРОВЕРКА РЕЕСТРА"
call :scan_registry

call :section "4 / 6" "■■■■□□" "ПРОВЕРКА ЯРЛЫКОВ"
call :scan_shortcuts

call :section "5 / 6" "■■■■■□" "АНАЛИЗ ВРЕМЕННЫХ ФАЙЛОВ"
call :scan_temp

call :section "6 / 6" "■■■■■■" "ПРОВЕРКА АВТОЗАПУСКА"
call :scan_startup

call :summary
call :generate_html
call :open_prompts

echo.
set "TMPCOL============================================================"
call :cyan
set "TMPCOL=   СКРИПТ ЗАВЕРШЁН. Нажмите любую клавишу для выхода..."
call :cyan
set "TMPCOL============================================================"
call :cyan
pause >nul
color 07
endlocal
exit /b 0


:: ================================================================
:: БАННЕР
:: ================================================================
:banner
echo.
set "TMPCOL=╔══════════════════════════════════════════════════════════╗"
call :magenta
set "TMPCOL=║                                                          ║"
call :magenta
set "TMPCOL=║                E X E C   C H E C K E R                   ║"
call :cyan
set "TMPCOL=║                       v 2 . 2                            ║"
call :cyan
set "TMPCOL=║                                                          ║"
call :magenta
set "TMPCOL=║                magz1m  &  DeepSeek                       ║"
call :yellow
set "TMPCOL=║                                                          ║"
call :magenta
set "TMPCOL=╚══════════════════════════════════════════════════════════╝"
call :magenta
echo.
exit /b


:: ================================================================
:: РЕЖИМ
:: ================================================================
:mode_select
set "TMPCOL============================================================"
call :cyan
set "TMPCOL=   ВЫБЕРИТЕ РЕЖИМ РАБОТЫ"
call :cyan
set "TMPCOL============================================================"
call :cyan
echo.
set "TMPCOL=   [1] БЫСТРАЯ проверка"
call :white
set "TMPCOL=   [2] ГЛУБОКАЯ проверка  (+ хеши файлов)"
call :white
echo.
set "MODE="
set /p "MODE=   Ваш выбор [1/2, Enter = быстрый]: "
if "!MODE!"=="" set "MODE=1"
if "!MODE!"=="2" (
    set "DEEP=1"
    set "TMPCOL=   > Выбран ГЛУБОКИЙ режим"
    call :yellow
) else (
    set "DEEP=0"
    set "MODE=1"
    set "TMPCOL=   > Выбран БЫСТРЫЙ режим"
    call :green
)
echo.
exit /b


:: ================================================================
:: ЦВЕТНЫЕ ХЕЛПЕРЫ
:: ================================================================
:red
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Red" 2>nul) else (echo !TMPCOL!)
exit /b
:green
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Green" 2>nul) else (echo !TMPCOL!)
exit /b
:yellow
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Yellow" 2>nul) else (echo !TMPCOL!)
exit /b
:cyan
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Cyan" 2>nul) else (echo !TMPCOL!)
exit /b
:magenta
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Magenta" 2>nul) else (echo !TMPCOL!)
exit /b
:white
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor White" 2>nul) else (echo !TMPCOL!)
exit /b
:gray
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor DarkGray" 2>nul) else (echo !TMPCOL!)
exit /b


:: ================================================================
:: АНИМАЦИЯ
:: ================================================================
:anim
set "TMPCOL=   %~1"
call :gray
<nul set /p "="
for /l %%i in (1,1,3) do (
    powershell -NoProfile -Command "Write-Host '.' -NoNewline -ForegroundColor Cyan" 2>nul
    timeout /t 1 /nobreak >nul 2>&1
)
if "!HAS_PS!"=="0" echo.
echo.
echo.
exit /b


:: ================================================================
:: АДМИН
:: ================================================================
:admin_check
net session >nul 2>&1
if !errorlevel! equ 0 (
    set "TMPCOL=  [+] Программа запущена с правами администратора"
    call :green
) else (
    set "TMPCOL=  [!] Программа запущена БЕЗ прав администратора"
    call :yellow
    set "TMPCOL=      Некоторые папки могут быть пропущены"
    call :gray
)
echo.
exit /b


:: ================================================================
:: ЗАГОЛОВОК РАЗДЕЛА
:: ================================================================
:section
echo.
set "TMPCOL============================================================"
call :blue
set "TMPCOL=  %~1  [%~2]  %~3"
call :cyan
set "TMPCOL============================================================"
call :blue
echo.
exit /b

:blue
if "!HAS_PS!"=="1" (powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Blue" 2>nul) else (echo !TMPCOL!)
exit /b


:: ================================================================
:: 1 - ПАПКИ
:: ================================================================
:scan_folders

call :chk "Solara"         "%LOCALAPPDATA%\Solara"        "Solara.exe"
call :chk "Wave"           "%LOCALAPPDATA%\Wave"          "Wave.exe"
call :chk "Xeno"           "%LOCALAPPDATA%\Xeno"          "xeno.exe"
call :chk "Delta"          "%LOCALAPPDATA%\Delta"         "DeltaExecutor.exe"
call :chk "Fluxus"         "%LOCALAPPDATA%\Fluxus"        "Fluxus.exe"
call :chk "Hydrogen"       "%LOCALAPPDATA%\Hydrogen"      "Hydrogen.exe"
call :chk "Codex"          "%LOCALAPPDATA%\Codex"         "Codex.exe"
call :chk "Synapse"        "%LOCALAPPDATA%\Synapse"       "Synapse.exe"
call :chk "Synapse Roam"   "%APPDATA%\Synapse"            "Synapse.exe"
call :chk "Krnl"           "%LOCALAPPDATA%\Krnl"          "Krnl.exe"
call :chk "Electron"       "%LOCALAPPDATA%\Electron"      "Electron.exe"
call :chk "Trigon"         "%LOCALAPPDATA%\Trigon"        "Trigon.exe"
call :chk "Swift"          "%LOCALAPPDATA%\Swift"         "Swift.exe"
call :chk "Arceus"         "%LOCALAPPDATA%\Arceus"        "Arceus.exe"
call :chk "Nihon"          "%LOCALAPPDATA%\Nihon"         "Nihon.exe"
call :chk "Sirhurt"        "%LOCALAPPDATA%\Sirhurt"       "Sirhurt.exe"
call :chk "JJSploit"       "%LOCALAPPDATA%\JJSploit"      "JJSploit.exe"
call :chk "Celery"         "%APPDATA%\Celery"             "Celery.exe"
call :chk "Sever"          "%LOCALAPPDATA%\Sever"         "Sever.exe"
call :chk "Oxygen"         "%LOCALAPPDATA%\Oxygen"        "Oxygen.exe"
call :chk "Comet"          "%LOCALAPPDATA%\Comet"         "Comet.exe"
call :chk "Ronnin"         "%LOCALAPPDATA%\Ronnin"        "Ronnin.exe"
call :chk "Velocity"       "%LOCALAPPDATA%\Velocity"      "Velocity.exe"
call :chk "AWP"            "%LOCALAPPDATA%\AWP"           "AWP.exe"
call :chk "Kiwi"           "%LOCALAPPDATA%\Kiwi"          "Kiwi.exe"
call :chk "Seliware"       "%LOCALAPPDATA%\Seliware"      "Seliware.exe"
call :chk "Sirius"         "%LOCALAPPDATA%\Sirius"        "Sirius.exe"
call :chk "MacSploit"      "%LOCALAPPDATA%\MacSploit"     "MacSploit.exe"
call :chk "RbxStu"         "%LOCALAPPDATA%\RbxStu"        "RbxStu.exe"
call :chk "Volt"           "%LOCALAPPDATA%\Volt"          "Volt.exe"

call :chk "autoexec"       "%LOCALAPPDATA%\autoexec"      "autoexec"
call :chk "workspace"      "%LOCALAPPDATA%\workspace"     "workspace"
call :chk "scripts"        "%LOCALAPPDATA%\scripts"       "scripts"

exit /b

:chk
set "NAME=%~1"
set "DIR=%~2"
set /a CHECKED+=1

if exist "!DIR!" (
    set /a FOUND+=1
    set /a FOLDERS_FOUND+=1
    set /a FOLDER_COUNT+=1
    set "FOLDER_!FOLDER_COUNT!=!DIR!"
    set "TMPCOL=  [X] !NAME! - НАЙДЕНО"
    call :red
    set "TMPCOL=      Путь: !DIR!"
    call :gray

    if "!DEEP!"=="1" if exist "!DIR!\%~3" call :hash_and_sign "!DIR!\%~3"

    >>"%REPORT%" echo [ПАПКА] !NAME! : !DIR!
) else (
    set "TMPCOL=  [+] !NAME! - чисто"
    call :green
)
exit /b


:: ================================================================
:: ХЕШ
:: ================================================================
:hash_and_sign
if "!HAS_PS!"=="0" exit /b
set "FILEPATH=%~1"
if not exist "!FILEPATH!" exit /b
set "FP=!FILEPATH!"

set "HASH="
for /f "delims=" %%h in ('powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath $env:FP -ErrorAction SilentlyContinue).Hash" 2^>nul') do set "HASH=%%h"

if defined HASH (
    set "TMPCOL=      SHA256: !HASH!"
    call :gray
    >>"%REPORT%" echo   SHA256: !HASH!
)
exit /b


:: ================================================================
:: 2 - ПРОЦЕССЫ
:: ================================================================
:scan_processes
set "PROCS=%TEMP%\ec_procs.tmp"
tasklist /FO CSV /NH > "%PROCS%" 2>nul

call :chk_proc "RobloxPlayerBeta.exe"
call :chk_proc "Solara.exe"
call :chk_proc "Wave.exe"
call :chk_proc "Xeno.exe"
call :chk_proc "DeltaExecutor.exe"
call :chk_proc "Fluxus.exe"
call :chk_proc "Hydrogen.exe"
call :chk_proc "Synapse.exe"
call :chk_proc "Krnl.exe"
call :chk_proc "Electron.exe"
call :chk_proc "Trigon.exe"
call :chk_proc "Swift.exe"
call :chk_proc "Arceus.exe"
call :chk_proc "Nihon.exe"
call :chk_proc "Sirhurt.exe"
call :chk_proc "JJSploit.exe"
call :chk_proc "Celery.exe"
call :chk_proc "Sever.exe"
call :chk_proc "Comet.exe"
call :chk_proc "Seliware.exe"
call :chk_proc "RbxStu.exe"

del "%PROCS%" >nul 2>&1
exit /b

:chk_proc
findstr /I /C:"%~1" "%PROCS%" >nul 2>&1
if !errorlevel! equ 0 (
    set /a FOUND+=1
    set /a PROCS_FOUND+=1
    set "TMPCOL=  [!] %~1 - ЗАПУЩЕН"
    call :yellow
    >>"%REPORT%" echo [ПРОЦЕСС] %~1
) else (
    set "TMPCOL=  [.] %~1 - не активен"
    call :gray
)
exit /b


:: ================================================================
:: 3 - РЕЕСТР
:: ================================================================
:scan_registry

call :chk_reg "HKCU\Software\Solara"              "Solara"
call :chk_reg "HKCU\Software\Wave"                "Wave"
call :chk_reg "HKCU\Software\Xeno"                "Xeno"
call :chk_reg "HKCU\Software\Fluxus"              "Fluxus"
call :chk_reg "HKCU\Software\Synapse"             "Synapse"
call :chk_reg "HKCU\Software\Krnl"                "Krnl"
call :chk_reg "HKCU\Software\Electron"            "Electron"
call :chk_reg "HKCU\Software\JJSploit"            "JJSploit"
call :chk_reg "HKCU\Software\Sirhurt"             "Sirhurt"
call :chk_reg "HKCU\Software\WeAreDevs"           "WeAreDevs"
call :chk_reg "HKCU\Software\Roblox Executor"     "Roblox Executor"
call :chk_reg "HKCU\Software\RbxStu"              "RbxStu"
call :chk_reg "HKCU\Software\Seliware"            "Seliware"

exit /b

:chk_reg
reg query "%~1" >nul 2>&1
if !errorlevel! equ 0 (
    set /a FOUND+=1
    set /a REG_FOUND+=1
    set "TMPCOL=  [X] %~2 - НАЙДЕНО В РЕЕСТРЕ"
    call :red
    set "TMPCOL=      Ключ: %~1"
    call :gray
    >>"%REPORT%" echo [РЕЕСТР] %~1
) else (
    set "TMPCOL=  [+] %~2 - ключа нет"
    call :green
)
exit /b


:: ================================================================
:: 4 - ЯРЛЫКИ
:: ================================================================
:scan_shortcuts
set "DESKTOP=%USERPROFILE%\Desktop"
set "PUBDESK=%PUBLIC%\Desktop"
set "STARTM=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

call :chk_lnk "Solara"           "%DESKTOP%\Solara.lnk"
call :chk_lnk "Wave"             "%DESKTOP%\Wave.lnk"
call :chk_lnk "Xeno"             "%DESKTOP%\Xeno.lnk"
call :chk_lnk "Delta"            "%DESKTOP%\Delta.lnk"
call :chk_lnk "Fluxus"           "%DESKTOP%\Fluxus.lnk"
call :chk_lnk "Synapse"          "%DESKTOP%\Synapse.lnk"
call :chk_lnk "Krnl"             "%DESKTOP%\Krnl.lnk"
call :chk_lnk "JJSploit"         "%DESKTOP%\JJSploit.lnk"
call :chk_lnk "Solara public"    "%PUBDESK%\Solara.lnk"
call :chk_lnk "Wave public"      "%PUBDESK%\Wave.lnk"
call :chk_lnk "Solara menu"      "%STARTM%\Solara.lnk"
call :chk_lnk "Wave menu"        "%STARTM%\Wave.lnk"
call :chk_lnk "Fluxus menu"      "%STARTM%\Fluxus.lnk"
exit /b

:chk_lnk
if exist "%~2" (
    set /a FOUND+=1
    set /a LNK_FOUND+=1
    set "TMPCOL=  [X] %~1 - ЯРЛЫК НАЙДЕН"
    call :red
    set "TMPCOL=      Файл: %~2"
    call :gray
    >>"%REPORT%" echo [ЯРЛЫК] %~2
) else (
    set "TMPCOL=  [+] %~1 - ярлыка нет"
    call :green
)
exit /b


:: ================================================================
:: 5 - TEMP
:: ================================================================
:scan_temp
set "TMPHIT=0"
for %%P in (
    "executor*.dll" "inject*.dll" "WeAreDevs*.dll" "Krnl*.dll"
    "Synapse*.dll" "Solara*.dll" "*rbxstu*.dll" "autoexec*.lua"
) do (
    for %%F in ("%TEMP%\%%~P") do (
        if exist "%%~F" (
            set /a FOUND+=1
            set /a TEMP_FOUND+=1
            set "TMPHIT=1"
            set "TMPCOL=  [X] %%~nxF - НАЙДЕНО В TEMP"
            call :red
            set "TMPCOL=      Файл: %%~F"
            call :gray
            >>"%REPORT%" echo [TEMP] %%~F
        )
    )
)
if "!TMPHIT!"=="0" (
    set "TMPCOL=  [+] Подозрительных DLL/LUA в TEMP не найдено"
    call :green
)
exit /b


:: ================================================================
:: 6 - АВТОЗАПУСК
:: ================================================================
:scan_startup

set "STARTUP_USER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_ALL=%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

call :chk_startup_dir "!STARTUP_USER!" "Startup пользователя"
call :chk_startup_dir "!STARTUP_ALL!" "Startup общий"

call :chk_run "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" "Run HKCU"
call :chk_run "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" "Run HKLM"

set "TASKHIT=0"
for /f "tokens=2 delims=:" %%T in ('schtasks /query /fo LIST 2^>nul ^| findstr /I /C:"Solara" /C:"Wave" /C:"Xeno" /C:"Fluxus" /C:"Synapse" /C:"Krnl" /C:"JJSploit" /C:"Sirhurt" /C:"RbxStu"') do (
    set "TASKHIT=1"
    set /a FOUND+=1
    set /a STARTUP_FOUND+=1
    set "TMPCOL=  [X] Задача в планировщике:%%T"
    call :red
    >>"%REPORT%" echo [ЗАДАЧА]%%T
)
if "!TASKHIT!"=="0" (
    set "TMPCOL=  [+] Планировщик задач - чисто"
    call :green
)
exit /b

:chk_startup_dir
if not exist "%~1" (
    set "TMPCOL=  [+] %~2 - папка не существует"
    call :green
    exit /b
)
set "DIRHIT=0"
for %%F in ("%~1\*") do (
    set "FNAME=%%~nxF"
    echo !FNAME! | findstr /I "solara wave xeno fluxus synapse krnl jjsploit sirhurt wearedevs rbxstu executor inject" >nul 2>&1
    if !errorlevel! equ 0 (
        set "DIRHIT=1"
        set /a FOUND+=1
        set /a STARTUP_FOUND+=1
        set "TMPCOL=  [X] %~2 - файл: !FNAME!"
        call :red
        >>"%REPORT%" echo [АВТОЗАПУСК] %~2 : !FNAME!
    )
)
if "!DIRHIT!"=="0" (
    set "TMPCOL=  [+] %~2 - чисто"
    call :green
)
exit /b

:chk_run
set "RUNHIT=0"
for /f "tokens=1 delims= " %%A in ('reg query "%~1" 2^>nul ^| findstr /I "solara wave xeno fluxus synapse krnl jjsploit sirhurt wearedevs rbxstu executor"') do (
    set "RUNHIT=1"
    set /a FOUND+=1
    set /a STARTUP_FOUND+=1
    set "TMPCOL=  [X] %~2 - запись: %%A"
    call :red
    >>"%REPORT%" echo [RUN] %~1 : %%A
)
if "!RUNHIT!"=="0" (
    set "TMPCOL=  [+] %~2 - чисто"
    call :green
)
exit /b


:: ================================================================
:: ИТОГИ
:: ================================================================
:summary
echo.
set "TMPCOL=╔══════════════════════════════════════════════════════════╗"
call :magenta
set "TMPCOL=║                   РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ                ║"
call :cyan
set "TMPCOL=╚══════════════════════════════════════════════════════════╝"
call :magenta
echo.
echo  ┌─────────────────┬────────────┬──────────┐
set "TMPCOL=  │   КАТЕГОРИЯ     │  ПРОВЕРЕНО │  НАЙДЕНО │"
call :white
echo  ├─────────────────┼────────────┼──────────┤
set "TMPCOL=  │  Папки          │   !CHECKED!      │    !FOLDERS_FOUND!     │"
call :gray
set "TMPCOL=  │  Процессы       │    21      │    !PROCS_FOUND!     │"
call :gray
set "TMPCOL=  │  Реестр         │    13      │    !REG_FOUND!     │"
call :gray
set "TMPCOL=  │  Ярлыки         │    13      │    !LNK_FOUND!     │"
call :gray
set "TMPCOL=  │  TEMP           │     8      │    !TEMP_FOUND!     │"
call :gray
set "TMPCOL=  │  Автозапуск     │    --      │    !STARTUP_FOUND!     │"
call :gray
echo  ├─────────────────┼────────────┼──────────┤
if !FOUND! gtr 0 (
    set "TMPCOL=  │  ВСЕГО          │   !CHECKED!      │    !FOUND!     │"
    call :red
) else (
    set "TMPCOL=  │  ВСЕГО          │   !CHECKED!      │    0     │"
    call :green
)
echo  └─────────────────┴────────────┴──────────┘
echo.

>>"%REPORT%" echo ------------------------------------------------
>>"%REPORT%" echo ВСЕГО ПРОВЕРЕНО: !CHECKED!
>>"%REPORT%" echo ВСЕГО НАЙДЕНО:   !FOUND!
>>"%REPORT%" echo   Папки:      !FOLDERS_FOUND!
>>"%REPORT%" echo   Процессы:   !PROCS_FOUND!
>>"%REPORT%" echo   Реестр:     !REG_FOUND!
>>"%REPORT%" echo   Ярлыки:     !LNK_FOUND!
>>"%REPORT%" echo   TEMP:       !TEMP_FOUND!
>>"%REPORT%" echo   Автозапуск: !STARTUP_FOUND!

if !FOUND! gtr 0 (
    set "TMPCOL=  [!] ВНИМАНИЕ: НА СИСТЕМЕ ОБНАРУЖЕНЫ ЭКЗЕКЬЮТЕРЫ!"
    call :red
    set "TMPCOL=      Подробности в отчёте: %REPORT%"
    call :gray
) else (
    set "TMPCOL=  [+] СИСТЕМА ЧИСТА - экзекьютеры не найдены"
    call :green
    set "TMPCOL=      Отчёт: %REPORT%"
    call :gray
)
echo.
exit /b


:: ================================================================
:: КРАСИВЫЙ HTML ОТЧЁТ
:: ================================================================
:generate_html

set "VERDICT_COLOR=#00ff88"
set "VERDICT_TEXT=CLEAN"
if !FOUND! gtr 0 (
    set "VERDICT_COLOR=#ff3344"
    set "VERDICT_TEXT=THREAT DETECTED"
)

>"%HTML%" echo ^<!DOCTYPE html^>
>>"%HTML%" echo ^<html lang="ru"^>^<head^>^<meta charset="UTF-8"^>^<title^>ExecChecker v2.2 Report^</title^>
>>"%HTML%" echo ^<style^>
>>"%HTML%" echo *{margin:0;padding:0;box-sizing:border-box;}
>>"%HTML%" echo body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0a0e14;color:#c8d6e5;min-height:100vh;padding:40px 20px;background-image:radial-gradient(circle at 20%% 0%%,rgba(0,229,255,0.08) 0%%,transparent 45%%),radial-gradient(circle at 80%% 100%%,rgba(255,0,128,0.06) 0%%,transparent 45%%);}
>>"%HTML%" echo .container{max-width:1100px;margin:0 auto;}
>>"%HTML%" echo .header{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid #1e2a3a;position:relative;}
>>"%HTML%" echo .header h1{font-size:56px;font-weight:900;letter-spacing:8px;background:linear-gradient(90deg,#00e5ff,#7c4dff,#ff007a,#00e5ff);background-size:200%% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shine 4s linear infinite;filter:drop-shadow(0 0 20px rgba(0,229,255,0.4));}
>>"%HTML%" echo @keyframes shine{to{background-position:200%% center;}}
>>"%HTML%" echo .header .sub{margin-top:12px;color:#4a5a6a;font-size:14px;letter-spacing:4px;text-transform:uppercase;}
>>"%HTML%" echo .header .authors{margin-top:16px;color:#7c8a9a;font-size:13px;letter-spacing:2px;}
>>"%HTML%" echo .verdict{margin:30px 0;padding:24px 30px;border-radius:14px;background:linear-gradient(135deg,rgba(255,51,68,0.12),rgba(255,51,68,0.02));border:1px solid rgba(255,51,68,0.35);text-align:center;position:relative;overflow:hidden;}
>>"%HTML%" echo .verdict.clean{background:linear-gradient(135deg,rgba(0,255,136,0.12),rgba(0,255,136,0.02));border-color:rgba(0,255,136,0.35);}
>>"%HTML%" echo .verdict .label{font-size:12px;color:#6a7a8a;letter-spacing:6px;text-transform:uppercase;margin-bottom:8px;}
>>"%HTML%" echo .verdict .value{font-size:38px;font-weight:900;letter-spacing:4px;color:%VERDICT_COLOR%;text-shadow:0 0 25px %VERDICT_COLOR%;}
>>"%HTML%" echo .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin:30px 0;}
>>"%HTML%" echo .stat{background:linear-gradient(180deg,#131a24,#0f151d);border:1px solid #1e2a3a;border-radius:12px;padding:22px 18px;text-align:center;transition:all 0.3s;position:relative;overflow:hidden;}
>>"%HTML%" echo .stat:hover{transform:translateY(-3px);border-color:#00e5ff;box-shadow:0 10px 30px rgba(0,229,255,0.15);}
>>"%HTML%" echo .stat .icon{font-size:22px;margin-bottom:8px;opacity:0.8;}
>>"%HTML%" echo .stat .num{font-size:34px;font-weight:800;color:#00e5ff;line-height:1;text-shadow:0 0 15px rgba(0,229,255,0.5);}
>>"%HTML%" echo .stat .num.bad{color:#ff3344;text-shadow:0 0 15px rgba(255,51,68,0.5);}
>>"%HTML%" echo .stat .num.good{color:#00ff88;text-shadow:0 0 15px rgba(0,255,136,0.5);}
>>"%HTML%" echo .stat .lbl{margin-top:10px;font-size:11px;color:#5a6a7a;letter-spacing:2px;text-transform:uppercase;}
>>"%HTML%" echo .progress{height:10px;background:#0f151d;border-radius:6px;overflow:hidden;margin:8px 0 20px;border:1px solid #1e2a3a;}
>>"%HTML%" echo .progress .fill{height:100%%;background:linear-gradient(90deg,#00e5ff,#7c4dff);transition:width 1s ease;box-shadow:0 0 15px rgba(0,229,255,0.6);}
>>"%HTML%" echo .card{background:linear-gradient(180deg,#131a24,#0f151d);border:1px solid #1e2a3a;border-radius:14px;padding:28px;margin:24px 0;position:relative;overflow:hidden;}
>>"%HTML%" echo .card::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%%;background:linear-gradient(180deg,#00e5ff,#7c4dff);}
>>"%HTML%" echo .card h2{font-size:18px;color:#00e5ff;letter-spacing:4px;text-transform:uppercase;margin-bottom:18px;padding-left:14px;font-weight:700;}
>>"%HTML%" echo pre{background:#080b10;padding:22px;border-radius:10px;border:1px solid #1a2330;overflow-x:auto;font-family:'Cascadia Code','Consolas',monospace;font-size:13px;line-height:1.7;color:#8aa4c0;max-height:500px;}
>>"%HTML%" echo .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;margin:0 6px 6px 0;background:rgba(0,229,255,0.1);color:#00e5ff;border:1px solid rgba(0,229,255,0.3);}
>>"%HTML%" echo .badge.bad{background:rgba(255,51,68,0.12);color:#ff3344;border-color:rgba(255,51,68,0.4);}
>>"%HTML%" echo .badge.good{background:rgba(0,255,136,0.12);color:#00ff88;border-color:rgba(0,255,136,0.4);}
>>"%HTML%" echo .footer{text-align:center;margin-top:50px;padding-top:25px;border-top:1px solid #1e2a3a;color:#4a5a6a;font-size:12px;letter-spacing:3px;}
>>"%HTML%" echo .footer .dot{color:#00e5ff;margin:0 12px;}
>>"%HTML%" echo @keyframes pulse{0%%,100%%{opacity:1;}50%%{opacity:0.5;}}
>>"%HTML%" echo .pulse{animation:pulse 2s infinite;}
>>"%HTML%" echo ^</style^>^</head^>^<body^>
>>"%HTML%" echo ^<div class="container"^>
>>"%HTML%" echo ^<div class="header"^>
>>"%HTML%" echo ^<h1^>EXEC CHECKER^</h1^>
>>"%HTML%" echo ^<div class="sub"^>Roblox Executor Scanner v2.2^</div^>
>>"%HTML%" echo ^<div class="authors"^>magz1m ^&amp; DeepSeek</div^>
>>"%HTML%" echo ^</div^>

if !FOUND! gtr 0 (
    >>"%HTML%" echo ^<div class="verdict"^>
    >>"%HTML%" echo ^<div class="label"^>SCAN VERDICT^</div^>
    >>"%HTML%" echo ^<div class="value pulse"^>%VERDICT_TEXT%^</div^>
    >>"%HTML%" echo ^</div^>
) else (
    >>"%HTML%" echo ^<div class="verdict clean"^>
    >>"%HTML%" echo ^<div class="label"^>SCAN VERDICT^</div^>
    >>"%HTML%" echo ^<div class="value"^>CLEAN^</div^>
    >>"%HTML%" echo ^</div^>
)

>>"%HTML%" echo ^<div class="stats"^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>#^</div^>^<div class="num"^>%CHECKED%^</div^>^<div class="lbl"^>Проверено^</div^>^</div^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>!^</div^>^<div class="num bad"^>%FOUND%^</div^>^<div class="lbl"^>Найдено^</div^>^</div^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>F^</div^>^<div class="num"^>%FOLDERS_FOUND%^</div^>^<div class="lbl"^>Папки^</div^>^</div^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>R^</div^>^<div class="num"^>%REG_FOUND%^</div^>^<div class="lbl"^>Реестр^</div^>^</div^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>P^</div^>^<div class="num"^>%PROCS_FOUND%^</div^>^<div class="lbl"^>Процессы^</div^>^</div^>
>>"%HTML%" echo ^<div class="stat"^>^<div class="icon"^>A^</div^>^<div class="num"^>%STARTUP_FOUND%^</div^>^<div class="lbl"^>Автозапуск^</div^>^</div^>
>>"%HTML%" echo ^</div^>

>>"%HTML%" echo ^<div class="card"^>
>>"%HTML%" echo ^<h2^>Сводка по категориям^</h2^>
>>"%HTML%" echo ^<span class="badge"^>Папки: %FOLDERS_FOUND%^</span^>
>>"%HTML%" echo ^<span class="badge"^>Процессы: %PROCS_FOUND%^</span^>
>>"%HTML%" echo ^<span class="badge"^>Реестр: %REG_FOUND%^</span^>
>>"%HTML%" echo ^<span class="badge"^>Ярлыки: %LNK_FOUND%^</span^>
>>"%HTML%" echo ^<span class="badge"^>TEMP: %TEMP_FOUND%^</span^>
>>"%HTML%" echo ^<span class="badge"^>Автозапуск: %STARTUP_FOUND%^</span^>
>>"%HTML%" echo ^</div^>

>>"%HTML%" echo ^<div class="card"^>
>>"%HTML%" echo ^<h2^>Полный лог сканирования^</h2^>
>>"%HTML%" echo ^<pre^>
type "%REPORT%" >> "%HTML%"
>>"%HTML%" echo ^</pre^>
>>"%HTML%" echo ^</div^>

>>"%HTML%" echo ^<div class="footer"^>
>>"%HTML%" echo ExecChecker v2.2 ^<span class="dot"^>•^</span^> %DATE% %TIME% ^<span class="dot"^>•^</span^> by magz1m ^&amp; DeepSeek
>>"%HTML%" echo ^</div^>
>>"%HTML%" echo ^</div^>^</body^>^</html^>

exit /b


:: ================================================================
:: ПРЕДЛОЖЕНИЯ В КОНЦЕ
:: ================================================================
:open_prompts

if !FOLDER_COUNT! gtr 0 (
    echo.
    set "TMPCOL============================================================"
    call :yellow
    set "TMPCOL=   НАЙДЕННЫЕ ПАПКИ ЭКЗЕКЬЮТЕРОВ:"
    call :yellow
    set "TMPCOL============================================================"
    call :yellow
    echo.
    for /l %%i in (1,1,!FOLDER_COUNT!) do (
        set "TMP=!FOLDER_%%i!"
        set "TMPCOL=   %%i. !TMP!"
        call :white
    )
    echo.
    set "TMPCOL=   0. Отмена"
    call :gray
    echo.
    set "PICK="
    set /p "PICK=   Введите номер папки для открытия: "

    if defined PICK if not "!PICK!"=="0" (
        set "TMP="
        for /l %%i in (1,1,!FOLDER_COUNT!) do (
            if "!PICK!"=="%%i" set "TMP=!FOLDER_%%i!"
        )
        if defined TMP (
            set "TMPCOL=   Открываю: !TMP!"
            call :cyan
            start "" explorer "!TMP!"
        ) else (
            set "TMPCOL=   [!] Неверный номер"
            call :red
        )
    )
)

if !FOUND! gtr 0 (
    echo.
    set "TMPCOL============================================================"
    call :yellow
    set "TMPCOL=   Открыть отчёт?  [T] text  |  [H] html  |  [N] нет"
    call :yellow
    set "TMPCOL============================================================"
    call :yellow
    echo.
    set "OPEN="
    set /p "OPEN=   Ваш выбор: "
    if /i "!OPEN!"=="T" start "" notepad "%REPORT%"
    if /i "!OPEN!"=="H" start "" "%HTML%"
    echo.
)
exit /b