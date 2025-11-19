document.addEventListener("DOMContentLoaded", async () => {
  // Verificar si las funciones y variables están disponibles
  if (typeof cargarUsuarios === 'function') {
    await cargarUsuarios();
  }

  if (typeof configurarSocket === 'function') {
    configurarSocket();
  }

  if (typeof inicializarChat === 'function') {
    inicializarChat();
  }

  const btnCrear = document.getElementById("btnCrearUsuario");
  const inputNombre = document.getElementById("nombreUsuario");

  if (btnCrear && inputNombre) {
    btnCrear.addEventListener("click", async (e) => {
      e.preventDefault();
      const nombreNuevo = inputNombre.value.trim().toLowerCase();

      // Verificar si usuariosMap está disponible
      if (typeof usuariosMap === 'object') {
        const existe = Object.values(usuariosMap)
          .some(nombre => nombre.toLowerCase() === nombreNuevo);

        if (existe) {
          alert("Ya existe un usuario con ese nombre. Elige otro.");
          return;
        }
      }

      // Aquí tu fetch para crear usuario
      // await fetch('/users/create', { ... });
    });
  } else {
    console.warn("Botón o input no encontrado en esta página.");
  }
});