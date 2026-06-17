// Endpoint preparado para Vercel/Node:
// POST /api/mercadopago/create-booking-preference
//
// Variables de entorno requeridas en producción:
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxx
// NEXT_PUBLIC_SITE_URL=https://www.imanglar.com
//
// No coloque credenciales de MercadoPago en el frontend.

module.exports = async function createBookingPreference(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Método no permitido" });
    return;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!accessToken) {
    response.status(500).json({ error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN." });
    return;
  }

  const {
    amount,
    stayName,
    nights,
    checkIn,
    checkOut,
    guests,
    clientName,
    email
  } = request.body || {};

  const paymentAmount = Number(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    response.status(400).json({ error: "El valor de la reserva no es válido." });
    return;
  }

  const preference = {
    items: [
      {
        title: `Reserva Mucuba Club - ${stayName || "Alojamiento"}`,
        description: `${nights || 1} noche(s) · ${checkIn || "entrada"} a ${checkOut || "salida"}`,
        quantity: 1,
        currency_id: "COP",
        unit_price: paymentAmount
      }
    ],
    payer: {
      name: clientName || undefined,
      email: email || undefined
    },
    back_urls: {
      success: `${siteUrl}/club.html?booking=success`,
      pending: `${siteUrl}/club.html?booking=pending`,
      failure: `${siteUrl}/club.html?booking=failure`
    },
    auto_return: "approved",
    metadata: {
      flow: "mucuba_club_booking",
      stay_name: stayName || "",
      nights: nights || "",
      check_in: checkIn || "",
      check_out: checkOut || "",
      guests: guests || "",
      client_name: clientName || ""
    }
  };

  const mercadoPagoResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preference)
  });

  const result = await mercadoPagoResponse.json();
  if (!mercadoPagoResponse.ok) {
    response.status(mercadoPagoResponse.status).json({
      error: "No fue posible crear la preferencia de MercadoPago.",
      detail: result
    });
    return;
  }

  response.status(200).json({
    id: result.id,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point
  });
};
