document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    // No hay token, redirige al login
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch("/verify-token", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!res.ok) {
      // Token inválido o expirado
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    // Token válido, continuar carga normal de la página
  } catch (err) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  }
});