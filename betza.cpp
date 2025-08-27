/*
  Musketeer-Stockfish Betza Integration
  
  Implementation of minimal Betza notation support
*/

#include "betza.h"
#include "bitboard.h"

BetzaManager betzaManager; // Global instance

void BetzaManager::init() {
    customPieces.clear();
    
    // Add some common Betza pieces as examples
    addCustomPiece(CUSTOM_PIECE_1, "N", "Knight-like");
    addCustomPiece(CUSTOM_PIECE_2, "K", "King-like"); 
    addCustomPiece(CUSTOM_PIECE_3, "R", "Rook-like");
    addCustomPiece(CUSTOM_PIECE_4, "B", "Bishop-like");
    addCustomPiece(CUSTOM_PIECE_5, "Q", "Queen-like");
    addCustomPiece(CUSTOM_PIECE_6, "mWcF", "Pawn-like");
    addCustomPiece(CUSTOM_PIECE_7, "WF", "Wazir-Ferz");
    addCustomPiece(CUSTOM_PIECE_8, "RN", "Amazon-like");
    addCustomPiece(CUSTOM_PIECE_9, "HW", "Three-Leaper-Wazir");
}

void BetzaManager::addCustomPiece(PieceType pt, const std::string& notation, const std::string& name) {
    if (!is_custom(pt)) return;
    
    BetzaPiece piece;
    piece.name = name.empty() ? ("Custom" + std::to_string(pt - CUSTOM_PIECES + 1)) : name;
    
    // Simple pattern parsing - just handle basic atoms for now
    if (notation == "N") {
        BetzaPattern pattern;
        pattern.notation = "N";
        pattern.offsets = {{2,1}, {2,-1}, {-2,1}, {-2,-1}, {1,2}, {1,-2}, {-1,2}, {-1,-2}};
        pattern.isRider = false;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "K") {
        BetzaPattern pattern;
        pattern.notation = "K";
        pattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}, {1,1}, {1,-1}, {-1,1}, {-1,-1}};
        pattern.isRider = false;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "R") {
        BetzaPattern pattern;
        pattern.notation = "R";
        pattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}};
        pattern.isRider = true;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "B") {
        BetzaPattern pattern;
        pattern.notation = "B";
        pattern.offsets = {{1,1}, {1,-1}, {-1,1}, {-1,-1}};
        pattern.isRider = true;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "Q") {
        BetzaPattern pattern;
        pattern.notation = "Q";
        pattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}, {1,1}, {1,-1}, {-1,1}, {-1,-1}};
        pattern.isRider = true;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "WF") {
        BetzaPattern pattern;
        pattern.notation = "WF";
        pattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}, {1,1}, {1,-1}, {-1,1}, {-1,-1}};
        pattern.isRider = false;
        pattern.captureOnly = false;
        pattern.quietOnly = false;
        piece.patterns.push_back(pattern);
    }
    else if (notation == "mWcF") {
        // Move like wazir, capture like ferz (pawn-like)
        BetzaPattern movePattern;
        movePattern.notation = "mW";
        movePattern.offsets = {{0,1}};
        movePattern.isRider = false;
        movePattern.captureOnly = false;
        movePattern.quietOnly = true;
        piece.patterns.push_back(movePattern);
        
        BetzaPattern capturePattern;
        capturePattern.notation = "cF";
        capturePattern.offsets = {{1,1}, {-1,1}};
        capturePattern.isRider = false;
        capturePattern.captureOnly = true;
        capturePattern.quietOnly = false;
        piece.patterns.push_back(capturePattern);
    }
    else if (notation == "RN") {
        // Rook + Knight (Amazon-like)
        BetzaPattern rookPattern;
        rookPattern.notation = "R";
        rookPattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}};
        rookPattern.isRider = true;
        rookPattern.captureOnly = false;
        rookPattern.quietOnly = false;
        piece.patterns.push_back(rookPattern);
        
        BetzaPattern knightPattern;
        knightPattern.notation = "N";
        knightPattern.offsets = {{2,1}, {2,-1}, {-2,1}, {-2,-1}, {1,2}, {1,-2}, {-1,2}, {-1,-2}};
        knightPattern.isRider = false;
        knightPattern.captureOnly = false;
        knightPattern.quietOnly = false;
        piece.patterns.push_back(knightPattern);
    }
    else if (notation == "HW") {
        // H (three-leaper) + W (wazir)
        BetzaPattern hPattern;
        hPattern.notation = "H";
        hPattern.offsets = {{3,0}, {-3,0}, {0,3}, {0,-3}};
        hPattern.isRider = false;
        hPattern.captureOnly = false;
        hPattern.quietOnly = false;
        piece.patterns.push_back(hPattern);
        
        BetzaPattern wPattern;
        wPattern.notation = "W";
        wPattern.offsets = {{1,0}, {-1,0}, {0,1}, {0,-1}};
        wPattern.isRider = false;
        wPattern.captureOnly = false;
        wPattern.quietOnly = false;
        piece.patterns.push_back(wPattern);
    }
    
    customPieces[pt] = piece;
}

Bitboard BetzaManager::getAttacks(PieceType pt, Square from, Bitboard occupied, bool capturesOnly) const {
    auto it = customPieces.find(pt);
    if (it == customPieces.end()) return 0;
    
    Bitboard attacks = 0;
    const BetzaPiece& piece = it->second;
    
    for (const auto& pattern : piece.patterns) {
        if (capturesOnly && pattern.quietOnly) continue;
        if (!capturesOnly && pattern.captureOnly) continue;
        
        for (const auto& offset : pattern.offsets) {
            int fileOffset = offset.first;
            int rankOffset = offset.second;
            
            if (pattern.isRider) {
                // Sliding piece
                Square to = from;
                while (true) {
                    int newSquare = to + fileOffset + 8 * rankOffset;
                    if (newSquare < SQ_A1 || newSquare > SQ_H8) break;
                    to = Square(newSquare);
                    
                    // Check if we wrapped around the board
                    if (abs(file_of(to) - file_of(Square(newSquare - fileOffset - 8 * rankOffset))) != abs(fileOffset)) break;
                    
                    attacks |= SquareBB[to];
                    
                    if (occupied & SquareBB[to]) break; // Blocked
                }
            } else {
                // Leaping piece
                int newSquare = from + fileOffset + 8 * rankOffset;
                if (newSquare >= SQ_A1 && newSquare <= SQ_H8) {
                    Square to = Square(newSquare);
                    if (abs(file_of(to) - file_of(from)) == abs(fileOffset) &&
                        abs(rank_of(to) - rank_of(from)) == abs(rankOffset)) {
                        attacks |= SquareBB[to];
                    }
                }
            }
        }
    }
    
    return attacks;
}

bool BetzaManager::isCustomPiece(PieceType pt) const {
    return customPieces.find(pt) != customPieces.end();
}

// Global helper function
Bitboard attacks_from_betza(Color c, PieceType pt, Square from, Bitboard occupied) {
    return betzaManager.getAttacks(pt, from, occupied);
}