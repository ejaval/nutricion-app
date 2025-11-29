//configurado para probar en render
// ============================
// CHAT MODALS - Actualizado para Render
// ============================
const token = localStorage.getItem("token");
const myId = localStorage.getItem("userId");
const rol = localStorage.getItem("userRole");
const nutricionistaId = localStorage.getItem("nutricionistaId");
let usuariosMap = {};

let socket;
let socketInitialized = false;

//URL DEL BACKEND EN RENDER
const BACKEND_URL = "https://nutricion-app-1.onrender.com";

function ajustarAlturaTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function formatearFechaHora(timestamp) {
  const fecha = new Date(timestamp);
  const dia = fecha.getDate().toString().padStart(2, "0");
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const anio = fecha.getFullYear();
  const hora = fecha.getHours().toString().padStart(2, "0");
  const minuto = fecha.getMinutes().toString().padStart(2, "0");
  return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return ""; // Asegurar que sea string
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function cargarUsuarios() {
  try {
    const res = await fetch(`${BACKEND_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const usuarios = await res.json();
    usuariosMap = Object.fromEntries(usuarios.map(u => [u.id, u.nombre]));
  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

async function cargarMensajesIndividuales(destinatarioId) {
  const res = await fetch(`${BACKEND_URL}/chat/${destinatarioId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const mensajes = await res.json();
  const box = document.getElementById("chatBox");
  box.innerHTML = "";

  mensajes.forEach(msg => {
    const esMio = msg.fromId == myId;
    const autor = esMio ? "Tú" : (msg.fromNombre || usuariosMap[msg.fromId] || `Usuario ${msg.fromId}`);
    const claseMensaje = esMio ? "mensaje-mio" : "mensaje-otro";
    const fechaHora = msg.fecha ? formatearFechaHora(msg.fecha) : "";

    box.innerHTML += `
      <div class="${claseMensaje}">
        <div class="mensaje-texto">
          <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(msg.mensaje)}
          ${msg.archivo ? `<br><a href="${BACKEND_URL}/uploads/${escapeHtml(msg.archivo)}" target="_blank">📎 Archivo</a>` : ""}
        </div>
        <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
      </div>`;
  });
  box.scrollTop = box.scrollHeight;
}

async function cargarMensajesGrupales() {
  const res = await fetch(`${BACKEND_URL}/chat/0`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("Error al cargar mensajes grupales:", res.status, await res.text());
    alert("Error al cargar mensajes grupales.");
    return;
  }

  const mensajes = await res.json();

  if (!Array.isArray(mensajes)) {
    console.error("La respuesta no es un array:", mensajes);
    alert("Formato de mensajes inválido.");
    return;
  }

  const box = document.getElementById("chatGrupalBox");
  box.innerHTML = "";

  mensajes.forEach(msg => {
    const esMio = msg.fromId == myId;
    const autor = esMio ? "Tú" : (msg.fromNombre || usuariosMap[msg.fromId] || `Usuario ${msg.fromId}`);
    const claseMensaje = esMio ? "mensaje-mio" : "mensaje-otro";
    const fechaHora = msg.fecha ? formatearFechaHora(msg.fecha) : "";

    box.innerHTML += `
      <div class="${claseMensaje}">
        <div class="mensaje-texto">
          <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(msg.mensaje)}
          ${msg.archivo ? `<br><a href="${BACKEND_URL}/uploads/${escapeHtml(msg.archivo)}" target="_blank">📎 Archivo</a>` : ""}
        </div>
        <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
      </div>`;
  });
  box.scrollTop = box.scrollHeight;
}

function configurarSocket() {
  if (socketInitialized) {
    console.log("Socket ya inicializado, evitando reconexión duplicada.");
    return;
  }

  console.log("Intentando conectar socket a:", BACKEND_URL);

  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ["websocket", "polling"], // Asegura compatibilidad
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on("connect", () => {
    console.log("Socket conectado exitosamente");
    socketInitialized = true;
  });

  socket.on("disconnect", () => {
    console.log("Socket desconectado");
    socketInitialized = false;
  });

  socket.on("connect_error", (err) => {
    console.error("Error al conectar Socket.IO:", err.message);
    if (err.message === "timeout") {
      console.warn("Posible problema de CORS o servidor inaccesible.");
    }
  });

  socket.off("nuevoMensaje");
  socket.on("nuevoMensaje", (msg) => {
    const { fromId, toId, mensaje, archivo, fecha, fromNombre } = msg;
    const esMio = fromId == myId;

    // Evitar duplicado si ya lo renderizamos localmente
    if (esMio) return;

    // El receptor debe ver el mensaje como del otro
    const autor = fromNombre || usuariosMap[fromId] || `Usuario ${fromId}`;
    const claseMensaje = "mensaje-otro"; // Siempre es del otro al recibir
    const fechaHora = fecha ? formatearFechaHora(fecha) : "";

    const mensajeHTML = `
      <div class="${claseMensaje}">
        <div class="mensaje-texto">
          <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(mensaje)}
          ${archivo ? `<br><a href="${BACKEND_URL}/uploads/${escapeHtml(archivo)}" target="_blank">📎 Archivo</a>` : ""}
        </div>
        <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
      </div>`;

    if (toId == 0) {
      const box = document.getElementById("chatGrupalBox");
      if (box) {
        box.innerHTML += mensajeHTML;
        box.scrollTop = box.scrollHeight;
      }
    } else if (toId == myId || fromId == myId) {
      const box = document.getElementById("chatBox");
      if (box) {
        box.innerHTML += mensajeHTML;
        box.scrollTop = box.scrollHeight;
      }
    }
  });
}

// FUNCIÓN CORRECTAMENTE DEFINIDA FUERA DE CONFIGURARSOCKET
async function enviarMensaje(form, input, toId = 0) {
  const formData = new FormData(form);
  formData.append("toId", toId);

  const mensaje = formData.get("mensaje") || formData.get("mensajeGrupal") || "";
  const archivo = formData.get("archivo");

  if (!mensaje && !archivo) {
    alert("El mensaje o archivo es requerido.");
    return;
  }

  // Agregar mensaje localmente en la pantalla del emisor
  const autor = "Tú";
  const claseMensaje = "mensaje-mio";
  const ahora = new Date();
  const fechaHora = formatearFechaHora(ahora);

  const mensajeHTML = `
    <div class="${claseMensaje}">
      <div class="mensaje-texto">
        <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(mensaje)}
        ${archivo && archivo.name ? `<br><a href="${BACKEND_URL}/uploads/${escapeHtml(archivo.name)}" target="_blank">📎 Archivo</a>` : ""}
      </div>
      <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
    </div>`;

  if (toId === 0) {
    const box = document.getElementById("chatGrupalBox");
    if (box) {
      box.innerHTML += mensajeHTML;
      box.scrollTop = box.scrollHeight;
    }
  } else {
    const box = document.getElementById("chatBox");
    if (box) {
      box.innerHTML += mensajeHTML;
      box.scrollTop = box.scrollHeight;
    }
  }

  // Enviar al servidor
  const res = await fetch(`${BACKEND_URL}/chat/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (!res.ok) {
    alert("Error al enviar mensaje: " + res.statusText);
    // Opcional: eliminar el mensaje local si falló
  } else {
    form.reset();
    ajustarAlturaTextarea(input);
  }
}

function inicializarChat() {
  const inputMensaje = document.getElementById("mensaje");
  const inputMensajeGrupal = document.getElementById("mensajeGrupal");

  const modal = document.getElementById("chatModal");
  const grupalModal = document.getElementById("chatGrupalModal");

  // === Cerrar modales al hacer clic en la "X" ===
  const closeBtn = modal?.querySelector(".close");
  const closeGrupalBtn = grupalModal?.querySelector(".close-grupal");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (closeGrupalBtn) {
    closeGrupalBtn.addEventListener("click", () => {
      grupalModal.style.display = "none";
    });
  }

  // === Cerrar modal al hacer clic fuera del contenido ===
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
    if (e.target === grupalModal) grupalModal.style.display = "none";
  });

  // === Enviar mensajes ===
  const chatForm = document.getElementById("chatForm");
  if (chatForm) {
    chatForm.addEventListener("submit", e => {
      e.preventDefault();
      const toId = document.getElementById("toId")?.value;
      if (toId) enviarMensaje(chatForm, inputMensaje, parseInt(toId));
    });
  }

  const chatGrupalForm = document.getElementById("chatGrupalForm");
  if (chatGrupalForm) {
    chatGrupalForm.addEventListener("submit", e => {
      e.preventDefault();
      enviarMensaje(chatGrupalForm, inputMensajeGrupal, 0);
    });
  }

  // === Abrir chat individual ===
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("openChatBtn")) {
      let toId = null;
      if (rol === "paciente") toId = nutricionistaId;
      else if (rol === "nutricionista") toId = e.target.getAttribute("data-id");

      if (!toId) return console.error("No se pudo determinar el destinatario");

      document.getElementById("toId").value = toId;
      cargarMensajesIndividuales(toId);
      if (modal) {
        modal.style.display = "block";
        // ✅ Cerrar el grupal si está abierto
        if (grupalModal) grupalModal.style.display = "none";
      }
    }
  });

  // === Abrir chat grupal ===
  const openGrupalBtn = document.getElementById("abrirChatGrupalBtn");
  if (openGrupalBtn) {
    openGrupalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cargarMensajesGrupales();
      if (grupalModal) {
        grupalModal.style.display = "block";
        // ✅ Cerrar el individual si está abierto
        if (modal) modal.style.display = "none";
      }
    });
  }
}

window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});

document.addEventListener("DOMContentLoaded", async () => {
  await cargarUsuarios();
  configurarSocket();
  inicializarChat();
});
