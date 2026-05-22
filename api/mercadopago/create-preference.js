// Endpoint preparado para Vercel/Node:
// POST /api/mercadopago/create-preference
//
// Variables de entorno requeridas en producción:
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxx
// NEXT_PUBLIC_SITE_URL=https://tudominio.com
//
// No coloque credenciales de MercadoPago en el frontend.

module.exports = async function createPreference(request, response) {
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
    clientName,
    email,
    identificationType,
    identificationNumber
  } = request.body || {};

  const paymentAmount = Number(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    response.status(400).json({ error: "El valor del pago inicial no es válido." });
    return;
  }

  const preference = {
    items: [
      {
        title: "Pago inicial estudio devolución IVA EV",
        description: `Cliente: ${clientName || "No indicado"}`,
        quantity: 1,
        currency_id: "COP",
        unit_price: paymentAmount
      }
    ],
    payer: {
      name: clientName || undefined,
      email: email || undefined,
      identification: {
        type: identificationType || undefined,
        number: identificationNumber || undefined
      }
    },
    back_urls: {
      success: `${siteUrl}/energia.html?payment=success`,
      pending: `${siteUrl}/energia.html?payment=pending`,
      failure: `${siteUrl}/energia.html?payment=failure`
    },
    auto_return: "approved",
    metadata: {
      flow: "ev_iva_refund_study",
      client_name: clientName || "",
      identification_type: identificationType || "",
      identification_number: identificationNumber || ""
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
