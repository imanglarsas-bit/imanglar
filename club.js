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

const listNode = document.querySelector("[data-club-list]");
const modal = document.querySelector("[data-club-modal]");
const modalContent = document.querySelector("[data-club-modal-content]");
const closeModal = document.querySelector("[data-close-club]");
const searchForm = document.querySelector("[data-club-search]");
const searchStatus = document.querySelector("[data-search-status]");
let currentFilter = "todos";
let searchState = { checkIn: "", checkOut: "", guests: 1 };
let siteData = { heroVideoUrl: "" };
let listings = normalizeListings(demoListings);

async function loadHeroVideo() {
  const video = document.querySelector("[data-hero-video]");
  if (!video) return;
  if (siteData.heroVideoUrl) {
    video.src = siteData.heroVideoUrl;
    video.load();
    video.play().catch(() => {});
  }
}

function formatCurrency(value) {
  return currency.format(Number(value || 0)).replace(/\s/g, " ");
}

function loadListings() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLUB_STORAGE_KEY) || "null");
    return Array.isArray(stored) && stored.length ? stored : demoListings;
  } catch {
    return demoListings;
  }
}

async function loadRemoteData() {
  try {
    const response = await fetch("/api/mucuba/listings");
    if (!response.ok) throw new Error("AWS no configurado");
    const data = await response.json();
    siteData = data;
    listings = normalizeListings(Array.isArray(data.listings) && data.listings.length ? data.listings : demoListings);
  } catch {
    listings = normalizeListings(loadListings());
  }
}

function normalizeListings(items) {
  return items.map((item) => ({
    ...item,
    status: item.status || "active",
    blockedDates: Array.isArray(item.blockedDates) ? item.blockedDates : []
  }));
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

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const first = new Date(`${start}T00:00:00`);
  const second = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((second - first) / 86400000));
}

function datesInRange(start, end) {
  const dates = [];
  const nights = daysBetween(start, end);
  if (!nights) return dates;
  const cursor = new Date(`${start}T00:00:00`);
  for (let index = 0; index < nights; index += 1) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isAvailable(listing, checkIn, checkOut) {
  if (!checkIn || !checkOut) return true;
  const blocked = new Set(listing.blockedDates || []);
  return !datesInRange(checkIn, checkOut).some((date) => blocked.has(date));
}

function getVisibleListings() {
  return listings.filter((listing) => {
    if (listing.status !== "active") return false;
    if (currentFilter !== "todos" && listing.type !== currentFilter) return false;
    if (Number(searchState.guests || 1) > Number(listing.guests || 1)) return false;
    return isAvailable(listing, searchState.checkIn, searchState.checkOut);
  });
}

function renderListings() {
  const visibleListings = getVisibleListings();
  listNode.innerHTML = visibleListings.length ? visibleListings.map((listing) => `
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
  `).join("") : `<div class="club-empty">No encontramos alojamientos disponibles para esos criterios. Prueba otras fechas o reduce el número de huéspedes.</div>`;
}

function updateSearchStatus() {
  const { checkIn, checkOut, guests } = searchState;
  if (!checkIn || !checkOut) {
    searchStatus.textContent = "Selecciona fechas y número de huéspedes para ver alojamientos disponibles.";
    return;
  }
  const nights = daysBetween(checkIn, checkOut);
  searchStatus.textContent = nights
    ? `${nights} noche${nights === 1 ? "" : "s"} · ${guests} huésped${Number(guests) === 1 ? "" : "es"} · ${getVisibleListings().length} alojamiento${getVisibleListings().length === 1 ? "" : "s"} disponible${getVisibleListings().length === 1 ? "" : "s"}.`
    : "La fecha de salida debe ser posterior a la fecha de entrada.";
}

function openStay(id) {
  const listing = listings.find((item) => item.id === id);
  if (!listing) return;
  modalContent.innerHTML = buildModal(listing);
  modal.showModal();
  const today = new Date().toISOString().split("T")[0];
  modalContent.querySelectorAll("input[type='date']").forEach((input) => input.min = today);
  const bookingForm = modalContent.querySelector("[data-booking-form]");
  if (searchState.checkIn) bookingForm.elements.checkIn.value = searchState.checkIn;
  if (searchState.checkOut) bookingForm.elements.checkOut.value = searchState.checkOut;
  if (searchState.guests) bookingForm.elements.guests.value = Math.min(Number(searchState.guests), Number(listing.guests));
  bindBooking(listing);
}

function buildModal(listing) {
  const gallery = [0, 1, 2].map((_, index) => `<div class="club-gallery-tile" style="${photoStyle(listing, index)}"></div>`).join("");
  return `
    <div class="club-gallery">${gallery}</div>
    <div class="club-booking-layout">
      <section>
        <p class="club-eyebrow">${listing.type === "glamping" ? "Glamping" : "Habitación"} · Mucuba Hotel & Glamping</p>
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
    return { nights, total, data };
  };
  bookingForm.addEventListener("input", updateTotal);
  updateTotal();
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { nights, total, data } = updateTotal();
    if (!nights || total <= 0) {
      alert("Selecciona una fecha de salida posterior a la entrada.");
      return;
    }
    if (!isAvailable(listing, data.get("checkIn"), data.get("checkOut"))) {
      alert("Este alojamiento tiene una o más noches bloqueadas en el rango seleccionado.");
      return;
    }
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

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(searchForm);
  searchState = {
    checkIn: data.get("checkIn"),
    checkOut: data.get("checkOut"),
    guests: Number(data.get("guests") || 1)
  };
  renderListings();
  updateSearchStatus();
});

document.querySelector("[data-clear-search]")?.addEventListener("click", () => {
  searchForm.reset();
  searchState = { checkIn: "", checkOut: "", guests: 1 };
  renderListings();
  updateSearchStatus();
});

document.querySelectorAll("[data-club-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.clubFilter;
    document.querySelectorAll("[data-club-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderListings();
    updateSearchStatus();
  });
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

async function initClub() {
  await loadRemoteData();
  renderListings();
  updateSearchStatus();
  loadHeroVideo();
}

initClub();
