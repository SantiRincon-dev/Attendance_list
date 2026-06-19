import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyARUmyWKj2bhzqKuJqb_do6VUz0mvbF9_U",
  authDomain: "asistencia-qr-8f6ee.firebaseapp.com",
  databaseURL: "https://asistencia-qr-8f6ee-default-rtdb.firebaseio.com",
  projectId: "asistencia-qr-8f6ee",
  storageBucket: "asistencia-qr-8f6ee.firebasestorage.app",
  messagingSenderId: "129898951834",
  appId: "1:129898951834:web:2ac46920a01f653dfadb23"
};
 
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
 
let scanner;

const estudiantesPorGrupo = {
  grupo1: {
    "E000000000285118": { nombre: "ARENAS SALTOS, MARIA JOSE", correo: "mariaaresal@unisabana.edu.co", programa: "ENFERMERIA" },
  },
  grupo2: {
    "E000000000285118": { nombre: "ARENAS SALTOS, MARIA JOSE", correo: "mariaaresal@unisabana.edu.co", programa: "ENFERMERIA" },
  },
  grupo3: {
    "E000000000285118": { nombre: "ARENAS SALTOS, MARIA JOSE", correo: "mariaaresal@unisabana.edu.co", programa: "ENFERMERIA" },
  },
  grupo4: {
    "E000000000285118": { nombre: "ARENAS SALTOS, MARIA JOSE", correo: "mariaaresal@unisabana.edu.co", programa: "ENFERMERIA" },
  },
  grupo5: {
    "E000000000285118": { nombre: "ARENAS SALTOS, MARIA JOSE", correo: "mariaaresal@unisabana.edu.co", programa: "ENFERMERIA" },
  }
};
 
let grupoActivo = "grupo1";                 
let estudiantes = estudiantesPorGrupo[grupoActivo];
let asistenciaPorFecha = {};
let fechaActiva;

function fechaLocalHoy() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
 
// ─── LOGIN ─────────────────────────────────────────────────────────────────
window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
 
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Sesión iniciada");
 
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
 
    await cargarDatos();
 
    scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    scanner.render(onScanSuccess);
 
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    alert("❌ " + (error?.message || "Error desconocido"));
  }
};
 

window.addEventListener("DOMContentLoaded", () => {
  fechaActiva = fechaLocalHoy();           // ← fecha local correcta
  document.getElementById("fecha").value = fechaActiva;
 
  if (!asistenciaPorFecha[fechaActiva]) {
    asistenciaPorFecha[fechaActiva] = {};
  }
 
  document.getElementById("fecha").addEventListener("change", async (e) => {
    fechaActiva = e.target.value;
 
    if (!asistenciaPorFecha[fechaActiva]) {
      asistenciaPorFecha[fechaActiva] = {};
    }
 
    await cargarDatos();
    alert(`📅 Fecha ${fechaActiva} seleccionada`);
  });
});
 

window.cambiarGrupo = async function (nuevoGrupo, btnEl) {
  grupoActivo = nuevoGrupo;
  estudiantes = estudiantesPorGrupo[grupoActivo];
  asistenciaPorFecha = {};

  document.querySelectorAll(".btn-grupo").forEach(b => b.classList.remove("activo"));
  btnEl.classList.add("activo");
 
  const nombre = btnEl.textContent;
  document.getElementById("grupo-activo-label").innerHTML =
    ` Grupo activo: <strong>${nombre}</strong>`;
 
  await cargarDatos();
  alert(` Cambiado a ${nombre}`);
};
 
// ─── MODIFICAR FECHA ────────────────────────────────────────────────────────
window.modificarFecha = async function () {
  const nuevaFecha = prompt("Ingrese la nueva fecha (YYYY-MM-DD):", fechaActiva);
  if (!nuevaFecha) return;
 
  const confirmacion = confirm(`⚠️ ¿Desea cambiar la fecha activa de ${fechaActiva} a ${nuevaFecha}?`);
  if (!confirmacion) return;
 
  fechaActiva = nuevaFecha;
  document.getElementById("fecha").value = fechaActiva;
 
  if (!asistenciaPorFecha[fechaActiva]) {
    asistenciaPorFecha[fechaActiva] = {};
  }
 
  await cargarDatos();
  alert(`📅 Fecha activa cambiada a ${fechaActiva}`);
};
 
// ─── BORRAR DATOS DE UNA FECHA ─────────────────────────────────────────────
window.borrarDatosFecha = async function () {
  if (!fechaActiva) return alert("Selecciona una fecha");
 
  const confirmacion = confirm(
    `⚠️ ¿Desea borrar TODAS las asistencias de ${fechaActiva} en ${grupoActivo}?`
  );
  if (!confirmacion) return;
 
  asistenciaPorFecha[fechaActiva] = {};
  await set(ref(db, `grupos/${grupoActivo}/asistencia/${fechaActiva}`), {});
 
  actualizarTabla();
  alert("🗑 Todas las asistencias de esta fecha han sido borradas");
};
 
// ─── ACTUALIZAR TABLA Y CONTEO ─────────────────────────────────────────────
function actualizarTabla() {
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";
 
  if (!estudiantes || Object.keys(estudiantes).length === 0) {
    console.warn("⚠️ No hay estudiantes cargados para", grupoActivo);
    actualizarConteo(0, 0);
    return;
  }
 
  let totalAsistieron = 0;
  const totalEstudiantes = Object.keys(estudiantes).length;
 
  for (let id in estudiantes) {
    const estudiante = estudiantes[id];
    const asistio =
      asistenciaPorFecha[fechaActiva] &&
      asistenciaPorFecha[fechaActiva][id] === "Asistió"
        ? "Asistió"
        : "No asistió";
 
    if (asistio === "Asistió") totalAsistieron++;
 
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${id}</td>
      <td>${estudiante.nombre || "Sin nombre"}</td>
      <td>${estudiante.correo || "-"}</td>
      <td>${estudiante.programa || "-"}</td>
      <td class="estado" onclick="toggleAsistencia('${id}')">
        ${asistio === "Asistió" ? "✅" : "❌"}
      </td>
    `;
 
    if (asistio === "Asistió") fila.classList.add("asistio");
    tbody.appendChild(fila);
  }
 
  actualizarConteo(totalAsistieron, totalEstudiantes);
}
 
function actualizarConteo(asistieron, total) {
  document.getElementById("conteo-asistencia").textContent =
    `Asistieron: ${asistieron} estudiantes`;
  document.getElementById("conteo-total").textContent =
    ` de ${total} registrados`;
}
 

function onScanSuccess(decodedText) {
  const raw = decodedText.trim();
  const match = raw.match(/^(E0{9}\d{6})/);
  const id = match ? match[1] : null;
 
  if (!id) { alert("❌ Código inválido"); return; }
  if (!estudiantes[id]) { alert("❌ Estudiante no registrado en " + grupoActivo); return; }
  if (!fechaActiva) { alert("Selecciona una fecha"); return; }
 
  if (!asistenciaPorFecha[fechaActiva]) {
    asistenciaPorFecha[fechaActiva] = {};
  }
 
  if (asistenciaPorFecha[fechaActiva][id] === "Asistió") {
    alert("⚠️ Ya estaba registrado");
    return;
  }
 
  asistenciaPorFecha[fechaActiva][id] = "Asistió";
  set(ref(db, `grupos/${grupoActivo}/asistencia/${fechaActiva}`),
    asistenciaPorFecha[fechaActiva]);
 
  actualizarTabla();
  alert(`✅ ${estudiantes[id].nombre} registrado`);
}
 
// ─── TOGGLE MANUAL ─────────────────────────────────────────────────────────
window.toggleAsistencia = function (id) {
  if (!asistenciaPorFecha[fechaActiva]) {
    asistenciaPorFecha[fechaActiva] = {};
  }
 
  const estadoActual = asistenciaPorFecha[fechaActiva][id] || "No asistió";
  asistenciaPorFecha[fechaActiva][id] =
    estadoActual === "Asistió" ? "No asistió" : "Asistió";
 
  set(ref(db, `grupos/${grupoActivo}/asistencia/${fechaActiva}`),
    asistenciaPorFecha[fechaActiva]);
 
  actualizarTabla();
};
 
// ─── EXPORTAR EXCEL ─────────────────────────────────────────────────────────
window.exportar = async function () {
  const snapshot = await get(ref(db, `grupos/${grupoActivo}/asistencia`));
 
  if (snapshot.exists()) {
    asistenciaPorFecha = snapshot.val();
  } else {
    asistenciaPorFecha = {};
  }
 
  if (!Object.keys(estudiantes).length) {
    alert("No hay estudiantes registrados en este grupo");
    return;
  }
 
  const fechas = Object.keys(asistenciaPorFecha).sort();
  const data = [];
 
  for (let id in estudiantes) {
    let fila = {
      ID: id,
      Nombre: estudiantes[id].nombre,
      Correo: estudiantes[id].correo,
      Programa: estudiantes[id].programa
    };
 
    fechas.forEach(f => {
      fila[f] = asistenciaPorFecha[f]?.[id] || "No asistió";
    });
 
    data.push(fila);
  }
 
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
  XLSX.writeFile(wb, `asistencia_${grupoActivo}.xlsx`);
};
 
// ─── CARGAR DATOS DESDE FIREBASE ────────────────────────────────────────────
window.cargarDatos = async function () {
  try {
    const snapshot = await get(ref(db, `grupos/${grupoActivo}/asistencia`));
 
    if (snapshot.exists()) {
      asistenciaPorFecha = snapshot.val();
    } else {
      asistenciaPorFecha = {};
    }
 
    actualizarTabla();
  } catch (error) {
    console.error("Error cargando datos:", error);
  }
};
 
// ─── PWA INSTALL ────────────────────────────────────────────────────────────
let deferredPrompt;
 
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
 
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    document.getElementById("installModal").style.display = "flex";
  }
});
 
document.getElementById("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  console.log("Resultado instalación:", choice.outcome);
  deferredPrompt = null;
  document.getElementById("installModal").style.display = "none";
});