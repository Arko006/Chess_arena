'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { ChessPiece } from './ChessPieces';
import { sounds } from '@/lib/sounds';

interface ChessboardProps {
  fen: string;
  orientation?: 'white' | 'black';
  playerColor?: 'white' | 'black' | null;
  disabled?: boolean;
  isCheck?: boolean;
  turn?: 'w' | 'b';
  lastMove?: { from: string; to: string } | null;
  onMove?: (from: string, to: string, promotion?: string) => void;
}

export const Chessboard: React.FC<ChessboardProps> = ({
  fen,
  orientation = 'white',
  playerColor,
  disabled = false,
  isCheck = false,
  turn = 'w',
  lastMove = null,
  onMove,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<string | null>(null);

  // Local chess instance for legal move preview and UI highlights
  const localChess = useMemo(() => {
    const c = new Chess();
    try {
      c.load(fen);
    } catch {
      c.reset();
    }
    return c;
  }, [fen]);

  // Find king square if in check
  const checkSquare = useMemo(() => {
    if (!isCheck) return null;
    const board = localChess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [isCheck, localChess, turn]);

  // Generate board files and ranks based on orientation
  const files = useMemo(() => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return orientation === 'black' ? [...list].reverse() : list;
  }, [orientation]);

  const ranks = useMemo(() => {
    const list = [8, 7, 6, 5, 4, 3, 2, 1];
    return orientation === 'black' ? [...list].reverse() : list;
  }, [orientation]);

  // Handle square selection
  const handleSquareClick = (square: string) => {
    if (disabled) return;

    // If waiting for promotion selection, ignore clicks
    if (pendingPromotion) return;

    // If clicking on an already selected square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Check if clicking on one of the legal destination squares
    if (selectedSquare) {
      const matchMove = legalMoves.find((m) => m.to === square);
      if (matchMove) {
        handleExecuteMove(selectedSquare, square);
        return;
      }
    }

    // Otherwise, selecting a new piece
    const piece = localChess.get(square as Square);
    if (!piece) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Check if player is allowed to move this piece
    const pieceColorName = piece.color === 'w' ? 'white' : 'black';
    if (playerColor && playerColor !== pieceColorName) {
      // Cannot select opponent piece
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (turn !== piece.color) {
      // Not this color's turn
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Calculate legal destination moves
    const moves = localChess.moves({ square: square as Square, verbose: true });
    setSelectedSquare(square);
    setLegalMoves(moves);
  };

  const handleExecuteMove = (from: string, to: string) => {
    // Check if move is a pawn promotion
    const piece = localChess.get(from as Square);
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = to.endsWith('8') || to.endsWith('1');

    if (isPawn && isPromotionRank) {
      setPendingPromotion({ from, to });
      return;
    }

    commitMove(from, to);
  };

  const commitMove = (from: string, to: string, promotion?: string) => {
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);

    const targetPiece = localChess.get(to as Square);
    if (targetPiece) {
      sounds.playCapture();
    } else {
      sounds.playMove();
    }

    if (onMove) {
      onMove(from, to, promotion);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, square: string) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    const piece = localChess.get(square as Square);
    if (!piece) return;

    const pieceColorName = piece.color === 'w' ? 'white' : 'black';
    if (playerColor && playerColor !== pieceColorName) {
      e.preventDefault();
      return;
    }

    if (turn !== piece.color) {
      e.preventDefault();
      return;
    }

    setDraggedSquare(square);
    setSelectedSquare(square);
    const moves = localChess.moves({ square: square as Square, verbose: true });
    setLegalMoves(moves);

    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toSquare: string) => {
    e.preventDefault();
    const fromSquare = draggedSquare || e.dataTransfer.getData('text/plain');
    setDraggedSquare(null);

    if (!fromSquare || fromSquare === toSquare) return;

    const isLegal = legalMoves.some((m) => m.to === toSquare);
    if (isLegal) {
      handleExecuteMove(fromSquare, toSquare);
    }
  };

  return (
    <div className="relative w-full max-w-[560px] aspect-square select-none shadow-2xl rounded-xl overflow-hidden border-4 border-[#2c3345] bg-[#1a1f2c]">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank, rIdx) =>
          files.map((file, fIdx) => {
            const square = `${file}${rank}`;
            const piece = localChess.get(square as Square);
            const isLight = (rIdx + fIdx) % 2 === 0;

            const isSelected = selectedSquare === square;
            const isLegalTarget = legalMoves.some((m) => m.to === square);
            const isCaptureTarget = isLegalTarget && piece !== null;
            const isCheckSquare = checkSquare === square;
            const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);

            let bgClass = isLight ? 'bg-[#eeeed2]' : 'bg-[#769656]';
            if (isLastMoveSquare) {
              bgClass = isLight ? 'bg-[#f5f682]' : 'bg-[#baca44]';
            }
            if (isSelected) {
              bgClass = 'bg-[#f7ec59]';
            }
            if (isCheckSquare) {
              bgClass = 'bg-[#ef4444] animate-pulse';
            }

            return (
              <div
                key={square}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${bgClass}`}
                onClick={() => handleSquareClick(square)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
              >
                {/* Coordinates */}
                {fIdx === 0 && (
                  <span className={`absolute top-1 left-1.5 text-[10px] font-bold ${isLight ? 'text-[#769656]' : 'text-[#eeeed2]'}`}>
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span className={`absolute bottom-0.5 right-1.5 text-[10px] font-bold ${isLight ? 'text-[#769656]' : 'text-[#eeeed2]'}`}>
                    {file}
                  </span>
                )}

                {/* Chess Piece */}
                {piece && (
                  <div
                    draggable={!disabled && (!playerColor || playerColor === (piece.color === 'w' ? 'white' : 'black')) && turn === piece.color}
                    onDragStart={(e) => handleDragStart(e, square)}
                    className="w-[84%] h-[84%] z-10 cursor-grab active:cursor-grabbing transition-transform hover:scale-105"
                  >
                    <ChessPiece type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal Move Indicator */}
                {isLegalTarget && !isCaptureTarget && (
                  <div className="absolute w-4 h-4 rounded-full bg-black/25 pointer-events-none z-20 animate-fade-in" />
                )}

                {/* Capture Ring Indicator */}
                {isCaptureTarget && (
                  <div className="absolute w-full h-full border-4 border-black/30 rounded-full pointer-events-none z-20" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e2330] border border-gray-700 rounded-xl p-5 shadow-2xl text-center max-w-xs w-full animate-in zoom-in-95">
            <h3 className="text-white font-bold text-lg mb-3">Choose Promotion Piece</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { type: 'q', label: 'Queen' },
                { type: 'r', label: 'Rook' },
                { type: 'b', label: 'Bishop' },
                { type: 'n', label: 'Knight' },
              ].map((promo) => (
                <button
                  key={promo.type}
                  onClick={() => commitMove(pendingPromotion.from, pendingPromotion.to, promo.type)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#283042] hover:bg-[#3b4760] transition-colors border border-gray-600"
                >
                  <div className="w-10 h-10">
                    <ChessPiece type={promo.type} color={turn} />
                  </div>
                  <span className="text-[11px] text-gray-300 font-semibold mt-1">{promo.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingPromotion(null)}
              className="text-xs text-gray-400 hover:text-white transition-colors underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};