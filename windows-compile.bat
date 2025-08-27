@echo off
REM Windows Compilation Script for Betza-Enhanced Musketeer-Stockfish
REM Run this from "x64 Native Tools Command Prompt for VS"

echo Compiling Betza-Enhanced Musketeer-Stockfish for Windows...
echo.

REM Clean previous builds
if exist *.obj del *.obj
if exist *.exe del *.exe

echo [1/4] Compiling core files...
cl /c /EHsc /O2 /DNDEBUG /DIS_64BIT /DUSE_POPCNT /arch:AVX2 ^
   benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp ^
   main.cpp material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp ^
   position.cpp psqt.cpp search.cpp thread.cpp timeman.cpp tt.cpp ^
   uci.cpp ucioption.cpp xboard.cpp betza.cpp syzygy\tbprobe.cpp

if %errorlevel% neq 0 (
    echo ERROR: Compilation failed!
    pause
    exit /b 1
)

echo [2/4] Linking executable...
link /out:stockfish-betza-windows.exe *.obj

if %errorlevel% neq 0 (
    echo ERROR: Linking failed!
    pause
    exit /b 1
)

echo [3/4] Creating optimized BMI2 version...
cl /c /EHsc /O2 /DNDEBUG /DIS_64BIT /DUSE_POPCNT /DUSE_BMI2 /arch:AVX2 ^
   benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp ^
   main.cpp material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp ^
   position.cpp psqt.cpp search.cpp thread.cpp timeman.cpp tt.cpp ^
   uci.cpp ucioption.cpp xboard.cpp betza.cpp syzygy\tbprobe.cpp

link /out:stockfish-betza-bmi2-windows.exe *.obj

echo [4/4] Testing executables...
echo Testing standard version:
echo quit | stockfish-betza-windows.exe | find "Stockfish"
echo.
echo Testing BMI2 version:  
echo quit | stockfish-betza-bmi2-windows.exe | find "Stockfish"

echo.
echo SUCCESS! Windows executables created:
echo - stockfish-betza-windows.exe (Standard x86-64 + AVX2)
echo - stockfish-betza-bmi2-windows.exe (BMI2 optimized)
echo.
echo File sizes:
dir /b *.exe | findstr stockfish
echo.
echo Ready for Winboard integration!
pause