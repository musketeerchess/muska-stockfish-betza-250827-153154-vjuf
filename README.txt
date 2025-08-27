Betza Notation Integration Files for Musketeer-Stockfish
==================================================

These files integrate Betza notation functionality into Musketeer-Stockfish.

INSTALLATION INSTRUCTIONS FOR WINDOWS:
1. Download Musketeer-Stockfish from: https://github.com/ianfab/Musketeer-Stockfish
2. Replace/copy these files into the src/ directory:
   - betza.h (NEW FILE - add this)
   - betza.cpp (NEW FILE - add this) 
   - types.h (REPLACE existing file)
   - movegen.cpp (REPLACE existing file)
   - position.h (REPLACE existing file)

3. Compile with Visual Studio:
   - Open "x64 Native Tools Command Prompt"
   - Navigate to src/ directory
   - Run: nmake -f Makefile COMP=msvc ARCH=x86-64-bmi2 build

FEATURES ADDED:
- 16 custom piece types (CUSTOM_PIECE_1 through CUSTOM_PIECE_16)
- Betza notation parsing and move generation
- "HW" piece pattern (Three-leaper + Wazir) example included
- Full UCI protocol compatibility
- Preserved all existing Musketeer chess functionality

TESTING:
The compiled engine includes the "HW" piece that moves either 1 or 3 squares orthogonally.
Test in Winboard by setting up as UCI engine.

For questions or issues, refer to the integration documentation.