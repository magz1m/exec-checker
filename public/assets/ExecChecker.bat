@echo off
chcp 65001 >nul
title ExecChecker - magz1m ^& DeepSeek
setlocal EnableDelayedExpansion

:: ================================================================
::   ExecChecker v1.0
::   Сканер Roblox-исполнителей (executors)
::   Авторы: magz1m & DeepSeek
::
::   ВАЖНО: файл сохранять как UTF-8 (без BOM)
:: ================================================================

:: --- Проверка PowerShell (для цветов) ---
set "HAS_PS=1"
where powershell >nul 2>&1
if !errorlevel! neq 0 set "HAS_PS=0"

:: --- Счётчики ---
set /a FOUND=0
set /a CHECKED=0
set /a FOLDER_COUNT=0
set "REPORT=%~dp0ExecChecker_report.txt"

> "%REPORT%" echo Отчет ExecChecker - %DATE% %TIME%
>>"%REPORT%" echo ================================================

:: --- Зелёный фон для всего текста ---
if "!HAS_PS!"=="1" (
    color 0A
) else (
    color 0A
)

cls
call :banner
call :admin_check

call :section "1 / 5" "■□□□□" "ПОИСК ПАПОК ЭКЗЕКЬЮТЕРОВ"
call :scan_folders

call :section "2 / 5" "■■□□□" "ПРОВЕРКА ЗАПУЩЕННЫХ ПРОЦЕССОВ"
call :scan_processes

call :section "3 / 5" "■■■□□" "ПРОВЕРКА РЕЕСТРА"
call :scan_registry

call :section "4 / 5" "■■■■□" "ПРОВЕРКА ЯРЛЫКОВ"
call :scan_shortcuts

call :section "5 / 5" "■■■■■" "АНАЛИЗ ВРЕМЕННЫХ ФАЙЛОВ"
call :scan_temp

call :summary
call :open_prompts

echo.
echo   Нажмите любую клавишу для выхода из программы...
pause >nul
color 07
endlocal
exit /b 0


:: ================================================================
:: ЦВЕТНЫЕ ХЕЛПЕРЫ
:: ================================================================
:red
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Red"
) else (
    echo !TMPCOL!
)
exit /b

:yellow
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Yellow"
) else (
    echo !TMPCOL!
)
exit /b

:cyan
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Cyan"
) else (
    echo !TMPCOL!
)
exit /b

:magenta
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor Magenta"
) else (
    echo !TMPCOL!
)
exit /b

:white
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor White"
) else (
    echo !TMPCOL!
)
exit /b

:gray
if "!HAS_PS!"=="1" (
    powershell -NoProfile -Command "Write-Host $env:TMPCOL -ForegroundColor DarkGray"
) else (
    echo !TMPCOL!
)
exit /b


:: ================================================================
:: БАННЕР
:: ================================================================
:banner
echo.
set "TMPCOL=╔══════════════════════════════════════════════════════════╗"
call :cyan
set "TMPCOL=║                                                          ║"
call :cyan
set "TMPCOL=║                E X E C   C H E C K E R                   ║"
call :cyan
set "TMPCOL=║                       v 1 . 0                            ║"
call :cyan
set "TMPCOL=║                magz1m  &  DeepSeek                       ║"
call :cyan
set "TMPCOL=║                                                          ║"
call :cyan
set "TMPCOL=╚══════════════════════════════════════════════════════════╝"
call :cyan
echo.
exit /b


:: ================================================================
:: ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА
:: ================================================================
:admin_check
net session >nul 2>&1
if !errorlevel! equ 0 (
    set "TMPCOL=  [+] Программа запущена с правами администратора"
    call :white
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
call :cyan
set "TMPCOL=  %~1  [%~2]  %~3"
call :cyan
set "TMPCOL============================================================"
call :cyan
echo.
exit /b


:: ================================================================
:: ПОИСК ПАПОК
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


:: ================================================================
:: ПРОВЕРКА ОДНОЙ ПАПКИ
:: ================================================================
:chk
set "NAME=%~1"
set "DIR=%~2"
set /a CHECKED+=1

if exist "!DIR!" (
    set /a FOUND+=1
    set /a FOLDER_COUNT+=1
    set "FOLDER_!FOLDER_COUNT!=!DIR!"
    set "TMPCOL=  [X] !NAME! - НАЙДЕНО"
    call :red
    set "TMPCOL=      Путь: !DIR!"
    call :gray
    >>"%REPORT%" echo [ПАПКА] !NAME! : !DIR!
) else (
    set "TMPCOL=  [+] !NAME! - чисто"
    call :white
)
exit /b


:: ================================================================
:: ПРОВЕРКА ПРОЦЕССОВ
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
    set "TMPCOL=  [!] %~1 - ЗАПУЩЕН"
    call :yellow
    >>"%REPORT%" echo [ПРОЦЕСС] %~1
) else (
    set "TMPCOL=  [.] %~1 - не активен"
    call :gray
)
exit /b


:: ================================================================
:: ПРОВЕРКА РЕЕСТРА
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
    set "TMPCOL=  [X] %~2 - НАЙДЕНО В РЕЕСТРЕ"
    call :red
    set "TMPCOL=      Ключ: %~1"
    call :gray
    >>"%REPORT%" echo [РЕЕСТР] %~1
) else (
    set "TMPCOL=  [+] %~2 - ключа нет"
    call :white
)
exit /b


:: ================================================================
:: ПРОВЕРКА ЯРЛЫКОВ
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
    set "TMPCOL=  [X] %~1 - ЯРЛЫК НАЙДЕН"
    call :red
    set "TMPCOL=      Файл: %~2"
    call :gray
    >>"%REPORT%" echo [ЯРЛЫК] %~2
) else (
    set "TMPCOL=  [+] %~1 - ярлыка нет"
    call :white
)
exit /b


:: ================================================================
:: АНАЛИЗ ВРЕМЕННЫХ ФАЙЛОВ
:: ================================================================
:scan_temp
set "TMPHIT=0"
for %%P in (
    "executor*.dll"
    "inject*.dll"
    "WeAreDevs*.dll"
    "Krnl*.dll"
    "Synapse*.dll"
    "Solara*.dll"
    "*rbxstu*.dll"
    "autoexec*.lua"
) do (
    for %%F in ("%TEMP%\%%~P") do (
        if exist "%%~F" (
            set /a FOUND+=1
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
    call :white
)
exit /b


:: ================================================================
:: ИТОГИ
:: ================================================================
:summary
echo.
set "TMPCOL=╔══════════════════════════════════════════════════════════╗"
call :cyan
set "TMPCOL=║                   РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ                ║"
call :cyan
set "TMPCOL=╚══════════════════════════════════════════════════════════╝"
call :cyan
echo.
set "TMPCOL=   Проверено:  !CHECKED!"
call :white
set "TMPCOL=   Найдено:    !FOUND!"
call :white
echo.

>>"%REPORT%" echo ------------------------------------------------
>>"%REPORT%" echo ВСЕГО ПРОВЕРЕНО: !CHECKED!
>>"%REPORT%" echo ВСЕГО НАЙДЕНО:   !FOUND!

if !FOUND! gtr 0 (
    set "TMPCOL=  [!] ВНИМАНИЕ: НА СИСТЕМЕ ОБНАРУЖЕНЫ ЭКЗЕКЬЮТЕРЫ!"
    call :red
    set "TMPCOL=      Подробности в отчёте: %REPORT%"
    call :gray
) else (
    set "TMPCOL=  [+] СИСТЕМА ЧИСТА - экзекьютеры не найдены"
    call :white
    set "TMPCOL=      Отчёт сохранён: %REPORT%"
    call :gray
)
echo.
exit /b


:: ================================================================
:: ПРЕДЛОЖЕНИЕ ОТКРЫТЬ ПАПКИ И ОТЧЁТ
:: ================================================================
:open_prompts

:: --- Открыть найденные папки ---
if !FOLDER_COUNT! gtr 0 (
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
    set /p "PICK=   Введите номер папки для открытия: "

    if not "!PICK!"=="0" (
        if not "!PICK!"=="" (
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
    echo.
)

:: --- Открыть отчёт ---
if !FOUND! gtr 0 (
    set "TMPCOL============================================================"
    call :yellow
    set "TMPCOL=   Открыть отчёт для просмотра обнаруженных файлов?"
    call :yellow
    set "TMPCOL============================================================"
    call :yellow
    echo.
    set /p "OPEN=   Открыть отчёт? [Д/Н]: "
    if /i "!OPEN!"=="Д" start "" notepad "%REPORT%"
    if /i "!OPEN!"=="Y" start "" notepad "%REPORT%"
    echo.
)
exit /b