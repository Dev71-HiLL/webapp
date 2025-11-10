// server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { pool, pingDB } from "./db.js";
import todos from "./routes/todos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Fichiers statiques (UI)
app.use(express.static(path.join(__dirname, "public")));

// Routes simples
app.get("/", (_req, res) => {
  // Sert /public/index.html
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/dbhealth", async (_req, res) => {
  try {
    const ok = await pingDB();
    res.json({ db: ok ? "up" : "down" });
  } catch (e) {
    res.status(500).json({ db: "down", error: String(e?.message || e) });
  }
});

// CRUD Todos
app.use("/api/todos", todos);

/**
 * Proxy IA échecs (Python) => /api/chess/best_move
 * Attend: { fen: "<FEN>" }
 * Renvoie: { move: "e2e4" } ou { move: null }
 */
app.post("/api/chess/best_move", async (req, res) => {
  try {
    const fen = req.body?.fen;
    if (!fen) return res.status(400).json({ error: "fen is required" });

    // Timeout raisonnable côté Node
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const r = await fetch("http://chesspy:8000/best_move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fen }),
      signal: controller.signal,
    }).catch((err) => {
      throw new Error(`chesspy unreachable: ${err.message}`);
    });

    clearTimeout(t);

    let data;
    try {
      data = await r.json();
    } catch {
      return res.status(502).json({ error: "invalid JSON from chesspy" });
    }

    return res.status(r.ok ? 200 : 502).json(data);
  } catch (e) {
    const msg = e?.name === "AbortError" ? "chesspy timeout" : String(e?.message || e);
    return res.status(502).json({ error: msg });
  }
});

// 404 API (optionnel)
app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

// Démarrage serveur
const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

// Arrêt propre
async function shutdown() {
  console.log("Shutting down…");
  server.close(() => console.log("HTTP server closed"));
  try {
    await pool.end();
    console.log("PG pool closed");
  } catch {}
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;

