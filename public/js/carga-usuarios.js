// carga-usuarios.js

const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const mainContent = document.getElementById("mainContent");

if (menuToggle && sidebar && mainContent) {
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
}

// Función de escape HTML
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Cargar usuarios (solo para nutricionista)
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
    if (!usuariosList) return;

    usuariosList.innerHTML = "";

    usuarios.forEach(u => {
      const botonEditar = u.role === "paciente" 
        ? `<button class="btn-editar" data-id="${u.id}">Editar</button>`
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(u.nombre)}</b></td>
        <td>${escapeHtml(u.role)}</td>
        <td>${botonEditar}</td>
      `;
      usuariosList.appendChild(tr);
    });

  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

// Logout
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("¿Deseas cerrar sesión?")) {
        localStorage.clear();
        window.location.href = "login.html";
      }
    });
  }
});
