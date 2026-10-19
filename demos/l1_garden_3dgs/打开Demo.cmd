@echo off
setlocal
set PYTHONUTF8=1
python "%~dp0serve.py" %*
if errorlevel 1 pause
