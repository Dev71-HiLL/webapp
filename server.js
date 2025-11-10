// server.js (ESM, Node 20+)
// DÉPENDANCES
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// CONFIG .env
dotenv.config();

// RÉSOUDRE __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB & ROUTES
import { pool, pingDB } from "./db.js";
import todos from "./routes/todos.js";

// APP
const app = express();

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Statiques (UI, chess front…)
app.use(express.static(path.join(__dirname, "public")));

// --- ROUTES DE BASE ---
app.get("/", (_req, res) => {
  // Si tu as un public/index.html, il sera servi automatiquement par express.static.
  // Ici on laisse un fallback simple :
  res.send("Hello! Good BYE 👋");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/dbhealth", async (_req, res) => {
  try {
    const ok = await pingDB();
    res.json({ db: ok ? "up" : "down" });
  } catch (e) {
    res.status(500).json({ db: "down", error: e?.message || String(e) });
  }
});

// --- CRUD TODOS ---
app.use("/api/todos", todos);

// --- PROXY CHESS (Python FastAPI) ---
// Appelle le service Docker `chesspy` exposé sur le réseau compose
app.post("/api/chess/best_move", async (req, res) => {
  try {
    const fen = req.body?.fen;
    if (!fen) return res.status(400).json({ error: "fen is required" });

    const r = await fetch("http://chesspy:8000/best_move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fen }),
    });

    // r.ok peut être false (4xx/5xx) mais on renvoie quand même le corps pour debug
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: "chesspy_bad_gateway", data });

    res.json(data); // { move: "e2e4" } attendu
  } catch (e) {
    res.status(500).json({ error: "proxy_error", detail: e?.message || String(e) });
  }
});

// --- HANDLERS D’ERREURS GLOBAUX ---
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

// Arrêt propre (utile avec Docker)
process.on("SIGTERM", async () => {
  try {
    await pool.end();
  } catch {
    // ignore
  } finally {
    process.exit(0);
  }
});

// LANCEMENT
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

