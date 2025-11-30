const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const mainContent = document.getElementById("mainContent");

menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  mainContent.classList.toggle("shifted");
  menuToggle.classList.add("hidden");
});

document.addEventListener("click", (event) => {
  if (
    sidebar.classList.contains("active") &&
    !sidebar.contains(event.target) &&
    event.target !== menuToggle
  ) {
    sidebar.classList.remove("active");
    mainContent.classList.remove("shifted");
    menuToggle.classList.remove("hidden");
  }
});

async function cargarUsuarios() {
  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("userRole");

  if (rol !== "nutricionista") {
    console.log("Solo el nutricionista puede cargar usuarios.");
    return;
  }

  if (!token) return;

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

    const usuariosList = document.getElementById("usuariosList");
    usuariosList.innerHTML = "";

    usuarios.forEach(u => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${u.nombre}</b></td>
        <td>${u.role}</td>
        <td>
          <button class="edit-btn" data-id="${u.id}" data-nombre="${u.nombre}">Editar</button>
          <button class="chat-btn openChatBtn" data-id="${u.id}">Chat</button>
          <button class="delete-btn" data-id="${u.id}">Eliminar</button>
        </td>
      `;
      usuariosList.appendChild(tr);
    });

    // ====== EVENTO EDITAR (ABRIR MODAL + CARGAR CONTENIDO) ======
    document.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;

        document.getElementById("nombrePacienteModal").textContent = nombre;
        document.getElementById("pacienteIdEditar").value = id;

        document.getElementById("editarContenidoModal").style.display = "block";

        await cargarContenidoPaciente(id);
      });
    });

    // ====== EVENTO ELIMINAR USUARIO ======
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.id;
        if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

        const res = await fetch(`/users/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          btn.closest("tr").remove();
          await cargarUsuarios();
        } else {
          const error = await res.json();
          alert("Error: " + error.error);
        }
      });
    });

  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn.addEventListener("click", () => {
    if (confirm("¿Deseas cerrar sesión?")) {
      localStorage.clear();
      window.location.href = "login.html";
    }
  });
});

window.addEventListener("DOMContentLoaded", cargarUsuarios);



/* ==========================================================
      🔥🔥🔥  CÓDIGO AÑADIDO PARA EL MODAL EDITAR  🔥🔥🔥
   ========================================================== */

// ========== CARGAR VIDEOS Y OBJETIVOS DEL PACIENTE ==========
async function cargarContenidoPaciente(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`/contenido/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.error("Error cargando contenido:", res.status);
      return;
    }

    const data = await res.json();

    // ==== VIDEOS ====
    const listaVideos = document.getElementById("listaVideosEditar");
    listaVideos.innerHTML = "";

    data.videos.forEach(video => {
      const div = document.createElement("div");
      div.innerHTML = `
        <video src="${video.url}" width="200" controls></video>
        <button class="btnEliminarVideo" data-id="${video.id}">Eliminar</button>
        <hr>
      `;
      listaVideos.appendChild(div);
    });

    // ==== OBJETIVOS ====
    const listaObjetivos = document.getElementById("listaObjetivosEditar");
    listaObjetivos.innerHTML = "";

    data.objetivos.forEach(obj => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${obj.texto}
        <button class="btnEliminarObjetivo" data-id="${obj.id}">X</button>
      `;
      listaObjetivos.appendChild(li);
    });

    agregarEventosEliminar();

  } catch (error) {
    console.error("Error:", error);
  }
}

// ========== EVENTOS PARA ELIMINAR VIDEOS Y OBJETIVOS ==========
function agregarEventosEliminar() {
  const token = localStorage.getItem("token");

  // Eliminar Video
  document.querySelectorAll(".btnEliminarVideo").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este video?")) return;

      const id = btn.dataset.id;
      const pacienteId = document.getElementById("pacienteIdEditar").value;

      const res = await fetch(`/contenido/video/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        cargarContenidoPaciente(pacienteId);
      }
    });
  });

  // Eliminar Objetivo
  document.querySelectorAll(".btnEliminarObjetivo").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar objetivo?")) return;

      const id = btn.dataset.id;
      const pacienteId = document.getElementById("pacienteIdEditar").value;

      const res = await fetch(`/contenido/objetivo/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        cargarContenidoPaciente(pacienteId);
      }
    });
  });
}

// ========== SUBIR NUEVO VIDEO ==========
document.getElementById("formSubirVideo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pacienteId = document.getElementById("pacienteIdEditar").value;
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("video", document.getElementById("nuevoVideo").files[0]);

  const res = await fetch(`/contenido/${pacienteId}/video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (res.ok) {
    document.getElementById("nuevoVideo").value = "";
    cargarContenidoPaciente(pacienteId);
  }
});

// ========== AÑADIR NUEVO OBJETIVO ==========
document.getElementById("formNuevoObjetivo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pacienteId = document.getElementById("pacienteIdEditar").value;
  const token = localStorage.getItem("token");

  const nuevo = document.getElementById("nuevoObjetivo").value;

  const res = await fetch(`/contenido/${pacienteId}/objetivo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ texto: nuevo })
  });

  if (res.ok) {
    document.getElementById("nuevoObjetivo").value = "";
    cargarContenidoPaciente(pacienteId);
  }
});

// ========== CERRAR MODAL ==========
document.getElementById("cerrarEditarModal").addEventListener("click", () => {
  document.getElementById("editarContenidoModal").style.display = "none";
});

window.addEventListener("click", function (e) {
  const modal = document.getElementById("editarContenidoModal");
  if (e.target === modal) modal.style.display = "none";
});
