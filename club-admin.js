const ADMIN_TOKEN_KEY = "mucubaAdminToken";

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
    summary: "Habitación privada dentro del hotel con vista hacia el paisaje de Guatavita, cama doble, baño privado y acceso a zonas comunes del hotel.",
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
    summary: "Glamping premium rodeado de naturaleza, diseñado para escapadas privadas con independencia, fogata exterior y experiencia de descanso.",
    amenities: ["Fogata", "Terraza", "Ducha caliente", "Desayuno", "Pet friendly"],
    blockedDates: [],
    photos: [],
    tone: "forest"
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
let siteData = { listings: demoListings, heroVideoUrl: "" };
let listings = normalizeListings(demoListings);

function token() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function isAuthenticated() {
  return Boolean(token());
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible completar la solicitud.");
  return data;
}

function showAdminShell() {
  loginScreen?.setAttribute("hidden", "");
  adminNav?.removeAttribute("hidden");
  adminFooter?.removeAttribute("hidden");
  adminContent?.removeAttribute("hidden");
}

function hideAdminShell() {
  adminContent?.setAttribute("hidden", "");
  adminNav?.setAttribute("hidden", "");
  adminFooter?.setAttribute("hidden", "");
  if (window.location.hash === "#publicaciones" || window.location.hash === "#editor") {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

async function showAdmin() {
  showAdminShell();
  await loadRemoteAdminData();
}

function requireLogin() {
  if (isAuthenticated()) {
    showAdmin().catch((error) => {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      loginError.textContent = error.message;
      hideAdminShell();
    });
    return;
  }
  hideAdminShell();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  loginError.textContent = "";
  try {
    const result = await apiJson("/api/mucuba/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password")
      })
    });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    await showAdmin();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", (event) => {
  event.preventDefault();
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.location.reload();
});

function formatCurrency(value) {
  return currency.format(Number(value || 0)).replace(/\s/g, " ");
}

function parseMoney(value) {
  return Number(String(value).replace(/[^\d]/g, "")) || 0;
}

function normalizeListings(items) {
  return (items || []).map((item) => ({
    ...item,
    status: item.status || "active",
    blockedDates: Array.isArray(item.blockedDates) ? item.blockedDates : [],
    photos: Array.isArray(item.photos) ? item.photos : []
  }));
}

async function loadRemoteAdminData() {
  const data = await apiJson("/api/mucuba/listings", {
    headers: authHeaders()
  });
  siteData = {
    heroVideoUrl: data.heroVideoUrl || "",
    listings: Array.isArray(data.listings) && data.listings.length ? data.listings : demoListings
  };
  listings = normalizeListings(siteData.listings);
  renderAdminList();
  updateVideoStatus();
}

async function saveRemoteData() {
  await apiJson("/api/mucuba/listings", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      listings,
      heroVideoUrl: siteData.heroVideoUrl || ""
    })
  });
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

async function uploadFile(file, folder) {
  const contentType = file.type || "application/octet-stream";
  const preparedUpload = await apiJson("/api/mucuba/presign-upload", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      folder
    })
  });
  const uploadResponse = await fetch(preparedUpload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": preparedUpload.contentType || contentType },
    body: file
  });
  if (!uploadResponse.ok) {
    throw new Error("No fue posible cargar el archivo a AWS. Revisa CORS y permisos del bucket S3.");
  }
  return { url: preparedUpload.url };
}

async function uploadFiles(files, folder) {
  const uploaded = [];
  for (const file of [...files]) {
    const result = await uploadFile(file, folder);
    uploaded.push(result.url);
  }
  return uploaded;
}

function renderAdminList() {
  adminList.innerHTML = listings.map((listing) => `
    <article class="admin-item">
      <div>
        <span class="admin-status ${listing.status}">${listing.status === "active" ? "Activo" : "Oculto"}</span>
        <h3>${listing.name}</h3>
        <p>${listing.type === "glamping" ? "Glamping" : "Habitación"} · ${listing.guests} huéspedes · ${formatCurrency(listing.price)} / noche</p>
        <small>${(listing.blockedDates || []).length} día${(listing.blockedDates || []).length === 1 ? "" : "s"} bloqueado${(listing.blockedDates || []).length === 1 ? "" : "s"} · ${(listing.photos || []).length} foto${(listing.photos || []).length === 1 ? "" : "s"}</small>
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
  const button = adminForm.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Guardando...";
  try {
    const uploadedPhotos = await uploadFiles(data.getAll("photos").filter((file) => file.size), `rooms/${id}`);
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
    await saveRemoteData();
    renderAdminList();
    resetForm();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Guardar publicación";
  }
});

adminList?.addEventListener("click", async (event) => {
  if (!isAuthenticated()) return;
  const editButton = event.target.closest("[data-edit]");
  const toggleButton = event.target.closest("[data-toggle]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) fillForm(editButton.dataset.edit);
  if (toggleButton) {
    listings = listings.map((item) => item.id === toggleButton.dataset.toggle
      ? { ...item, status: item.status === "active" ? "hidden" : "active" }
      : item);
    await saveRemoteData();
    renderAdminList();
  }
  if (deleteButton && confirm("¿Eliminar esta publicación?")) {
    listings = listings.filter((item) => item.id !== deleteButton.dataset.delete);
    await saveRemoteData();
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

document.querySelector("[data-reset-club]")?.addEventListener("click", async () => {
  if (!isAuthenticated()) return;
  if (!confirm("¿Restaurar publicaciones demo? Esto reemplaza los alojamientos guardados en AWS.")) return;
  listings = demoListings;
  await saveRemoteData();
  renderAdminList();
  resetForm();
});

function updateVideoStatus() {
  videoStatus.textContent = siteData.heroVideoUrl
    ? "Video principal conectado desde AWS."
    : "Sin video cargado desde AWS.";
}

document.querySelector("[data-save-hero-video]")?.addEventListener("click", async () => {
  if (!isAuthenticated()) return;
  const file = videoInput?.files?.[0];
  if (!file) {
    videoStatus.textContent = "Selecciona un archivo de video primero.";
    return;
  }
  videoStatus.textContent = "Subiendo video a AWS...";
  try {
    const result = await uploadFile(file, "hero");
    siteData.heroVideoUrl = result.url;
    await saveRemoteData();
    updateVideoStatus();
  } catch (error) {
    videoStatus.textContent = error.message;
  }
});

document.querySelector("[data-remove-hero-video]")?.addEventListener("click", async () => {
  if (!isAuthenticated()) return;
  siteData.heroVideoUrl = "";
  await saveRemoteData();
  if (videoInput) videoInput.value = "";
  updateVideoStatus();
});

requireLogin();
