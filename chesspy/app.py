# app.py — FastAPI chess backend avec mapping des pièces
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import chess
import random

app = FastAPI(title="ChessPy")

# -----------------------------
# Modèles d'E/S
# -----------------------------
class NewGameOut(BaseModel):
    game_id: str
    fen: str
    turn: str
    mapping: dict

class MoveIn(BaseModel):
    game_id: str
    uci: str  # ex: "e2e4" ou "e7e8q" (promotion)

class MovesFromIn(BaseModel):
    game_id: str
    square: str  # "e2"

class StateIn(BaseModel):
    game_id: str

class BestMoveIn(BaseModel):
    fen: str

class MoveOut(BaseModel):
    ok: bool
    fen: str
    turn: str
    mapping: dict
    status: dict  # check, checkmate, draw, stalemate, repetition

class MovesFromOut(BaseModel):
    from_square: str
    legal_targets: list[str]

class HealthOut(BaseModel):
    status: str

# -----------------------------
# Stockage en mémoire (simple)
# -----------------------------
GAMES: dict[str, chess.Board] = {}

# -----------------------------
# Helpers
# -----------------------------
FILES = "abcdefgh"
RANKS = "12345678"

def idx_to_square(idx: int) -> str:
    """0..63 -> 'a8'..'h1' (convention python-chess)"""
    file = FILES[idx % 8]
    rank = RANKS[7 - (idx // 8)]
    return f"{file}{rank}"

def piece_code(p: chess.Piece) -> str:
    """wp, wn, wb, wr, wq, wk / bp, ..."""
    color = "w" if p.color == chess.WHITE else "b"
    symbol = p.symbol().lower()  # p, n, b, r, q, k
    return f"{color}{symbol}"

def board_mapping(board: chess.Board) -> dict:
    """Mapping { 'a1': 'wr', 'b1': 'wn', ... }"""
    mp: dict[str, str] = {}
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            mp[idx_to_square(sq)] = piece_code(p)
    return mp

def status_flags(board: chess.Board) -> dict:
    return {
        "check": board.is_check(),
        "checkmate": board.is_checkmate(),
        "stalemate": board.is_stalemate(),
        "insufficient_material": board.is_insufficient_material(),
        "seventyfive_moves": board.is_seventyfive_moves(),
        "fivefold_repetition": board.is_fivefold_repetition(),
        "draw": board.is_variant_draw() or board.is_stalemate() or board.is_insufficient_material()
                or board.is_seventyfive_moves() or board.is_fivefold_repetition(),
    }

def naive_best_move(board: chess.Board) -> chess.Move | None:
    """IA de base : aléatoire pondéré (captures priorisées). Remplaçable par Stockfish plus tard."""
    legal = list(board.legal_moves)
    if not legal:
        return None
    # Priorise les captures simples
    captures = [m for m in legal if board.is_capture(m)]
    return random.choice(captures or legal)

# -----------------------------
# Endpoints
# -----------------------------
@app.get("/health", response_model=HealthOut)
def health():
    return {"status": "ok"}

@app.post("/new", response_model=NewGameOut)
def new_game():
    gid = str(uuid.uuid4())
    board = chess.Board()  # position initiale
    GAMES[gid] = board
    return {
        "game_id": gid,
        "fen": board.fen(),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "mapping": board_mapping(board),
    }

@app.post("/state", response_model=NewGameOut)
def get_state(payload: StateIn):
    board = GAMES.get(payload.game_id)
    if not board:
        raise HTTPException(status_code=404, detail="game not found")
    return {
        "game_id": payload.game_id,
        "fen": board.fen(),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "mapping": board_mapping(board),
    }

@app.post("/moves_from", response_model=MovesFromOut)
def moves_from(payload: MovesFromIn):
    board = GAMES.get(payload.game_id)
    if not board:
        raise HTTPException(status_code=404, detail="game not found")
    try:
        sq = chess.parse_square(payload.square)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid square")
    legal_targets = []
    for mv in board.legal_moves:
        if mv.from_square == sq:
            legal_targets.append(idx_to_square(mv.to_square))
    return {"from_square": payload.square, "legal_targets": legal_targets}

@app.post("/move", response_model=MoveOut)
def play_move(payload: MoveIn):
    board = GAMES.get(payload.game_id)
    if not board:
        raise HTTPException(status_code=404, detail="game not found")
    try:
        mv = chess.Move.from_uci(payload.uci)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid uci")
    if mv not in board.legal_moves:
        raise HTTPException(status_code=422, detail="illegal move")
    board.push(mv)
    return {
        "ok": True,
        "fen": board.fen(),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "mapping": board_mapping(board),
        "status": status_flags(board),
    }

@app.post("/ai_move", response_model=MoveOut)
def ai_move(payload: StateIn):
    board = GAMES.get(payload.game_id)
    if not board:
        raise HTTPException(status_code=404, detail="game not found")
    mv = naive_best_move(board)
    if mv is None:
        return {
            "ok": False,
            "fen": board.fen(),
            "turn": "white" if board.turn == chess.WHITE else "black",
            "mapping": board_mapping(board),
            "status": status_flags(board),
        }
    board.push(mv)
    return {
        "ok": True,
        "fen": board.fen(),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "mapping": board_mapping(board),
        "status": status_flags(board),
    }

# Compatibilité avec ton proxy Node actuel: /api/chess/best_move -> POST {fen}
@app.post("/best_move")
def best_move(payload: BestMoveIn):
    try:
        board = chess.Board(payload.fen)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid fen")
    mv = naive_best_move(board)
    return {"move": mv.uci() if mv else None}

