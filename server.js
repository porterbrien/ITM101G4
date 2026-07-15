const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const crypto = require("crypto");
const multer = require("multer");
const pool = require("./db"); // MySQL (RDS) connection pool — see db.js
const { uploadToS3, deleteFromS3, getSignedGetUrl } = require("./s3");

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB per file; tune to taste
});

/* ─── Middleware ──────────────────────────────────────────────────── */
app.use(cors({
  origin: true,      // reflect request origin back
  credentials: true  // allow the session cookie to be sent/received
}));
app.use(express.json());
app.use(express.static("."));

app.use(session({
  name: "moviecloud.sid",
  // Set SESSION_SECRET in your environment for production; this random
  // fallback means sessions reset every time the server restarts.
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    // secure: true,   // uncomment once you're serving over HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect("/home.html");
  } else {
    res.redirect("/signin.html");
  }
});

/* ─── Auth helper ─────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You must be signed in to do that." });
  }
  next();
}

/* ─── Auth routes ─────────────────────────────────────────────────── */
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();

    await pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [id, normalizedEmail, passwordHash]
    );

    req.session.userId = id;
    res.json({ id, email: normalizedEmail });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const [rows] = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );
    const user = rows[0];

    // Same error for "no such user" and "wrong password" so we don't leak
    // which emails are registered.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("moviecloud.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });

  try {
    const [rows] = await pool.query(
      "SELECT id, email FROM users WHERE id = ? LIMIT 1",
      [req.session.userId]
    );
    const user = rows[0];
    res.json({ user: user ? { id: user.id, email: user.email } : null });
  } catch (err) {
    console.error("Session lookup error:", err);
    res.json({ user: null });
  }
});

/* ─── Movies (RDS for metadata, S3 for the actual files) ────────────── */

app.get("/api/movies", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, tag, age_rating, poster_key, video_key, created_at
       FROM movies WHERE user_id = ? ORDER BY created_at DESC`,
      [req.session.userId]
    );

    const movies = await Promise.all(rows.map(async (m) => ({
      id: m.id,
      title: m.title,
      tag: m.tag || "",
      age: m.age_rating || "",
      posterUrl: await getSignedGetUrl(m.poster_key),
      videoUrl: await getSignedGetUrl(m.video_key),
      createdAt: m.created_at
    })));

    res.json({ movies });
  } catch (err) {
    console.error("List movies error:", err);
    res.status(500).json({ error: "Could not load your library." });
  }
});

app.post(
  "/api/movies",
  requireAuth,
  upload.fields([{ name: "poster", maxCount: 1 }, { name: "video", maxCount: 1 }]),
  async (req, res) => {
    const title = (req.body.title || "").trim();
    const tag = (req.body.tag || "").trim();
    const age = (req.body.age || "").trim();
    const posterFile = req.files?.poster?.[0];
    const videoFile = req.files?.video?.[0];

    if (!title || !posterFile || !videoFile) {
      return res.status(400).json({ error: "Title, poster image, and video file are all required." });
    }

    const id = crypto.randomUUID();
    const posterKey = `posters/${req.session.userId}/${id}-${posterFile.originalname}`;
    const videoKey = `videos/${req.session.userId}/${id}-${videoFile.originalname}`;

    try {
      await uploadToS3(posterKey, posterFile.buffer, posterFile.mimetype);
      await uploadToS3(videoKey, videoFile.buffer, videoFile.mimetype);

      await pool.query(
        `INSERT INTO movies (id, user_id, title, tag, age_rating, poster_key, video_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, req.session.userId, title, tag, age, posterKey, videoKey]
      );

      res.json({
        id,
        title,
        tag,
        age,
        posterUrl: await getSignedGetUrl(posterKey),
        videoUrl: await getSignedGetUrl(videoKey)
      });
    } catch (err) {
      console.error("Upload movie error:", err);
      res.status(500).json({ error: "Failed to upload movie. Please try again." });
    }
  }
);

app.delete("/api/movies/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT poster_key, video_key FROM movies WHERE id = ? AND user_id = ? LIMIT 1",
      [req.params.id, req.session.userId]
    );
    const movie = rows[0];
    if (!movie) {
      return res.status(404).json({ error: "Movie not found." });
    }

    await pool.query("DELETE FROM movies WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
    await Promise.all([deleteFromS3(movie.poster_key), deleteFromS3(movie.video_key)]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete movie error:", err);
    res.status(500).json({ error: "Could not delete movie." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Movie Cloud running at http://localhost:${PORT}`);
});