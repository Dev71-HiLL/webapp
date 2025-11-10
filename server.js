import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { pingDB, pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.send("Hello Docker + Git 👋"));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

app.get("/api/dbhealth", async (_req, res) => {
  try {
    const ok = await pingDB();
    res.json({ db: ok ? "up" : "down" });
  } catch (e) {
    res.status(500).json({ db: "down", error: e.message });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));

process.on("SIGTERM", async () => {
  await pool.end().catch(() => {});
  process.exit(0);
});
