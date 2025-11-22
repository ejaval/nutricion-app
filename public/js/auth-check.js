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

    // ✅ Token válido → inicializar menú desplegable
    inicializarMenuDesplegable();

  } catch (err) {
    console.error("Error verificando token:", err);
    localStorage.removeItem("token");
    window.location.href = "login.html";
  }
});

// ✅ Menú desplegable (sidebar oculto por defecto)
function inicializarMenuDesplegable() {
  function esDispositivoMovil() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");

  if (!menuToggle || !sidebar) return;

  // Alternar visibilidad del menú
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // Evita que el clic se propague al documento
    sidebar.classList.toggle("open");
  });

  // En móvil: cerrar al hacer clic fuera del menú
  if (esDispositivoMovil()) {
    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }
}
