import { Router } from "express";
import { pool } from "../db.js";

const r = Router();

r.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    "select id, title, done, created_at from todos order by id asc"
  );
  res.json(rows);
});

r.post("/", async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title is required" });
  const { rows } = await pool.query(
    "insert into todos(title) values($1) returning id, title, done, created_at",
    [title]
  );
  res.status(201).json(rows[0]);
});

r.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, done } = req.body ?? {};
  const { rows } = await pool.query(
    "update todos set title=coalesce($1,title), done=coalesce($2,done) where id=$3 returning id,title,done,created_at",
    [title ?? null, typeof done === "boolean" ? done : null, id]
  );
  if (!rows.length) return res.sendStatus(404);
  res.json(rows[0]);
});

r.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("delete from todos where id=$1", [id]);
  if (!rowCount) return res.sendStatus(404);
  res.sendStatus(204);
});

export default r;
