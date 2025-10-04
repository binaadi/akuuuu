// server/db.js
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Buat file database di folder db/
const dbPath = path.join(__dirname, "../db/database.sqlite");
sqlite3.verbose();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Error connect DB:", err);
  else console.log("✅ Database connected:", dbPath);
});

export default db;
