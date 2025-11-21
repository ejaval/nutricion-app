// ============================
// CHAT MODALS - Actualizado
// ============================
const token = localStorage.getItem("token");
const myId = localStorage.getItem("userId");
const rol = localStorage.getItem("userRole");
const nutricionistaId = localStorage.getItem("nutricionistaId");
let usuariosMap = {};

// Nuevo flag para evitar reconexión duplicada
let socket;
let socketInitialized = false;

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
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function cargarUsuarios() {
  // Solo cargar usuarios si el rol es nutricionista
  if (rol !== "nutricionista") {
    console.log("Solo el nutricionista puede cargar usuarios.");
    return;
  }

  try {
    const res = await fetch("/users", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.error("Error al cargar usuarios:", res.status, res.statusText);
      return;
    }

    const usuarios = await res.json();

    if (!Array.isArray(usuarios)) {
      console.error("La respuesta de /users no es un array:", usuarios);
      return;
    }

    usuariosMap = {};
    usuarios.forEach(u => usuariosMap[u.id] = u.nombre);
  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

async function cargarMensajesIndividuales(destinatarioId) {
  const res = await fetch(`/chat/${destinatarioId}`, {
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
          ${msg.archivo ? `<br><a href="/uploads/${escapeHtml(msg.archivo)}" target="_blank">📎 Archivo</a>` : ""}
        </div>
        <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
      </div>`;
  });
  box.scrollTop = box.scrollHeight;
}

async function cargarMensajesGrupales() {
  const res = await fetch(`/chat/0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const mensajes = await res.json();
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
          ${msg.archivo ? `<br><a href="/uploads/${escapeHtml(msg.archivo)}" target="_blank">📎 Archivo</a>` : ""}
        </div>
        <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
      </div>`;
  });
  box.scrollTop = box.scrollHeight;
}

// ✅ SOCKET.IO ACTUALIZADO
function configurarSocket() {
  if (socketInitialized) {
    console.log("Socket ya inicializado, evitando reconexión duplicada.");
    return;
  }

  console.log("Intentando conectar socket...");

  socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect", () => {
    console.log("✅ Socket conectado");
    socketInitialized = true;
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket desconectado");
    socketInitialized = false;
  });

  socket.off("nuevoMensaje");
  socket.on("nuevoMensaje", (msg) => {
    const { fromId, toId, mensaje, archivo, fecha, fromNombre } = msg;
    const esMio = fromId == myId;
    const autor = esMio ? "Tú" : (fromNombre || usuariosMap[fromId] || `Usuario ${fromId}`);
    const claseMensaje = esMio ? "mensaje-mio" : "mensaje-otro";
    const fechaHora = fecha ? formatearFechaHora(fecha) : "";

    const mensajeHTML = `
      <div class="${claseMensaje}">
        <div class="mensaje-texto">
          <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(mensaje)}
          ${archivo ? `<br><a href="/uploads/${escapeHtml(archivo)}" target="_blank">📎 Archivo</a>` : ""}
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

async function enviarMensaje(form, input, toId = 0) {
  const formData = new FormData(form);
  const mensaje = formData.get("mensaje") || "";
  const archivo = formData.get("archivo");

  if (!mensaje.trim() && !archivo) {
    alert("El mensaje o archivo es requerido.");
    return;
  }

  // ✅ Mostrar mensaje temporal en pantalla antes de enviar
  const autor = "Tú";
  const claseMensaje = "mensaje-mio";
  const fechaActual = new Date();
  const fechaHora = formatearFechaHora(fechaActual);

  const mensajeHTML = `
    <div class="${claseMensaje}">
      <div class="mensaje-texto">
        <strong>${escapeHtml(autor)}:</strong> ${escapeHtml(mensaje)}
        ${archivo ? `<br><a href="#" target="_blank">📎 Archivo adjunto</a>` : ""}
      </div>
      <div class="mensaje-fecha">${escapeHtml(fechaHora)}</div>
    </div>`;

  // Agregar mensaje al chat inmediatamente
  if (toId == 0) {
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
  formData.append("toId", toId);
  const res = await fetch("/chat/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (res.ok) {
    form.reset();
    ajustarAlturaTextarea(input);
  } else {
    alert("Error al enviar mensaje.");
    // Opcional: eliminar el mensaje temporal si falló
  }
}

function inicializarChat() {
  const inputMensaje = document.getElementById("mensaje");
  const inputMensajeGrupal = document.getElementById("mensajeGrupal");

  const modal = document.getElementById("chatModal");
  const closeBtn = modal.querySelector(".close");

  const chatForm = document.getElementById("chatForm");
  chatForm.addEventListener("submit", e => {
    e.preventDefault();
    const toId = document.getElementById("toId").value;
    enviarMensaje(chatForm, inputMensaje, parseInt(toId));
  });

  const chatGrupalForm = document.getElementById("chatGrupalForm");
  chatGrupalForm.addEventListener("submit", e => {
    e.preventDefault();
    enviarMensaje(chatGrupalForm, inputMensajeGrupal, 0);
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("openChatBtn")) {
      let toId = null;
      if (rol === "paciente") toId = nutricionistaId;
      else if (rol === "nutricionista") toId = e.target.getAttribute("data-id");

      if (!toId) return console.error("No se pudo determinar el destinatario");

      document.getElementById("toId").value = toId;
      cargarMensajesIndividuales(toId);
      modal.style.display = "block";
    }
  });

  closeBtn.onclick = () => (modal.style.display = "none");

  const grupalModal = document.getElementById("chatGrupalModal");
  const openGrupalBtn = document.getElementById("abrirChatGrupalBtn");
  const closeGrupalBtn = grupalModal.querySelector(".close-grupal");

  openGrupalBtn.onclick = (e) => {
    e.preventDefault();
    cargarMensajesGrupales();
    grupalModal.style.display = "block";
  };
  closeGrupalBtn.onclick = () => (grupalModal.style.display = "none");

  if(closeBtn){
    closeBtn.addEventListener("click", ()=>{
      modal.style.display="none";
    });
  }
}

// ✅ Desconectar socket al salir de la página
window.addEventListener("beforeunload", () => {
  if (socket) socket.disconnect();
});

document.addEventListener("DOMContentLoaded", async () => {
  await cargarUsuarios();
  configurarSocket();
  inicializarChat();
});
