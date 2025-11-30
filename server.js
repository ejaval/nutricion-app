//Configurado para hacer pruebas en lineas en render gratis
// ============================
// 1. Librerías
// ============================
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const { Server } = require("socket.io");
const http = require("http");
const fs = require("fs");

// ============================
// 2. Crear app y servidor
// ============================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://nutricion-app-1.onrender.com",
    methods: ["GET", "POST"],
  },
});

// ============================
// 2.1 Crear carpeta uploads si no existe
// ============================
const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("Carpeta /uploads creada automáticamente");

  // Hacer que Render NO borre esta carpeta
  fs.writeFileSync(path.join(uploadsPath, ".gitkeep"), "");
  console.log("Archivo .gitkeep creado dentro de /uploads");
}

// Servir archivos estáticos
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static(uploadsPath));

// ============================
// 3. Base de datos
// ============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Crear tablas
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id SERIAL PRIMARY KEY,
      fromId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      "toId" INTEGER,
      mensaje TEXT,
      archivo TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  // Crear nutricionista por defecto
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE LOWER(nombre)=LOWER($1)`,
    ["katya cruz"]
  );

  if (rows.length === 0) {
    const hash = bcrypt.hashSync("123456", 8);
    await pool.query(
      `INSERT INTO users (nombre, password, role)
       VALUES ($1, $2, $3)`,
      ["katya cruz", hash, "nutricionista"]
    );
    console.log("Usuario inicial creado: katya cruz / 123456");
  }
})();

// ============================
// 4. JWT
// ============================
const SECRET = "secreto123";

function auth(req, res, next) {
  let token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Token requerido" });

  if (token.startsWith("Bearer ")) token = token.slice(7);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// ============================
// 5. Multer
// ============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok =
      /jpeg|jpg|png|pdf|doc|docx|mp4/.test(
        path.extname(file.originalname).toLowerCase()
      ) && /jpeg|jpg|png|pdf|mp4|/.test(file.mimetype);

    if (ok) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido"));
  },
});

// ============================
// 6. Rutas API
// ============================

// LOGIN
app.post("/login", async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password)
    return res.status(400).json({ error: "Nombre y contraseña requeridos" });

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE LOWER(nombre)=LOWER($1)`,
    [nombre]
  );
  const user = rows[0];

  if (!user) return res.status(400).json({ error: "Usuario no existe" });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
    expiresIn: "12h",
  });

  res.json({ token, id: user.id, role: user.role });
});

// CREAR USUARIO
app.post("/create-user", auth, async (req, res) => {
  if (req.user.role !== "nutricionista")
    return res.status(403).json({ error: "No autorizado" });

  const { nombre, password, role } = req.body;

  const existing = await pool.query(
    `SELECT id FROM users WHERE LOWER(nombre)=LOWER($1)`,
    [nombre]
  );

  if (existing.rows.length > 0)
    return res.status(400).json({ error: "Usuario ya existe" });

  const hash = bcrypt.hashSync(password, 8);

  const result = await pool.query(
    `INSERT INTO users (nombre, password, role)
     VALUES ($1,$2,$3) RETURNING id`,
    [nombre, hash, role]
  );

  res.json({ id: result.rows[0].id, nombre, role });
});

// LISTAR USUARIOS
app.get("/users", auth, async (req, res) => {
  if (req.user.role !== "nutricionista")
    return res.status(403).json({ error: "Acceso denegado" });

  const { rows } = await pool.query(
    `SELECT id, nombre, role FROM users ORDER BY id DESC`
  );

  res.json(rows);
});

// ENVIAR MENSAJE
app.post("/chat/send", auth, upload.single("archivo"), async (req, res) => {
  const { toId } = req.body;
  const mensaje = req.body.mensaje || "";

  const archivo = req.file ? req.file.filename : null;

  const result = await pool.query(
    `INSERT INTO mensajes (fromId, "toId", mensaje, archivo)
     VALUES ($1,$2,$3,$4) RETURNING id, fecha`,
    [req.user.id, toId || 0, mensaje, archivo]
  );

  const msg = {
    id: result.rows[0].id,
    fromId: req.user.id,
    toId: parseInt(toId) || 0,
    mensaje,
    archivo,
    fecha: result.rows[0].fecha,
  };

  if (msg.toId === 0) io.emit("nuevoMensaje", msg);
  else {
    io.to(`user_${msg.toId}`).emit("nuevoMensaje", msg);
    io.to(`user_${msg.fromId}`).emit("nuevoMensaje", msg);
  }

  res.json({ ok: true });
});

// OBTENER MENSAJES
app.get("/chat/:toId", auth, async (req, res) => {
  const toId = parseInt(req.params.toId);

  let rows;

  if (toId === 0) {
    ({ rows } = await pool.query(`
      SELECT m.*, u.nombre AS "fromNombre"
      FROM mensajes m
      JOIN users u ON m.fromId = u.id
      WHERE m."toId" = 0
      ORDER BY m.fecha
    `));
  } else {
    ({ rows } = await pool.query(
      `
      SELECT m.*, u.nombre AS "fromNombre"
      FROM mensajes m
      JOIN users u ON m.fromId = u.id
      WHERE (m.fromId=$1 AND m."toId"=$2)
         OR (m.fromId=$2 AND m."toId"=$1)
      ORDER BY m.fecha
    `,
      [req.user.id, toId]
    ));
  }

  res.json(rows);
});

// SUBIR VIDEO
app.post(
  "/paciente/:pacienteId/videos",
  auth,
  upload.single("video"),
  async (req, res) => {
    if (req.user.role !== "nutricionista")
      return res.status(403).json({ error: "No autorizado" });

    const pacienteId = parseInt(req.params.pacienteId);

    if (!req.file)
      return res.status(400).json({ error: "Debe subir un archivo" });

    await pool.query(
      `INSERT INTO videos_paciente (paciente_id, url)
       VALUES ($1,$2)`,
      [pacienteId, req.file.filename]
    );

    res.json({ ok: true, url: req.file.filename });
  }
);

// LISTAR VIDEOS
app.get("/paciente/:pacienteId/videos", auth, async (req, res) => {
  const pacienteId = parseInt(req.params.pacienteId);

  const { rows } = await pool.query(
    `SELECT url FROM videos_paciente WHERE paciente_id=$1 ORDER BY creado_en`,
    [pacienteId]
  );

  res.json(rows.map((v) => `/uploads/${v.url}`));
});

// ELIMINAR VIDEO
app.delete("/paciente/:pacienteId/videos/:videoId", auth, async (req, res) => {
  const pacienteId = parseInt(req.params.pacienteId);
  const videoId = parseInt(req.params.videoId);

  const { rows } = await pool.query(
    `SELECT url FROM videos_paciente WHERE id=$1 AND paciente_id=$2`,
    [videoId, pacienteId]
  );

  if (rows.length === 0)
    return res.status(404).json({ error: "Video no encontrado" });

  const filename = rows[0].url;

  // Eliminar archivo del servidor
  fs.unlink(path.join(uploadsPath, filename), () =>
    console.log("Archivo eliminado:", filename)
  );

  // Eliminar de la base
  await pool.query(`DELETE FROM videos_paciente WHERE id=$1`, [videoId]);

  res.json({ ok: true });
});

// OBJETIVOS - Obtener
app.get("/paciente/:pacienteId/objetivos", auth, async (req, res) => {
  const pacienteId = parseInt(req.params.pacienteId);

  const { rows } = await pool.query(
    `SELECT descripcion FROM objetivos_paciente WHERE paciente_id=$1 ORDER BY creado_en`,
    [pacienteId]
  );

  res.json(rows.map((o) => o.descripcion));
});

// OBJETIVOS - Agregar
app.post("/paciente/:pacienteId/objetivos", auth, async (req, res) => {
  if (req.user.role !== "nutricionista")
    return res.status(403).json({ error: "No autorizado" });

  const { descripcion } = req.body;
  const pacienteId = parseInt(req.params.pacienteId);

  await pool.query(
    `INSERT INTO objetivos_paciente (paciente_id, descripcion)
     VALUES ($1,$2)`,
    [pacienteId, descripcion]
  );

  res.json({ ok: true });
});

// OBJETIVOS - Eliminar
app.delete("/paciente/:pacienteId/objetivos", auth, async (req, res) => {
  if (req.user.role !== "nutricionista")
    return res.status(403).json({ error: "No autorizado" });

  const { descripcion } = req.body;
  const pacienteId = parseInt(req.params.pacienteId);

  const r = await pool.query(
    `DELETE FROM objetivos_paciente WHERE paciente_id=$1 AND descripcion=$2`,
    [pacienteId, descripcion]
  );

  if (r.rowCount === 0)
    return res.status(404).json({ error: "Objetivo no encontrado" });

  res.json({ ok: true });
});

// ============================
// 7. SOCKET.IO
// ============================
io.use((socket, next) => {
  let token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token requerido"));
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return next(new Error("Token inválido"));
    socket.user = user;
    socket.join(`user_${user.id}`);
    next();
  });
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.user.id);
});

// ============================
// 8. Iniciar Servidor
// ============================
const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
