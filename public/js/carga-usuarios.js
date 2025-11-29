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
  const userRole = localStorage.getItem("userRole");

  console.log("[DEBUG] Token:", token ? "✓" : "✗");
  console.log("[DEBUG] Rol:", userRole);

  if (!token || userRole !== "nutricionista") {
    console.log("[ERROR] Acceso denegado: token o rol inválido");
    return;
  }

  try {
    // 🔥 CAMBIO ÚNICO: usar /api/users
    const res = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("[DEBUG] Status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ERROR] Respuesta del servidor:", errorText);
      return;
    }

    const usuarios = await res.json();
    console.log("[DEBUG] Usuarios recibidos:", usuarios);

    const usuariosList = document.getElementById("usuariosList");
    if (!usuariosList) {
      console.error("[ERROR] Elemento #usuariosList no encontrado");
      return;
    }

    usuariosList.innerHTML = "";

    if (usuarios.length === 0) {
      usuariosList.innerHTML = `<tr><td colspan="3">No hay usuarios registrados.</td></tr>`;
      return;
    }

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
    console.error("[ERROR] Error en cargarUsuarios:", error);
  }
}

// Inicialización al cargar la página
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

  // Cargar lista si el contenedor existe
  if (document.getElementById("usuariosList")) {
    cargarUsuarios();
  }
});
