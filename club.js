const CLUB_STORAGE_KEY = "mucubaClubListings";

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
    price: 280000,
    guests: 2,
    beds: 1,
    baths: 1,
    summary: "Habitación privada dentro del hotel con vista hacia el paisaje de Guatavita, cama doble, baño privado y acceso a zonas comunes del club.",
    amenities: ["Vista", "Baño privado", "Wifi", "Desayuno", "Parqueadero"],
    photos: [],
    tone: "lake"
  },
  {
    id: "glamping-bosque",
    name: "Glamping Bosque Andino",
    type: "glamping",
    price: 420000,
    guests: 2,
    beds: 1,
    baths: 1,
    summary: "Glamping premium rodeado de naturaleza, diseñado para escapadas privadas con mayor independencia, fogata exterior y experiencia de descanso.",
    amenities: ["Fogata", "Terraza", "Ducha caliente", "Desayuno", "Pet friendly"],
    photos: [],
    tone: "forest"
  },
  {
    id: "suite-familiar",
    name: "Suite Familiar del Club",
    type: "habitacion",
    price: 360000,
    guests: 4,
    beds: 2,
    baths: 1,
    summary: "Suite amplia para familias o grupos pequeños, con dos camas, baño privado, zona de estar y cercanía a las áreas sociales del hotel.",
    amenities: ["Familias", "Zona de estar", "Wifi", "TV", "Parqueadero"],
    photos: [],
    tone: "suite"
  }
];

const listNode = document.querySelector("[data-club-list]");
const form = document.querySelector("[data-club-form]");
const modal = document.querySelector("[data-club-modal]");
const modalContent = document.querySelector("[data-club-modal-content]");
const closeModal = document.querySelector("[data-close-club]");
let currentFilter = "todos";
let listings = loadListings();

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

function saveListings() {
  localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(listings));
}

function photoStyle(listing, index = 0) {
  const photo = listing.photos?.[index];
  if (photo) return `background-image:url('${photo}')`;
  const gradients = {
    lake: "linear-gradient(135deg, rgba(0,43,70,.18), rgba(0,166,214,.52)), linear-gradient(160deg, #effaff, #b7dfe7)",
    forest: "linear-gradient(135deg, rgba(14,55,30,.18), rgba(124,181,24,.48)), linear-gradient(160deg, #f5ffe8, #bad68c)",
    suite: "linear-gradient(135deg, rgba(84,61,36,.18), rgba(196,155,91,.45)), linear-gradient(160deg, #fff8ef, #e2c59f)"
  };
  return `background:${gradients[listing.tone] || gradients.forest}`;
}

function renderListings() {
  const filtered = currentFilter === "todos" ? listings : listings.filter((item) => item.type === currentFilter);
  listNode.innerHTML = filtered.map((listing) => `
    <article class="club-card" data-open-stay="${listing.id}">
      <div class="club-card-photo" style="${photoStyle(listing)}">
        <span>${listing.type === "glamping" ? "Glamping" : "Habitación"}</span>
      </div>
      <div class="club-card-body">
        <div class="club-card-title-row">
          <h3>${listing.name}</h3>
          <strong>${formatCurrency(listing.price)} <small>/ noche</small></strong>
        </div>
        <p>${listing.summary}</p>
        <div class="club-card-meta">
          <span>${listing.guests} huéspedes</span>
          <span>${listing.beds} cama${Number(listing.beds) === 1 ? "" : "s"}</span>
          <span>${listing.baths} baño${Number(listing.baths) === 1 ? "" : "s"}</span>
        </div>
        <div class="club-amenities">
          ${(listing.amenities || []).slice(0, 5).map((item) => `<span>${item}</span>`).join("")}
        </div>
      </div>
    </article>
  `).join("");
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const first = new Date(`${start}T00:00:00`);
  const second = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((second - first) / 86400000));
}

function openStay(id) {
  const listing = listings.find((item) => item.id === id);
  if (!listing) return;
  modalContent.innerHTML = buildModal(listing);
  modal.showModal();
  const today = new Date().toISOString().split("T")[0];
  modalContent.querySelectorAll("input[type='date']").forEach((input) => input.min = today);
  bindBooking(listing);
}

function buildModal(listing) {
  const gallery = [0, 1, 2].map((_, index) => `<div class="club-gallery-tile" style="${photoStyle(listing, index)}"></div>`).join("");
  return `
    <div class="club-gallery">${gallery}</div>
    <div class="club-booking-layout">
      <section>
        <p class="club-eyebrow">${listing.type === "glamping" ? "Glamping" : "Habitación"} · Mucuba Club</p>
        <h2>${listing.name}</h2>
        <p>${listing.summary}</p>
        <div class="club-card-meta club-card-meta-large">
          <span>${listing.guests} huéspedes</span>
          <span>${listing.beds} cama${Number(listing.beds) === 1 ? "" : "s"}</span>
          <span>${listing.baths} baño${Number(listing.baths) === 1 ? "" : "s"}</span>
        </div>
        <div class="club-amenities club-amenities-large">
          ${(listing.amenities || []).map((item) => `<span>${item}</span>`).join("")}
        </div>
      </section>
      <form class="club-booking-card" data-booking-form>
        <strong>${formatCurrency(listing.price)} <small>/ noche</small></strong>
        <label>Entrada
          <input name="checkIn" type="date" required>
        </label>
        <label>Salida
          <input name="checkOut" type="date" required>
        </label>
        <label>Huéspedes
          <input name="guests" type="number" min="1" max="${listing.guests}" value="1" required>
        </label>
        <label>Nombre
          <input name="clientName" type="text" placeholder="Nombre completo" required>
        </label>
        <label>Correo
          <input name="email" type="email" placeholder="correo@dominio.com" required>
        </label>
        <div class="club-total">
          <span data-booking-nights>0 noches</span>
          <b data-booking-total>${formatCurrency(0)}</b>
        </div>
        <button class="club-button club-button-primary" type="submit">Reservar con MercadoPago</button>
        <p class="club-booking-note">La reserva se procesa en MercadoPago. La disponibilidad queda sujeta a confirmación del equipo Mucuba.</p>
      </form>
    </div>
  `;
}

function bindBooking(listing) {
  const bookingForm = modalContent.querySelector("[data-booking-form]");
  const nightsNode = bookingForm.querySelector("[data-booking-nights]");
  const totalNode = bookingForm.querySelector("[data-booking-total]");
  const updateTotal = () => {
    const data = new FormData(bookingForm);
    const nights = daysBetween(data.get("checkIn"), data.get("checkOut"));
    const total = nights * Number(listing.price);
    nightsNode.textContent = `${nights} noche${nights === 1 ? "" : "s"}`;
    totalNode.textContent = formatCurrency(total);
    return { nights, total };
  };
  bookingForm.addEventListener("input", updateTotal);
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { nights, total } = updateTotal();
    if (!nights || total <= 0) {
      alert("Selecciona una fecha de salida posterior a la entrada.");
      return;
    }
    const data = new FormData(bookingForm);
    const button = bookingForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Creando reserva...";
    try {
      const response = await fetch("/api/mercadopago/create-booking-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          stayName: listing.name,
          nights,
          checkIn: data.get("checkIn"),
          checkOut: data.get("checkOut"),
          guests: data.get("guests"),
          clientName: data.get("clientName"),
          email: data.get("email")
        })
      });
      const result = await response.json();
      if (!response.ok || !result.initPoint) throw new Error(result.error || "No fue posible iniciar MercadoPago.");
      window.location.href = result.initPoint;
    } catch (error) {
      alert(`No fue posible crear el pago: ${error.message}`);
      button.disabled = false;
      button.textContent = "Reservar con MercadoPago";
    }
  });
}

function filesToDataUrls(files) {
  return Promise.all([...files].slice(0, 6).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const photos = await filesToDataUrls(data.getAll("photos").filter((file) => file.size));
  const listing = {
    id: `stay-${Date.now()}`,
    name: data.get("name").trim(),
    type: data.get("type"),
    price: parseMoney(data.get("price")),
    guests: Number(data.get("guests")),
    beds: Number(data.get("beds")),
    baths: Number(data.get("baths")),
    summary: data.get("summary").trim(),
    amenities: String(data.get("amenities") || "").split(",").map((item) => item.trim()).filter(Boolean),
    photos,
    tone: data.get("type") === "glamping" ? "forest" : "suite"
  };
  listings = [listing, ...listings];
  saveListings();
  form.reset();
  renderListings();
  document.getElementById("alojamientos")?.scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll("[data-club-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.clubFilter;
    document.querySelectorAll("[data-club-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderListings();
  });
});

document.querySelector("[data-reset-club]")?.addEventListener("click", () => {
  localStorage.removeItem(CLUB_STORAGE_KEY);
  listings = demoListings;
  renderListings();
});

listNode?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-open-stay]");
  if (card) openStay(card.dataset.openStay);
});

closeModal?.addEventListener("click", () => modal.close());
modal?.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

const bookingParam = new URLSearchParams(window.location.search).get("booking");
if (bookingParam) {
  const messages = {
    success: "Pago recibido. El equipo Mucuba validará la disponibilidad y confirmará tu reserva.",
    pending: "El pago quedó pendiente. Te avisaremos cuando MercadoPago confirme la operación.",
    failure: "El pago no fue aprobado. Puedes intentar nuevamente o contactar al equipo Mucuba."
  };
  const banner = document.createElement("div");
  banner.className = `club-payment-banner ${bookingParam}`;
  banner.textContent = messages[bookingParam] || messages.pending;
  document.body.prepend(banner);
  setTimeout(() => banner.remove(), 9000);
  const url = new URL(window.location.href);
  url.searchParams.delete("booking");
  window.history.replaceState({}, "", url.toString());
}

renderListings();
