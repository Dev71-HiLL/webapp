// chess/chess.c
#include <stdlib.h>
#include <string.h>
#include <emscripten/emscripten.h>

// Représentation minimale: buffer FEN et coup retourné sous forme "e2e4"
static char LAST_MOVE[8] = "e2e4";

// Exposé: renvoie un coup "naïf" pour tester l'intégration
EMSCRIPTEN_KEEPALIVE
const char* best_move(const char* fen) {
  // TODO: parser FEN, générer coups, choisir via éval. Ici on renvoie un coup fixe.
  (void)fen; // unused for maintenant
  strcpy(LAST_MOVE, "e2e4");
  return LAST_MOVE;
}

// Exposé: addition simple pour valider l'appel WASM
EMSCRIPTEN_KEEPALIVE
int add(int a, int b) {
  return a + b;
}

