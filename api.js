import express from "express";

const app = express();

function auth(req) {
  if (req.query.logout === "true") return false;
  return true;
}

app.get("/", (req, res) => {
  if (!auth(req)) {
    return res.status(401).send("Logged out");
  }
  res.send("API jalan bro 🔥");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
