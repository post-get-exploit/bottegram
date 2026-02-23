import express from "express";
import { handleBot } from "./bot.js";
import { auth } from "./api.js";

const app = express();
app.use(express.json());

app.all("/api/bot", async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ ok: false, msg: "token required" });
  }

  if (!auth(req)) {
    return res.json({ ok: true, msg: "logout" });
  }

  if (req.method === "POST") {
    await handleBot(token, req.body);
    return res.json({ ok: true });
  }

  res.json({ ok: true, msg: "API connected" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
