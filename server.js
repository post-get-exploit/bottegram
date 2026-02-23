import express from "express";
import handler from "./api/bot/index.js";

const app = express();
app.use(express.json());

app.all("/api/bot", handler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server jalan di port " + port);
});
