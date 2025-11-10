// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { pingDB, pool } from "./db.js";
import todos from "./routes/todos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// servir /public (ex: chess.js/wasm, index.html)
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => res.send("Hello Docker + Git 👋"));
app.get("/api/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.get("/api/dbhealth", async (_req, res) => {
  try {
    const ok = await pingDB();
    res.json({ db: ok ? "up" : "down" });
  } catch (e) {
    res.status(500).json({ db: "down", error: e.message });
  }
});

// CRUD Todos
app.use("/api/todos", todos);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));

// arrêt propre
process.on("SIGTERM", async () => {
  await pool.end().catch(() => {});
  process.exit(0);
});

