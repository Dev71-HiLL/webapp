import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello Docker + Git 👋"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
app.get("/api/health", (_req, res) => res.json({status:"ok", uptime:process.uptime()}));

