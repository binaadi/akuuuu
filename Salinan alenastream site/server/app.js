// server/app.js
// server/app.js
import dotenv from "dotenv";
dotenv.config(); // 🚀 ini HARUS paling atas, sebelum import lain

import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import expressLayouts from "express-ejs-layouts";
import { fileURLToPath } from "url";

import { requireAuth } from "./middleware/requireAuth.js";
import authRoutes from "./routes/auth.js";
import videosRoutes from "./routes/videos.js";
import statsRoutes from "./routes/stats.js";
import adminRoutes from "./routes/admin.js";
import secureStream from "./routes/secureStream.js";
import { initDB } from "./models/initdb.js";

import db from "./db.js";




// Import cron supaya otomatis jalan tiap hari
import "./cron.js";


// === Setup dasar ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// === Middleware keamanan & parser ===
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: isProd
    ? ["https://alenastream.site", "https://www.alenastream.site"]
    : ["http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// === View engine (EJS + layout) ===
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(expressLayouts);
app.set("layout", "layout"); // pakai views/layout.ejs

// === File statis (CSS, JS, Images, dll) ===
app.use(express.static(path.join(__dirname, "../public")));

// === Redirect *.html privat → ke versi EJS ===
const protectedHtml = [
  "/dashboard.html",
  "/upload.html",
  "/videos.html",
  "/remote.html",
  "/remot.html",
];
app.get(protectedHtml, (req, res) =>
  res.redirect(req.path.replace(".html", "").replace("/remot", "/remote"))
);

// === Halaman publik ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/register.html"));
});

// === Embed Player (publik) ===
app.get("/e/:token", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/embed.html"))
);
app.get("/v/:token", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/stiming.html"))
);
app.get("/t/:token", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/testing.html"))
);

// === Halaman Privat (gunakan requireAuth) ===
app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", {
    layout: "layout",
    title: "Dashboard",
    activePage: "dashboard",
    user: req.user,
  });
});

app.get("/upload", requireAuth, (req, res) => {
  res.render("upload", {
    layout: "layout",
    title: "Upload Video",
    activePage: "upload",
    user: req.user,
  });
});

app.get("/remot", requireAuth, (req, res) => {
  res.render("remot", {
    layout: "layout",
    title: "Remote Upload",
    activePage: "remot",
    user: req.user,
  });
});

app.get("/videos", requireAuth, (req, res) => {
  db.all(
    `SELECT id, title, source, video_id, embed_token, created_at 
     FROM videos WHERE user_id = ? 
     ORDER BY id DESC LIMIT 200`,
    [req.user.id],
    (err, rows = []) => {
      if (err) return res.status(500).send("DB error");
      res.render("videos", {
        layout: "layout",
        title: "My Videos",
        activePage: "videos",
        user: req.user,
        videos: rows,
      });
    }
  );
});

// === Withdraw (GET) ===
app.get("/withdraw", requireAuth, (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.redirect("/");

  db.serialize(() => {
    db.get("SELECT balance, withdrawn FROM earnings WHERE user_id = ?", [uid], (err1, earningsRow = {}) => {
      if (err1) return res.status(500).send("DB error");

      db.all(
        "SELECT * FROM withdraws WHERE user_id = ? ORDER BY id DESC",
        [uid],
        (err2, withdrawRows = []) => {
          if (err2) return res.status(500).send("DB error");
          res.render("withdraw", {
            layout: "layout",
            title: "Withdraw",
            activePage: "withdraw",
            user: req.user,
            withdraws: withdrawRows,
            earnings: {
              balance: earningsRow.balance ?? 0,
              withdrawn: earningsRow.withdrawn ?? 0,
            },
          });
        }
      );
    });
  });
});

// === Withdraw (POST) ===
app.post("/withdraw", requireAuth, (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.redirect("/");

  const { amount, method } = req.body;
  const amountNum = parseFloat(amount);

  if (isNaN(amountNum) || amountNum < 10)
    return res.status(400).send("Minimal withdraw $10");
  if (!["usdt", "ltc"].includes(method))
    return res.status(400).send("Metode tidak valid (hanya USDT/LTC)");

  db.get("SELECT balance FROM earnings WHERE user_id = ?", [uid], (err, row) => {
    if (err) return res.status(500).send("DB error");

    const balance = row?.balance || 0;
    if (balance < amountNum)
      return res.status(400).send("Saldo tidak mencukupi");

    db.run(
      "INSERT INTO withdraws (user_id, amount, method, status) VALUES (?, ?, ?, ?)",
      [uid, amountNum, method, "pending"],
      function (err2) {
        if (err2) return res.status(500).send("DB error");

        db.run(
          `UPDATE earnings 
             SET balance = balance - ?, 
                 withdrawn = withdrawn + ?,
                 updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [amountNum, amountNum, uid],
          (err3) => {
            if (err3) return res.status(500).send("DB error");
            res.redirect("/withdraw");
          }
        );
      }
    );
  });
});




// === Route lain ===
app.use("/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api", secureStream);

// === Inisialisasi database ===
initDB();

// === Error & 404 Handler ===
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err);
  res.status(500).send("Internal Server Error");
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Mode: ${isProd ? "Production" : "Development"}`);
});
