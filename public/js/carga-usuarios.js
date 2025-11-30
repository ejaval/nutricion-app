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

  // ✅ Verificar que el rol sea nutricionista antes de intentar cargar usuarios
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
          <button class="chat-btn openChatBtn" data-id="${u.id}">Chat</button>
          <button class="delete-btn" data-id="${u.id}">Eliminar</button>
        </td>
      `;
      usuariosList.appendChild(tr);
    });

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
