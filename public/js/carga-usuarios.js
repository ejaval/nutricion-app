/************* MENU LATERAL *************/
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


/************* VARIABLES PARA PAGINACIÓN *************/
let usuariosGlobal = [];
let usuariosPorPagina = 10;
let paginaActual = 1;


/************* CARGAR USUARIOS CON PAGINACIÓN *************/
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

    let usuarios = await res.json();

    if (!Array.isArray(usuarios)) {
      console.error("La respuesta de /users no es un array:", usuarios);
      return;
    }

    // ============================================================
    // VARIABLES DEL PAGINADOR + BUSCADOR
    // ============================================================
    let paginaActual = 1;
    const porPagina = 10;

    const usuariosList = document.getElementById("usuariosList");
    const searchInput = document.getElementById("searchInput");

    // Crear contenedor para la paginación si no existe
    if (!document.getElementById("paginacion")) {
      const pagDiv = document.createElement("div");
      pagDiv.id = "paginacion";
      usuariosList.parentElement.appendChild(pagDiv);
    }

    const paginacionDiv = document.getElementById("paginacion");

    // ============================================================
    // FUNCIÓN PARA FILTRAR USUARIOS POR BUSCADOR
    // ============================================================
    function filtrarUsuarios() {
      const texto = searchInput.value.toLowerCase();
      return usuarios.filter(u =>
        u.nombre.toLowerCase().includes(texto) ||
        u.role.toLowerCase().includes(texto)
      );
    }

    // ============================================================
    // RENDERIZAR TABLA
    // ============================================================
    function renderTabla() {
      const listaFiltrada = filtrarUsuarios();

      const totalPaginas = Math.ceil(listaFiltrada.length / porPagina);
      if (paginaActual > totalPaginas) paginaActual = totalPaginas || 1;

      usuariosList.innerHTML = "";

      const inicio = (paginaActual - 1) * porPagina;
      const paginaDatos = listaFiltrada.slice(inicio, inicio + porPagina);

      paginaDatos.forEach(u => {
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

      renderPaginacion(totalPaginas);
      activarBotones();
    }

    // ============================================================
    // PAGINACIÓN NUMÉRICA
    // ============================================================
    function renderPaginacion(totalPaginas) {
      paginacionDiv.innerHTML = "";

      for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement("button");
        btn.classList.add("page-btn");
        btn.textContent = i;

        if (i === paginaActual) btn.classList.add("active");

        btn.addEventListener("click", () => {
          paginaActual = i;
          renderTabla();
        });

        paginacionDiv.appendChild(btn);
      }
    }

    // ============================================================
    // ACTIVAR EVENTOS DE BOTONES (EDITAR / ELIMINAR)
    // ============================================================
    function activarBotones() {
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

      document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

          const res = await fetch(`/users/${btn.dataset.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            usuarios = usuarios.filter(u => u.id != btn.dataset.id);
            renderTabla();
          }
        });
      });
    }

    // ============================================================
    // EVENTO DEL BUSCADOR
    // ============================================================
    searchInput.addEventListener("input", () => {
      paginaActual = 1;
      renderTabla();
    });

    // ============================================================
    // INICIAR
    // ============================================================
    renderTabla();

  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

/************* CARGAR VIDEOS Y OBJETIVOS *************/
async function cargarContenidoPaciente(pacienteId) {
  try {
    const token = localStorage.getItem("token");

    /** VIDEOS **/
    const resVideos = await fetch(`/paciente/${pacienteId}/videos`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const videos = await resVideos.json();
    const listaVideos = document.getElementById("listaVideosEditar");
    listaVideos.innerHTML = "";

    videos.forEach((url, index) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <video width="250" controls>
          <source src="${url}" type="video/mp4">
        </video>
        <button class="btnEliminarVideo" data-id="${index}">Eliminar</button>
      `;
      listaVideos.appendChild(div);
    });

    /** OBJETIVOS **/
    const resObj = await fetch(`/paciente/${pacienteId}/objetivos`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const objetivos = await resObj.json();
    const listaObj = document.getElementById("listaObjetivosEditar");
    listaObj.innerHTML = "";

    objetivos.forEach(desc => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${desc}
        <button class="btnEliminarObjetivo" data-descripcion="${desc}">Eliminar</button>
      `;
      listaObj.appendChild(li);
    });

    agregarEventosEliminar();

  } catch (err) {
    console.error("Error cargando contenido:", err);
  }
}


/************* ELIMINAR VIDEOS & OBJETIVOS *************/
function agregarEventosEliminar() {
  const token = localStorage.getItem("token");
  const pacienteId = document.getElementById("pacienteIdEditar").value;

  document.querySelectorAll(".btnEliminarVideo").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este video?")) return;

      await fetch(`/paciente/${pacienteId}/videos/${btn.dataset.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      cargarContenidoPaciente(pacienteId);
    });
  });

  document.querySelectorAll(".btnEliminarObjetivo").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este objetivo?")) return;

      await fetch(`/paciente/${pacienteId}/objetivos`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ descripcion: btn.dataset.descripcion })
      });

      cargarContenidoPaciente(pacienteId);
    });
  });
}


/************* SUBIR VIDEO *************/
document.getElementById("formSubirVideo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const pacienteId = document.getElementById("pacienteIdEditar").value;

  const formData = new FormData();
  formData.append("video", document.getElementById("nuevoVideo").files[0]);

  await fetch(`/paciente/${pacienteId}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  document.getElementById("nuevoVideo").value = "";
  cargarContenidoPaciente(pacienteId);
});


/************* AGREGAR OBJETIVO *************/
document.getElementById("formNuevoObjetivo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const pacienteId = document.getElementById("pacienteIdEditar").value;
  const descripcion = document.getElementById("nuevoObjetivo").value;

  await fetch(`/paciente/${pacienteId}/objetivos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ descripcion })
  });

  document.getElementById("nuevoObjetivo").value = "";
  cargarContenidoPaciente(pacienteId);
});


/************* CERRAR MODAL *************/
document.getElementById("cerrarEditarModal").addEventListener("click", () => {
  document.getElementById("editarContenidoModal").style.display = "none";
});

window.addEventListener("click", function (e) {
  const modal = document.getElementById("editarContenidoModal");
  if (e.target === modal) modal.style.display = "none";
});


/************* LOGOUT *************/
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (confirm("¿Deseas cerrar sesión?")) {
      localStorage.clear();
      window.location.href = "login.html";
    }
  });
});


/************* CARGA INICIAL *************/
window.addEventListener("DOMContentLoaded", cargarUsuarios);
