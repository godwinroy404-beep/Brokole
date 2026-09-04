@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo  Brokole - database setup
echo  ========================
echo.
echo  Applies any pending files from api\migrations\ to your MySQL database,
echo  using the credentials already in api\config.php.
echo.

if not exist "api\migrate.php" (
  echo  ERROR: api\migrate.php not found.
  echo  Put this file in G:\gradent\Bro-Ko-Le and run it from there.
  goto :end
)

REM ---- find PHP -------------------------------------------------------------
set "PHPEXE="

where php >nul 2>nul
if %errorlevel%==0 set "PHPEXE=php"

if not defined PHPEXE if exist "C:\xampp\php\php.exe"    set "PHPEXE=C:\xampp\php\php.exe"
if not defined PHPEXE if exist "C:\php\php.exe"          set "PHPEXE=C:\php\php.exe"
if not defined PHPEXE if exist "C:\laragon\bin\php\php.exe" set "PHPEXE=C:\laragon\bin\php\php.exe"

if not defined PHPEXE (
  for /d %%D in ("C:\wamp64\bin\php\php*") do (
    if exist "%%D\php.exe" set "PHPEXE=%%D\php.exe"
  )
)
if not defined PHPEXE (
  for /d %%D in ("C:\laragon\bin\php\php*") do (
    if exist "%%D\php.exe" set "PHPEXE=%%D\php.exe"
  )
)

if not defined PHPEXE (
  echo  Could not find php.exe.
  echo.
  echo  PHP is definitely installed - it is running your API - so either add it
  echo  to PATH, or run the migration with the full path, for example:
  echo.
  echo      C:\xampp\php\php.exe api\migrate.php
  echo.
  goto :end
)

echo  Using PHP: !PHPEXE!
echo.

"!PHPEXE!" "api\migrate.php"

echo.
echo  ------------------------------------------------------------------
echo  If it says "Applied 1 migration(s)", reload the account page and
echo  Skip Day will save. If it reported an error, copy the text above.
echo  ------------------------------------------------------------------

:end
echo.
pause
