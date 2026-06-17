const CLUB_STORAGE_KEY = "mucubaClubListings";
const CLUB_MEDIA_DB = "mucubaClubMedia";
const CLUB_MEDIA_STORE = "media";
const HERO_VIDEO_KEY = "heroVideo";
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "Mucuba2026";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

const demoListings = [
  {
    id: "habitacion-lago",
    name: "Habitación Vista al Lago",
    type: "habitacion",
    status: "active",
    price: 280000,
    guests: 2,
    beds: 1,
    baths: 1,
    summary: "Habitación privada dentro del hotel con vista hacia el paisaje de Guatavita, cama doble, baño privado y acceso a zonas comunes del club.",
    amenities: ["Vista", "Baño privado", "Wifi", "Desayuno", "Parqueadero"],
    blockedDates: [],
    photos: [],
    tone: "lake"
  },
  {
    id: "glamping-bosque",
    name: "Glamping Bosque Andino",
    type: "glamping",
    status: "active",
    price: 420000,
    guests: 2,
    beds: 1,
    baths: 1,
    summary: "Glamping premium rodeado de naturaleza, diseñado para escapadas privadas con mayor independencia, fogata exterior y experiencia de descanso.",
    amenities: ["Fogata", "Terraza", "Ducha caliente", "Desayuno", "Pet friendly"],
    blockedDates: [],
    photos: [],
    tone: "forest"
  },
  {
    id: "suite-familiar",
    name: "Suite Familiar Mucuba",
    type: "habitacion",
    status: "active",
    price: 360000,
    guests: 4,
    beds: 2,
    baths: 1,
    summary: "Suite amplia para familias o grupos pequeños, con dos camas, baño privado, zona de estar y cercanía a las áreas sociales del hotel.",
    amenities: ["Familias", "Zona de estar", "Wifi", "TV", "Parqueadero"],
    blockedDates: [],
    photos: [],
    tone: "suite"
  }
];

const adminList = document.querySelector("[data-admin-list]");
const adminForm = document.querySelector("[data-admin-form]");
const editorTitle = document.querySelector("[data-editor-title]");
const loginScreen = document.querySelector("[data-admin-login]");
const adminContent = document.querySelector("[data-admin-content]");
const adminNav = document.querySelector("[data-admin-nav]");
const adminFooter = document.querySelector("[data-admin-footer]");
const loginForm = document.querySelector("[data-login-form]");
const loginError = document.querySelector("[data-login-error]");
const videoInput = document.querySelector("[data-hero-video-input]");
const videoStatus = document.querySelector("[data-video-status]");
let listings = normalizeListings(loadListings());

function isAuthenticated() {
  return sessionStorage.getItem("mucubaAdminAuth") === "true";
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CLUB_MEDIA_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CLUB_MEDIA_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putMedia(key, blob) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLUB_MEDIA_STORE, "readwrite").objectStore(CLUB_MEDIA_STORE).put(blob, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteMedia(key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLUB_MEDIA_STORE, "readwrite").objectStore(CLUB_MEDIA_STORE).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function showAdmin() {
  loginScreen?.setAttribute("hidden", "");
  adminNav?.removeAttribute("hidden");
  adminFooter?.removeAttribute("hidden");
  adminContent?.removeAttribute("hidden");
}

function requireLogin() {
  if (isAuthenticated()) {
    showAdmin();
    return;
  }
  adminContent?.setAttribute("hidden", "");
  adminNav?.setAttribute("hidden", "");
  adminFooter?.setAttribute("hidden", "");
  if (window.location.hash === "#publicaciones" || window.location.hash === "#editor") {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  if (data.get("username") === ADMIN_USER && data.get("password") === ADMIN_PASSWORD) {
    sessionStorage.setItem("mucubaAdminAuth", "true");
    loginError.textContent = "";
    showAdmin();
    return;
  }
  loginError.textContent = "Usuario o clave incorrectos.";
});

document.querySelector("[data-logout]")?.addEventListener("click", (event) => {
  event.preventDefault();
  sessionStorage.removeItem("mucubaAdminAuth");
  window.location.reload();
});

function formatCurrency(value) {
  return currency.format(Number(value || 0)).replace(/\s/g, " ");
}

function parseMoney(value) {
  return Number(String(value).replace(/[^\d]/g, "")) || 0;
}

function loadListings() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLUB_STORAGE_KEY) || "null");
    return Array.isArray(stored) && stored.length ? stored : demoListings;
  } catch {
    return demoListings;
  }
}

function normalizeListings(items) {
  return items.map((item) => ({
    ...item,
    status: item.status || "active",
    blockedDates: Array.isArray(item.blockedDates) ? item.blockedDates : []
  }));
}

function saveListings() {
  localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(listings));
}

function parseDateList(value) {
  return [...new Set(String(value || "")
    .split(/[\n,; ]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))]
    .sort();
}

function datesInRange(start, end) {
  const dates = [];
  if (!start || !end) return dates;
  const cursor = new Date(`${start}T00:00:00`);
  const limit = new Date(`${end}T00:00:00`);
  if (limit < cursor) return dates;
  while (cursor <= limit) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function filesToDataUrls(files) {
  return Promise.all([...files].slice(0, 8).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function renderAdminList() {
  adminList.innerHTML = listings.map((listing) => `
    <article class="admin-item">
      <div>
        <span class="admin-status ${listing.status}">${listing.status === "active" ? "Activo" : "Oculto"}</span>
        <h3>${listing.name}</h3>
        <p>${listing.type === "glamping" ? "Glamping" : "Habitación"} · ${listing.guests} huéspedes · ${formatCurrency(listing.price)} / noche</p>
        <small>${(listing.blockedDates || []).length} día${(listing.blockedDates || []).length === 1 ? "" : "s"} bloqueado${(listing.blockedDates || []).length === 1 ? "" : "s"}</small>
      </div>
      <div class="admin-actions">
        <button type="button" data-edit="${listing.id}">Editar</button>
        <button type="button" data-toggle="${listing.id}">${listing.status === "active" ? "Ocultar" : "Activar"}</button>
        <button type="button" data-delete="${listing.id}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function resetForm() {
  adminForm.reset();
  adminForm.elements.id.value = "";
  adminForm.elements.status.value = "active";
  editorTitle.textContent = "Nueva publicación";
}

function fillForm(id) {
  const listing = listings.find((item) => item.id === id);
  if (!listing) return;
  adminForm.elements.id.value = listing.id;
  adminForm.elements.status.value = listing.status;
  adminForm.elements.name.value = listing.name;
  adminForm.elements.type.value = listing.type;
  adminForm.elements.price.value = new Intl.NumberFormat("es-CO").format(listing.price);
  adminForm.elements.guests.value = listing.guests;
  adminForm.elements.beds.value = listing.beds;
  adminForm.elements.baths.value = listing.baths;
  adminForm.elements.summary.value = listing.summary;
  adminForm.elements.amenities.value = (listing.amenities || []).join(", ");
  adminForm.elements.blockedDates.value = (listing.blockedDates || []).join(", ");
  editorTitle.textContent = `Editando: ${listing.name}`;
  document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
}

adminForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAuthenticated()) return;
  const data = new FormData(adminForm);
  const id = data.get("id") || `stay-${Date.now()}`;
  const existing = listings.find((item) => item.id === id);
  const uploadedPhotos = await filesToDataUrls(data.getAll("photos").filter((file) => file.size));
  const listing = {
    id,
    status: data.get("status"),
    name: data.get("name").trim(),
    type: data.get("type"),
    price: parseMoney(data.get("price")),
    guests: Number(data.get("guests")),
    beds: Number(data.get("beds")),
    baths: Number(data.get("baths")),
    summary: data.get("summary").trim(),
    amenities: String(data.get("amenities") || "").split(",").map((item) => item.trim()).filter(Boolean),
    blockedDates: parseDateList(data.get("blockedDates")),
    photos: uploadedPhotos.length ? uploadedPhotos : (existing?.photos || []),
    tone: data.get("type") === "glamping" ? "forest" : "suite"
  };
  listings = existing
    ? listings.map((item) => item.id === id ? listing : item)
    : [listing, ...listings];
  saveListings();
  renderAdminList();
  resetForm();
});

adminList?.addEventListener("click", (event) => {
  if (!isAuthenticated()) return;
  const editButton = event.target.closest("[data-edit]");
  const toggleButton = event.target.closest("[data-toggle]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) fillForm(editButton.dataset.edit);
  if (toggleButton) {
    listings = listings.map((item) => item.id === toggleButton.dataset.toggle
      ? { ...item, status: item.status === "active" ? "hidden" : "active" }
      : item);
    saveListings();
    renderAdminList();
  }
  if (deleteButton && confirm("¿Eliminar esta publicación?")) {
    listings = listings.filter((item) => item.id !== deleteButton.dataset.delete);
    saveListings();
    renderAdminList();
    resetForm();
  }
});

document.querySelector("[data-add-block-range]")?.addEventListener("click", () => {
  if (!isAuthenticated()) return;
  const start = document.querySelector("[data-block-start]").value;
  const end = document.querySelector("[data-block-end]").value;
  const current = parseDateList(adminForm.elements.blockedDates.value);
  const merged = [...new Set([...current, ...datesInRange(start, end)])].sort();
  adminForm.elements.blockedDates.value = merged.join(", ");
});

document.querySelector("[data-new-listing]")?.addEventListener("click", () => {
  if (!isAuthenticated()) return;
  resetForm();
});

document.querySelector("[data-reset-club]")?.addEventListener("click", () => {
  if (!isAuthenticated()) return;
  if (!confirm("¿Restaurar publicaciones demo? Esto reemplaza los alojamientos guardados en este navegador.")) return;
  listings = demoListings;
  saveListings();
  renderAdminList();
  resetForm();
});

document.querySelector("[data-save-hero-video]")?.addEventListener("click", async () => {
  if (!isAuthenticated()) return;
  const file = videoInput?.files?.[0];
  if (!file) {
    videoStatus.textContent = "Selecciona un archivo de video primero.";
    return;
  }
  videoStatus.textContent = "Guardando video...";
  try {
    await putMedia(HERO_VIDEO_KEY, file);
    videoStatus.textContent = "Video guardado en este navegador. Abre la landing aquí para verlo.";
  } catch {
    videoStatus.textContent = "No fue posible guardar el video. Intenta con un archivo más liviano.";
  }
});

document.querySelector("[data-remove-hero-video]")?.addEventListener("click", async () => {
  if (!isAuthenticated()) return;
  await deleteMedia(HERO_VIDEO_KEY);
  if (videoInput) videoInput.value = "";
  videoStatus.textContent = "Video removido. La landing usará el archivo assets/mucuba-hotel-video.mp4 si existe.";
});

renderAdminList();
requireLogin();
