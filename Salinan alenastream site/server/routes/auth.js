// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookieOpts } from "../middleware/requireAuth.js";
import db from "../db.js";




import rateLimit from "express-rate-limit";


const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 8 });
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const isProd = process.env.NODE_ENV === "production";


// === Inisialisasi tabel users (kalau belum ada) ===
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error("❌ Gagal membuat tabel users:", err.message);
  });

  // Tambahkan kolom role kalau belum ada
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("❌ Error alter users table:", err.message);
    }
  });
});



// === Helper ===
function strongPassword(pw = "") {
  return pw.length >= 6;
}






// === REGISTER ===
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: "Username, email, dan password wajib." });
    if (username.length < 3)
      return res.status(400).json({ error: "Username minimal 3 karakter." });
    if (!strongPassword(password))
      return res.status(400).json({ error: "Password minimal 6 karakter." });

    const hash = await bcrypt.hash(password, 12);
    const stmt = db.prepare(`INSERT INTO users(username, email, password_hash) VALUES(?, ?, ?)`);

    stmt.run(username, email, hash, function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE"))
          return res.status(409).json({ error: "Username atau email sudah dipakai." });
        console.error("❌ DB error:", err.message);
        return res.status(500).json({ error: "Gagal daftar user." });
      }
      return res.json({ success: true });
    });
  } catch (e) {
    console.error("❌ Register error:", e);
    return res.status(500).json({ error: "Server error." });
  }
});



// === LOGIN ===
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: "Username & password wajib." });

    db.get(
      `SELECT id, username, email, password_hash, role FROM users WHERE username = ?`,
      [username],
      async (err, row) => {
        if (err) return res.status(500).json({ error: "DB error." });
        if (!row)
          return res.status(401).json({ error: "Username atau password salah." });

        // Tolak login admin dari endpoint user biasa
        if (row.role === "admin")
          return res.status(403).json({ error: "Gunakan halaman login admin." });

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok)
          return res.status(401).json({ error: "Username atau password salah." });

        const payload = {
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        res.cookie("token", token, {
          ...cookieOpts(isProd),
          maxAge: 24 * 60 * 60 * 1000, // 1 hari
        });

        return res.json({ success: true });
      }
    );
  } catch (e) {
    console.error("❌ Login error:", e);
    return res.status(500).json({ error: "Server error." });
  }
});



// === ME ===
router.get("/me", (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json(null);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json(decoded);
  } catch {
    res.clearCookie("token", cookieOpts(isProd));
    return res.json(null);
  }
});

// === LOGOUT ===
router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOpts(isProd));
  res.json({ success: true });
});

export default router;
