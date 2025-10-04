// server/middleware/requireAuth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey"; // ganti di .env produksi
const isProd = process.env.NODE_ENV === "production";

/**
 * Middleware untuk proteksi route (privat dashboard & API)
 * - Deteksi public path otomatis
 * - Bedain API dan halaman biasa (API → JSON, halaman → redirect)
 */
export function requireAuth(req, res, next) {
  // Daftar halaman publik (tidak butuh login)
  const publicPaths = new Set([
    "/", "/index.html",
    "/register.html",
    "/login.html",
    "/api/auth/login",
    "/api/auth/register",
  ]);

  // Allow asset publik & embed
  if (
    publicPaths.has(req.path) ||
    req.path.startsWith("/css") ||
    req.path.startsWith("/js") ||
    req.path.startsWith("/image") ||
    req.path.startsWith("/embed") ||
    req.path.startsWith("/public") ||
    req.path.startsWith("/favicon")
  ) return next();

  // Ambil token dari cookie
  const token = req.cookies?.token;
  if (!token) {
    // Kalau API → balas JSON
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized. Please login." });
    }
    // Kalau halaman → redirect
    return res.redirect("/");
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET); // verifikasi JWT
    req.user = payload; // simpan payload ke request
    return next();
  } catch (e) {
    console.warn("⚠️ Invalid or expired token:", e.message);

    // Hapus cookie token
    res.clearCookie("token", cookieOpts(isProd));

    // API → JSON error
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }

    // Halaman → redirect ke login
    return res.redirect("/");
  }
}

/**
 * Konfigurasi cookie untuk keamanan maksimal
 */
export function cookieOpts(isProdEnv = false) {
  return {
    httpOnly: true,          // cookie tidak bisa dibaca JS → cegah XSS
    secure: Boolean(isProdEnv), // hanya kirim di HTTPS (aktif di produksi)
    sameSite: "lax",         // cukup aman, masih bisa kirim cookie dari link internal
    path: "/",               // berlaku di semua path
    // maxAge ditentukan di auth.js saat login
  };
}



