# chesspy/app.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import chess
import math

app = FastAPI(title="Chess API (Python)")

# Autoriser CORS si tu veux appeler directement depuis le navigateur
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

class FenIn(BaseModel):
    fen: str

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,   # on ne l'évalue pas matériellement
}

def evaluate_material(board: chess.Board) -> int:
    """Score côté camp au trait (blancs positifs, noirs négatifs)."""
    score = 0
    for piece_type, val in PIECE_VALUES.items():
        score += len(board.pieces(piece_type, chess.WHITE)) * val
        score -= len(board.pieces(piece_type, chess.BLACK)) * val
    return score if board.turn == chess.WHITE else -score

def minimax(board: chess.Board, depth: int, alpha: int, beta: int, maximizing: bool) -> int:
    if depth == 0 or board.is_game_over():
        return evaluate_material(board)

    if maximizing:
        best = -math.inf
        for move in board.legal_moves:
            board.push(move)
            score = minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            if score > best:
                best = score
            if best > alpha:
                alpha = best
            if beta <= alpha:
                break
        return best
    else:
        best = math.inf
        for move in board.legal_moves:
            board.push(move)
            score = minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            if score < best:
                best = score
            if best < beta:
                beta = best
            if beta <= alpha:
                break
        return best

def pick_best_move(fen: str, depth: int = 2) -> Optional[str]:
    board = chess.Board(fen)
    best_move = None
    best_score = -math.inf
    alpha, beta = -math.inf, math.inf
    for move in board.legal_moves:
        board.push(move)
        score = minimax(board, depth - 1, alpha, beta, False)
        board.pop()
        if score > best_score:
            best_score = score
            best_move = move
        if score > alpha:
            alpha = score
    return best_move.uci() if best_move else None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/best_move")
def best_move(inp: FenIn):
    try:
        uci = pick_best_move(inp.fen, depth=2)
        return {"move": uci}
    except Exception as e:
        return {"error": str(e), "move": None}

