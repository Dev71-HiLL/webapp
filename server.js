import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello Docker + Git 👋"));
app.listen(3000, () => console.log("Webapp dispo sur http://localhost:3000"));

