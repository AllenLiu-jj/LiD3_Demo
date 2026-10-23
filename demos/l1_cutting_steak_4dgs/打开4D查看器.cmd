@echo off
setlocal
cd /d "%~dp0"
title 4D Gaussian Viewer

if exist "runtime\python.exe" goto ownpython
where python >nul 2>nul && goto syspython

echo.
echo  [!] Python was not found, and the bundled runtime folder is missing.
echo      Re-extract the whole archive, then run this file again.
echo.
pause
exit /b 1

:ownpython
"runtime\python.exe" launch.py
goto done

:syspython
echo  Using the Python already installed on this computer.
python launch.py
goto done

:done
echo.
echo  Server stopped. Press any key to close this window.
pause >nul
