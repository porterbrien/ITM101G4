const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("."));

app.get("/video", (req, res) => {
  const videoPath = path.join(__dirname, "movies", "sample.mp4");
  const videoSize = fs.statSync(videoPath).size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": videoSize,
      "Content-Type": "video/mp4"
    });
    fs.createReadStream(videoPath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
  const chunkSize = end - start + 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4"
  });

  fs.createReadStream(videoPath, { start, end }).pipe(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Movie Cloud running at http://localhost:${PORT}`);
});