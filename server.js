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

// ============================
// 2. Crear app y servidor
// ============================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ============================
// 3. Base de datos
// ============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crear tablas si no existen
(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id SERIAL PRIMARY KEY,
      fromId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      "toId" INTEGER,
      mensaje TEXT,
      archivo TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Usuario inicial
  const { rows } = await db.query(`SELECT * FROM users WHERE LOWER(nombre) = LOWER($1)`, ["katya cruz"]);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync("123456", 8);
    await db.query(
      `INSERT INTO users (nombre, password, role) VALUES ($1, $2, $3)`,
      ["katya cruz", hash, "nutricionista"]
    );
    console.log("✅ Usuario inicial creado: katya cruz / 123456");
  }
})();

// ============================
// 4. JWT y middleware auth
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
// 5. Multer para archivos
// ============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  }
});

// ============================
// 6. Rutas API
// ============================

// 🔄 LOGIN
app.post("/login", async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: "Nombre y contraseña son requeridos." });
  }

  try {
    const { rows } = await db.query(`SELECT * FROM users WHERE LOWER(nombre)=LOWER($1)`, [nombre]);
    const user = rows[0];

    if (!user) return res.status(400).json({ error: "Usuario no existe" });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "12h" });
    res.json({ token, id: user.id, role: user.role });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔄 CREAR USUARIO
app.post("/create-user", auth, async (req, res) => {
  if (req.user.role !== "nutricionista")
    return res.status(403).json({ error: "Solo el nutricionista puede crear usuarios" });

  const { nombre, password, role } = req.body;
  if (!nombre || !password || !role)
    return res.status(400).json({ error: "Todos los campos son requeridos" });

  try {
    const existing = await db.query(`SELECT id FROM users WHERE LOWER(nombre)=LOWER($1)`, [nombre]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Ya existe un usuario con ese nombre" });

    const hash = bcrypt.hashSync(password, 8);
    const result = await db.query(
      `INSERT INTO users (nombre, password, role) VALUES ($1, $2, $3) RETURNING id`,
      [nombre, hash, role]
    );

    res.json({ id: result.rows[0].id, nombre, role });
  } catch (err) {
    console.error("Error creando usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔄 LISTAR USUARIOS
app.get("/users", auth, async (req, res) => {
  if (req.user.role !== "nutricionista") return res.status(403).json({ error: "Acceso denegado" });
  try {
    const { rows } = await db.query(`SELECT id, nombre, role FROM users ORDER BY id DESC`);
    res.json(rows);
  } catch (err) {
    console.error("Error listando usuarios:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔄 ENVIAR MENSAJE
app.post("/chat/send", auth, upload.single("archivo"), async (req, res) => {
  const { toId } = req.body;
  const mensaje = req.body.mensaje || req.body.mensajeGrupal || "";
  const archivo = req.file ? req.file.filename : null;

  if (!mensaje && !archivo) {
    return res.status(400).json({ error: "Mensaje o archivo requerido." });
  }

  try {
    const result = await db.query(
      `INSERT INTO mensajes (fromId, "toId", mensaje, archivo)
       VALUES ($1, $2, $3, $4) RETURNING id, fecha`,
      [req.user.id, toId || 0, mensaje, archivo]
    );

    const { rows } = await db.query(`SELECT nombre FROM users WHERE id=$1`, [req.user.id]);
    const fromNombre = rows[0]?.nombre || "Desconocido";

    const msg = {
      id: result.rows[0].id,
      fromId: req.user.id,
      fromNombre,
      toId: parseInt(toId) || 0,
      mensaje,
      archivo,
      fecha: result.rows[0].fecha,
    };

    if (msg.toId === 0) {
      io.emit("nuevoMensaje", msg); // Chat grupal
    } else {
      // ✅ Enviar mensaje a ambos usuarios: receptor y emisor
      io.to(`user_${msg.toId}`).emit("nuevoMensaje", msg);
      io.to(`user_${msg.fromId}`).emit("nuevoMensaje", msg);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando mensaje:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔄 OBTENER MENSAJES
app.get("/chat/:toId", auth, async (req, res) => {
  const toId = parseInt(req.params.toId);
  if (isNaN(toId)) return res.status(400).json({ error: "ID inválido" });

  try {
    let rows;

    if (toId === 0) {
      ({ rows } = await db.query(`
        SELECT m.*, u.nombre AS "fromNombre"
        FROM mensajes m
        JOIN users u ON m."fromId" = u.id
        WHERE m."toId" = 0
        ORDER BY m.fecha
      `));
    } else {
      ({ rows } = await db.query(`
        SELECT m.*, u.nombre AS "fromNombre"
        FROM mensajes m
        JOIN users u ON m.fromId = u.id
        WHERE (m.fromId = $1 AND m."toId" = $2)
           OR (m.fromId = $2 AND m."toId" = $1)
        ORDER BY m.fecha
      `, [req.user.id, toId]));
    }

    res.json(rows);
  } catch (err) {
    console.error("Error obteniendo mensajes:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 🔄 VERIFICAR TOKEN
app.get("/verify-token", auth, (req, res) => {
  res.json({ ok: true, id: req.user.id, role: req.user.role });
});

// ============================
// 7. SOCKET.IO en tiempo real
// ============================
io.use((socket, next) => {
  let token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token requerido"));
  // No es necesario quitar "Bearer" aquí si lo envías sin él desde el cliente
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return next(new Error("Token inválido"));
    socket.user = user;
    socket.join(`user_${user.id}`);
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`🟢 Usuario conectado: ID=${socket.user.id}`);
  socket.on("disconnect", () => {
    console.log(`🔴 Usuario desconectado: ID=${socket.user.id}`);
  });
});

// ============================
// 8. Iniciar servidor
// ============================
server.listen(3000, () => console.log("🚀 Servidor corriendo en http://localhost:3000"));
