// =========================
// CONFIGURACIÓN DE API
// =========================
const API = "https://nutricion-app-1.onrender.com";

// =========================
// SESIÓN Y TOKEN
// =========================
function obtenerToken() {
    return localStorage.getItem("token");
}

function guardarToken(token) {
    localStorage.setItem("token", token);
}

function cerrarSesion() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// =========================
// VERIFICAR SESIÓN
// =========================
async function verificarSesion() {
    const token = obtenerToken();
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(`${API}/verify-token`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            cerrarSesion();
        }
    } catch (error) {
        console.error("Error verificando sesión:", error);
        cerrarSesion();
    }
}

// =========================
// LOGIN
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const emailLogin = document.getElementById("emailLogin").value;
            const passwordLogin = document.getElementById("passwordLogin").value;

            try {
                const response = await fetch(`${API}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: emailLogin, password: passwordLogin })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert("Credenciales incorrectas");
                    return;
                }

                guardarToken(data.token);
                window.location.href = "index.html";
            } catch (error) {
                console.error("Error en login:", error);
            }
        });
    }
});

// =========================
// CARGAR USUARIOS
// =========================
async function cargarUsuarios() {
    const token = obtenerToken();

    try {
        const response = await fetch(`${API}/users`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error HTTP: " + response.status);

        const users = await response.json();

        const userListContainer = document.getElementById("userList");
        userListContainer.innerHTML = "";

        users.forEach((user) => {
            const div = document.createElement("div");
            div.classList.add("usuario-item");
            div.textContent = user.email;
            div.onclick = () => abrirChat(user.id, user.email);
            userListContainer.appendChild(div);
        });

    } catch (error) {
        console.error("Error cargando usuarios:", error);
    }
}

// =========================
// CREAR USUARIO
// =========================
async function crearUsuario() {
    const nombre = document.getElementById("nombreRegistro").value;
    const email = document.getElementById("emailRegistro").value;
    const password = document.getElementById("passwordRegistro").value;

    try {
        const response = await fetch(`${API}/create-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, email, password })
        });

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error("Error creando usuario:", error);
    }
}

// =========================
// CHAT
// =========================
let currentChatUserId = null;

async function abrirChat(id, email) {
    currentChatUserId = id;
    document.getElementById("chatTitle").textContent = "Chat con: " + email;
    await cargarMensajes(id);
}

async function cargarMensajes(userId) {
    const token = obtenerToken();

    try {
        const response = await fetch(`${API}/chat/${userId}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });

        const mensajes = await response.json();

        const chatBox = document.getElementById("chatMessages");
        chatBox.innerHTML = "";

        mensajes.forEach((msg) => {
            const p = document.createElement("p");
            p.textContent = `${msg.fromEmail}: ${msg.message}`;
            chatBox.appendChild(p);
        });

    } catch (error) {
        console.error("Error cargando mensajes:", error);
    }
}

async function enviarMensaje() {
    const token = obtenerToken();
    const message = document.getElementById("messageInput").value;

    if (!currentChatUserId) {
        alert("Selecciona un usuario");
        return;
    }

    try {
        await fetch(`${API}/chat/send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                to: currentChatUserId,
                message: message
            })
        });

        document.getElementById("messageInput").value = "";
        cargarMensajes(currentChatUserId);

    } catch (error) {
        console.error("Error enviando mensaje:", error);
    }
}

// =========================
// AUTO EJECUCIÓN EN INDEX
// =========================
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("userList")) {
        verificarSesion();
        cargarUsuarios();
    }
});
