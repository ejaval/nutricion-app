// ======================
// Variables globales
// ======================
let userId = localStorage.getItem("userId");
let userRole = localStorage.getItem("userRole");

// ======================
// Función para validar token
// ======================
async function checkAuth() {
  if (!token) {
    window.location.href = "login.html";
    return false;
  }

  try {
    const res = await fetch("/verify-token", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.clear();
      window.location.href = "login.html";
      return false;
    }

    const data = await res.json();
    userId = data.id;
    userRole = data.role;
    return true;

  } catch (err) {
    console.error("Error verificando token:", err);
    localStorage.clear();
    window.location.href = "login.html";
    return false;
  }
}

// ======================
// LOGIN
// ======================
async function login() {
  const nombre = document.getElementById("nombre").value.trim();
  const password = document.getElementById("password").value;

  if (!nombre || !password) {
    alert("Nombre y contraseña son requeridos.");
    return;
  }

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, password })
  });

  const data = await res.json();

  if (data.token) {
    token = data.token;
    userId = data.id;
    userRole = data.role;

    localStorage.setItem("token", token);
    localStorage.setItem("userId", userId);
    localStorage.setItem("userRole", userRole);

    if (userRole === "nutricionista") window.location.href = "dashboard-nutricionista.html";
    else window.location.href = "dashboard-paciente.html";
  } else {
    alert(data.error || "Nombre o contraseña incorrectos");
  }
}

// ======================
// CHAT (GRUPAL E INDIVIDUAL)
// ======================
function renderMensajes(mensajes, chatBox) {
  chatBox.innerHTML = "";
  mensajes.forEach(m => {
    let html = `<p><b>${escapeHtml(m.fromNombre || "User " + m.fromId)}:</b> ${escapeHtml(m.mensaje || "")}`;
    if (m.archivo) {
      let tipo = m.archivo.split(".").pop().toLowerCase();
      if (["jpg", "jpeg", "png", "mp4"].includes(tipo)) {
        html += `<br><a href="/uploads/${escapeHtml(m.archivo)}" target="_blank"> Ver archivo</a>`;
      } else {
        html += `<br><a href="/uploads/${escapeHtml(m.archivo)}" target="_blank"> Descargar archivo</a>`;
      }
    }
    html += `</p>`;
    chatBox.innerHTML += html;
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function cargarMensajes(toId = 0) {
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  const res = await fetch(`/chat/${toId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const mensajes = await res.json();
  renderMensajes(mensajes, chatBox);
}

// ======================
// CREAR USUARIOS (SOLO NUTRICIONISTA)
// ======================
const formUsuario = document.getElementById("formUsuario");
const usuariosList = document.getElementById("usuariosList");

async function cargarUsuarios() {
  if (!usuariosList) return;

  const res = await fetch("/users", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const usuarios = await res.json();
  usuariosList.innerHTML = "";

  usuarios.forEach(u => {
    usuariosList.innerHTML += `
      <div style="background:#fff; padding:10px; margin:5px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.1)">
        <b>${escapeHtml(u.nombre)}</b> (${escapeHtml(u.role)})
      </div>`;
  });
}

if (formUsuario) {
  formUsuario.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    if (!nombre || !password || !role) {
      alert("Todos los campos son requeridos.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Token no disponible. Debes hacer login primero.");
      return;
    }

    const res = await fetch("/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ nombre, password, role })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Usuario creado correctamente!");
      formUsuario.reset();
      cargarUsuarios();
    } else {
      alert("Error: " + (data.error || "Desconocido"));
    }
  });
}

// ======================
// SUBIDA DE ARCHIVOS (FOTOS, VIDEOS, PDF/WORD)
// ======================
const formArchivo = document.getElementById("formArchivo");
if (formArchivo) {
  formArchivo.addEventListener("submit", async e => {
    e.preventDefault();
    let formData = new FormData(formArchivo);

    const res = await fetch("/chat/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      alert("Archivo subido correctamente!");
      formArchivo.reset();
      const toIdInput = document.getElementById("toId");
      const toId = toIdInput ? parseInt(toIdInput.value) : 0;
      cargarMensajes(toId);
    } else {
      alert("Error al subir archivo.");
    }
  });
}

// ======================
// Detectar el dispositivo de donde navega
// ======================
function esDispositivoMovil() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

if (esDispositivoMovil()) {
  console.log("Usuario en móvil");
} else {
  console.log("Usuario en escritorio");
}

// ======================
// Inicialización
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.href.includes("login.html")) {
    token = localStorage.getItem("token");
    userId = localStorage.getItem("userId");
    userRole = localStorage.getItem("userRole");

    if (!token) {
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    try {
      const res = await fetch("/verify-token", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Token inválido");

      // Cargar usuarios y mensajes
      cargarUsuarios();
      const toIdInput = document.getElementById("toId");
      const toId = toIdInput ? parseInt(toIdInput.value) : 0;
      cargarMensajes(toId);

    } catch (err) {
      console.error("Error en inicialización:", err);
      localStorage.clear();
      window.location.href = "login.html";
    }
  }
});
