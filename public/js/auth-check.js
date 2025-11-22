document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch("/verify-token", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!res.ok) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    // Token válido → inicializar menú desplegable
    inicializarMenuDesplegable();

  } catch (err) {
    console.error("Error verificando token:", err);
    localStorage.removeItem("token");
    window.location.href = "login.html";
  }
});

// Menú desplegable (sidebar oculto por defecto)
function inicializarMenuDesplegable() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");

  if (!menuToggle || !sidebar) return;

  // Función para cerrar el menú
  function cerrarMenu() {
    sidebar.classList.remove("open");
  }

  // Alternar visibilidad del menú
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  // Cerrar menú al hacer clic fuera (solo si está abierto)
  document.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        cerrarMenu();
      }
    }
  });

  // Opcional: cerrar con la tecla "Esc"
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      cerrarMenu();
    }
  });
}
