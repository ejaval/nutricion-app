//Configurado para hacer pruebas en lineas en render gratis
// ============================
// 1. Importar librerías
// ============================
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const http = require("http");
const { Server } = require("socket.io");

// ============================
// 2. Configuraciones iniciales
// ============================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir carpeta PUBLIC (IMPORTANTE PARA RENDER)
app.use(express.static(path.join(process.cwd(), "public")));

// ============================
// 3. Configurar carpeta uploads
// ============================
const uploadsPath = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// ============================
// 4. Conexión a PostgreSQL
// ============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crear tablas
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      email TEXT UNIQUE,
      password TEXT,
      rol TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos_paciente (
      id SERIAL PRIMARY KEY,
      paciente_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS objetivos_paciente (
      id SERIAL PRIMARY KEY,
      paciente_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      descripcion TEXT NOT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

createTables();

// ============================
// 5. Rutas de Autenticación
// ============================
app.post("/register", async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (nombre, email, password, rol) VALUES ($1,$2,$3,$4)`,
      [nombre, email, hashed, rol]
    );

    res.json({ ok: true, msg: "Usuario registrado" });
  } catch (err) {
    console.error("Error en /register", err);
    res.status(500).json({ error: "Error en servidor" });
  }
});

// ============================
// 6. Subir video a un paciente
// ============================
app.post("/paciente/:id/videos", upload.single("video"), async (req, res) => {
  try {
    const pacienteId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió video" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    await pool.query(
      `INSERT INTO videos_paciente (paciente_id, url) VALUES ($1, $2)`,
      [pacienteId, fileUrl]
    );

    res.json({
      ok: true,
      url: fileUrl
    });

  } catch (err) {
    console.error("Error subiendo video:", err);
    res.status(500).json({ error: "Error al subir video" });
  }
});

// ============================
// 7. Obtener videos por paciente
// ============================
app.get("/paciente/:id/videos", async (req, res) => {
  try {
    const pacienteId = req.params.id;

    const result = await pool.query(
      `SELECT * FROM videos_paciente WHERE paciente_id=$1 ORDER BY creado_en DESC`,
      [pacienteId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error listando videos:", err);
    res.status(500).json({ error: "Error al obtener videos" });
  }
});

// ============================
// 8. Eliminar video
// ============================
app.delete("/paciente/:id/videos/:videoId", async (req, res) => {
  try {
    const videoId = req.params.videoId;

    const result = await pool.query(
      `SELECT url FROM videos_paciente WHERE id=$1`,
      [videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Video no encontrado" });
    }

    const filePath = path.join(process.cwd(), "public", result.rows[0].url);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query(`DELETE FROM videos_paciente WHERE id=$1`, [videoId]);

    res.json({ ok: true });

  } catch (err) {
    console.error("Error eliminando video:", err);
    res.status(500).json({ error: "Error al eliminar video" });
  }
});

// ============================
// 9. WebSockets (chat)
// ============================
io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("message", (msg) => {
    io.emit("message", msg);
  });
});

// ============================
// 10. Iniciar servidor
// ============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});
