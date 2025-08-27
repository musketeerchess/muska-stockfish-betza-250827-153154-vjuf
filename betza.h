/*
  Musketeer-Stockfish Betza Integration
  
  Minimal Betza notation support for custom pieces
*/

#ifndef BETZA_H_INCLUDED
#define BETZA_H_INCLUDED

#include <string>
#include <map>
#include <vector>
#include "types.h"

// Simple Betza move pattern structure
struct BetzaPattern {
    std::string notation;
    std::vector<std::pair<int, int>> offsets; // (file_offset, rank_offset) pairs
    bool isRider;  // true for sliding pieces, false for leapers
    bool captureOnly;
    bool quietOnly;
};

// Betza piece definition
struct BetzaPiece {
    std::string name;
    std::vector<BetzaPattern> patterns;
};

// Betza notation manager
class BetzaManager {
public:
    void init();
    void addCustomPiece(PieceType pt, const std::string& notation, const std::string& name = "");
    Bitboard getAttacks(PieceType pt, Square from, Bitboard occupied, bool capturesOnly = false) const;
    bool isCustomPiece(PieceType pt) const;
    
private:
    std::map<PieceType, BetzaPiece> customPieces;
    BetzaPattern parsePattern(const std::string& pattern);
    std::vector<std::pair<int, int>> getAtomOffsets(char atom);
};

extern BetzaManager betzaManager;

// Helper function for move generation
Bitboard attacks_from_betza(Color c, PieceType pt, Square from, Bitboard occupied = 0);

#endif // #ifndef BETZA_H_INCLUDED