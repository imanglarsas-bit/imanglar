// Endpoint preparado para envío automático con adjuntos:
// POST /api/email/send-evaluation
//
// Variables de entorno requeridas en producción:
// RESEND_API_KEY=re_xxxxxxxxxxxxx
// EMAIL_FROM="Inversiones Manglar <notificaciones@imanglar.com>"
// EMAIL_TO_EVCAR=evcarelectricol@gmail.com
// EMAIL_TO_LEGAL=consultasjuridicasgje@gmail.com
//
// Este endpoint usa la API HTTP de Resend para evitar exponer credenciales
// en el frontend. Si se prefiere SMTP, reemplace este bloque por el proveedor
// de correo corporativo correspondiente.

module.exports = async function sendEvaluation(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Método no permitido" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "Inversiones Manglar <onboarding@resend.dev>";
  const recipients = {
    evcar: process.env.EMAIL_TO_EVCAR || "evcarelectricol@gmail.com",
    legal: process.env.EMAIL_TO_LEGAL || "consultasjuridicasgje@gmail.com"
  };

  if (!apiKey) {
    response.status(500).json({ error: "Falta configurar RESEND_API_KEY." });
    return;
  }

  const {
    subject,
    text,
    replyTo,
    recipient = "evcar",
    attachments = []
  } = request.body || {};

  if (!subject || !text) {
    response.status(400).json({ error: "Faltan asunto o cuerpo del correo." });
    return;
  }

  const to = recipients[recipient];
  if (!to) {
    response.status(400).json({ error: "Destinatario no permitido." });
    return;
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      reply_to: replyTo || undefined,
      subject,
      text,
      attachments: attachments.map((file) => ({
        filename: file.filename,
        content: file.content
      }))
    })
  });

  const result = await resendResponse.json();
  if (!resendResponse.ok) {
    response.status(resendResponse.status).json({
      error: "No fue posible enviar el correo automático.",
      detail: result
    });
    return;
  }

  response.status(200).json({ ok: true, id: result.id });
};
