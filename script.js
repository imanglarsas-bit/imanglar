const siteConfig = {
  whatsappNumber: "573224591377",
  whatsappMessage: "Hola, quiero recibir asesoría de SRC Consulting.",
  tutelaEmail: "consultasjuridicasgje@gmail.com",
  documentUploadUrl: "#"
};

function getWhatsAppNumber() {
  return document.body.dataset.whatsappNumber || siteConfig.whatsappNumber;
}

function getWhatsAppMessage() {
  return document.body.dataset.whatsappMessage || siteConfig.whatsappMessage;
}

function getWhatsAppLabel() {
  return document.body.dataset.whatsappLabel || "SRC Consulting";
}

function buildWhatsAppUrl() {
  const text = encodeURIComponent(getWhatsAppMessage());
  return `https://wa.me/${getWhatsAppNumber()}?text=${text}`;
}

function buildCustomWhatsAppUrl(message) {
  return `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
}

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  link.href = buildWhatsAppUrl();
  link.target = "_blank";
  link.rel = "noopener";
});

document.querySelectorAll("[data-documents]").forEach((link) => {
  link.href = siteConfig.documentUploadUrl;
  if (siteConfig.documentUploadUrl === "#") {
    link.setAttribute("aria-label", "Pendiente conectar formulario de documentos");
  } else {
    link.target = "_blank";
    link.rel = "noopener";
  }
});

function fileToBase64Attachment(file, prefix = "") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        filename: `${prefix}${file.name}`,
        content: String(reader.result).split(",")[1] || ""
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendSiteEmail({ subject, text, replyTo, recipient = "legal", files = [] }) {
  const attachments = await Promise.all(
    files
      .filter((file) => file && file.name)
      .map((file) => fileToBase64Attachment(file))
  );

  const response = await fetch("/api/email/send-evaluation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      text,
      replyTo,
      recipient,
      attachments
    })
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const detail = result.detail && (result.detail.message || result.detail.error || JSON.stringify(result.detail));
    throw new Error([result.error, detail].filter(Boolean).join(" — ") || "No fue posible enviar el correo.");
  }

  return response.json();
}

document.querySelectorAll("[data-intake-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const supportFiles = data.getAll("soportesIniciales").filter((file) => file && file.name);
    if (!data.get("casoInicial") && supportFiles.length === 0) {
      alert("Describe el caso o adjunta soportes para enviar la solicitud de análisis.");
      return;
    }

    const subject = "Solicitud de análisis inicial - Persona natural";
    const message = [
      "Solicitud de análisis inicial para persona natural.",
      "",
      `Nombre: ${data.get("nombreInicial") || "No indicado"}`,
      `Correo: ${data.get("correoInicial") || "No indicado"}`,
      `Teléfono: ${data.get("telefonoInicial") || "No indicado"}`,
      "",
      "Caso:",
      data.get("casoInicial") || "No indicado",
      "",
      `Soportes seleccionados: ${supportFiles.length ? supportFiles.map((file) => file.name).join(", ") : "No adjuntados"}`,
      "Los soportes cargados por el usuario se adjuntan a este correo cuando el backend de correo está activo."
    ].join("\n");

    try {
      await sendSiteEmail({
        subject,
        text: message,
        replyTo: data.get("correoInicial"),
        recipient: "legal",
        files: supportFiles
      });
      alert("Solicitud enviada correctamente. Nuestro equipo revisará la información.");
      form.reset();
    } catch (error) {
      alert(`No fue posible enviar el correo automático: ${error.message}`);
    }
  });
});

document.querySelectorAll("[data-plan-whatsapp]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const planName = link.dataset.planName || "plan empresarial";
    const message = `Hola, quiero recibir información sobre el ${planName} de acompañamiento jurídico empresarial de Cárdenas Romero Abogados.`;
    window.open(buildCustomWhatsAppUrl(message), "_blank", "noopener");
  });
});

document.querySelectorAll("[data-ev-wizard]").forEach((wizard) => {
  const form = wizard.querySelector("[data-ev-form]");
  const steps = [...wizard.querySelectorAll("[data-step]")];
  const progressItems = [...wizard.querySelectorAll("[data-progress-step]")];
  const valueInput = wizard.querySelector("[data-vehicle-value]");
  const refundResult = wizard.querySelector("[data-refund-result]");
  const feeResult = wizard.querySelector("[data-fee-result]");
  const netResult = wizard.querySelector("[data-net-result]");
  const paymentFee = wizard.querySelector("[data-payment-fee]");
  const paymentInitial = wizard.querySelector("[data-payment-initial]");
  const paymentFinal = wizard.querySelector("[data-payment-final]");
  const paymentMessage = wizard.querySelector("[data-payment-message]");
  const upmeInput = wizard.querySelector("[data-upme-input]");
  const upmePanel = wizard.querySelector("[data-upme-panel]");
  const summaryPanel = wizard.querySelector("[data-ev-summary]");
  const confirmation = wizard.querySelector("[data-ev-confirmation]");
  const uploadedDocuments = new Map();
  let currentStep = 1;
  let calculation = { vehicleValue: 0, refund: 0, fee: 0, net: 0, initialPayment: 0, finalPayment: 0 };

  const currency = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });

  const plainNumber = new Intl.NumberFormat("es-CO");
  const parseCurrency = (value) => Number(String(value).replace(/[^\d]/g, "")) || 0;
  const formatCurrency = (value) => currency.format(value).replace(/\s/g, " ");
  const getData = () => new FormData(form);
  const getDocumentsList = () => [...uploadedDocuments.values()].map((item) => `${item.label}: ${item.file.name}`);

  const updateProgress = () => {
    progressItems.forEach((item) => {
      const step = Number(item.dataset.progressStep);
      item.classList.toggle("active", step === currentStep);
      item.classList.toggle("done", step < currentStep);
    });
  };

  const updateCalculation = () => {
    const vehicleValue = parseCurrency(valueInput.value);
    const refund = vehicleValue * 0.05;
    const fee = vehicleValue ? (refund < 8000000 ? 1500000 : refund * 0.18) : 0;
    const net = refund - fee;
    const initialPayment = fee * 0.5;
    const finalPayment = fee * 0.5;
    calculation = { vehicleValue, refund, fee, net, initialPayment, finalPayment };

    valueInput.value = vehicleValue ? plainNumber.format(vehicleValue) : "";
    refundResult.textContent = formatCurrency(refund);
    feeResult.textContent = formatCurrency(fee);
    netResult.textContent = formatCurrency(net);
    paymentFee.textContent = formatCurrency(fee);
    paymentInitial.textContent = formatCurrency(initialPayment);
    paymentFinal.textContent = formatCurrency(finalPayment);
  };

  const createPaymentPreference = async () => {
    const data = getData();
    const response = await fetch("/api/mercadopago/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: calculation.initialPayment,
        clientName: data.get("nombreCompleto"),
        email: data.get("correo"),
        identificationType: data.get("tipoIdentificacion"),
        identificationNumber: data.get("numeroIdentificacion")
      })
    });
    const result = await response.json();
    if (!response.ok || !result.initPoint) throw new Error(result.error || "No fue posible crear la preferencia.");
    return result.initPoint;
  };

  const validateCurrentStep = () => {
    if (currentStep !== 1) return true;
    const fields = [...steps[0].querySelectorAll("input[required], select[required]")];
    const invalid = fields.find((field) => !field.value.trim());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    updateCalculation();
    return true;
  };

  const buildSummary = () => {
    const data = getData();
    const documents = getDocumentsList();
    summaryPanel.innerHTML = `
      <article><span>Solicitante</span><strong>${data.get("nombreCompleto") || "No indicado"}</strong><small>${data.get("tipoIdentificacion") || ""} ${data.get("numeroIdentificacion") || ""}</small></article>
      <article><span>Vehículo</span><strong>${data.get("marcaVehiculo") || "No indicado"} ${data.get("modeloVehiculo") || ""}</strong><small>Factura: ${formatCurrency(calculation.vehicleValue)}</small></article>
      <article><span>Recuperación estimada</span><strong>${formatCurrency(calculation.refund)}</strong><small>Neto aproximado: ${formatCurrency(calculation.net)}</small></article>
      <article><span>Documentos cargados</span><strong>${documents.length}</strong><small>${documents.length ? documents.join(" · ") : "Sin documentos cargados"}</small></article>
    `;
  };

  const showStep = (step) => {
    currentStep = Math.max(1, Math.min(5, step));
    if (currentStep === 5) buildSummary();
    steps.forEach((panel) => {
      const isActive = Number(panel.dataset.step) === currentStep;
      panel.toggleAttribute("hidden", !isActive);
      panel.classList.toggle("active", isActive);
    });
    updateProgress();
  };

  const setUploadStatus = (input, file) => {
    const accordion = input.closest(".upload-accordion");
    const status = accordion.querySelector("[data-upload-status]");
    const zone = accordion.querySelector("[data-drop-zone]");
    const label = input.dataset.docLabel;
    if (!file) return;
    uploadedDocuments.set(input.name, { label, file });
    status.textContent = "Cargado correctamente";
    status.classList.add("loaded");
    zone.classList.add("loaded");
    zone.childNodes[0].textContent = file.name;
  };

  valueInput.addEventListener("input", updateCalculation);
  valueInput.addEventListener("blur", updateCalculation);

  wizard.querySelectorAll("[data-numeric-only]").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
    });
  });

  wizard.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!validateCurrentStep()) return;
      showStep(currentStep + 1);
    });
  });

  wizard.querySelectorAll("[data-prev-step]").forEach((button) => {
    button.addEventListener("click", () => showStep(currentStep - 1));
  });

  wizard.querySelectorAll("[data-upme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.upmeChoice;
      upmeInput.value = choice;
      wizard.querySelectorAll("[data-upme-choice]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      if (choice === "No") {
        upmePanel.removeAttribute("hidden");
      } else {
        upmePanel.setAttribute("hidden", "");
        showStep(3);
      }
    });
  });

  wizard.querySelectorAll("[data-doc-upload]").forEach((input) => {
    input.addEventListener("change", () => setUploadStatus(input, input.files[0]));
  });

  wizard.querySelectorAll("[data-drop-zone]").forEach((zone) => {
    const input = zone.querySelector("input[type='file']");
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
      if (!event.dataTransfer.files.length) return;
      input.files = event.dataTransfer.files;
      setUploadStatus(input, event.dataTransfer.files[0]);
    });
  });

  const contactAdvisor = () => {
    const data = getData();
    const message = [
      "Hola, busco asesoría de SRC Consulting sobre devolución de IVA y beneficios UPME para vehículo eléctrico o híbrido.",
      `Nombre o razón social: ${data.get("nombreCompleto") || "No indicado"}`,
      `Identificación: ${data.get("tipoIdentificacion") || "No indicada"} ${data.get("numeroIdentificacion") || ""}`.trim(),
      `Vehículo: ${data.get("marcaVehiculo") || "Marca no indicada"} ${data.get("modeloVehiculo") || "modelo no indicado"}`,
      `Valor factura: ${formatCurrency(Number(data.get("valorFactura") || 0))}`,
      `Certificado UPME: ${data.get("certificadoUpme") || "No indicado"}`,
      `Recuperación estimada DIAN: ${formatCurrency(calculation.refund)}`,
      `Pago inicial estimado 50%: ${formatCurrency(calculation.initialPayment)}`,
      "Vengo del simulador UPME/DIAN del sitio web y quiero continuar la evaluación de viabilidad."
    ].join("\n");
    window.open(buildCustomWhatsAppUrl(message), "_blank", "noopener");
  };

  const sendEvaluation = async (mode) => {
    updateCalculation();
    const data = getData();
    const documents = getDocumentsList();
    const subject = `Solicitud de evaluación devolución IVA — ${data.get("nombreCompleto") || "Solicitante"} — ${data.get("tipoIdentificacion") || "ID"} ${data.get("numeroIdentificacion") || ""}`;
    const body = [
      "Señores SRC Consulting,",
      "",
      `Por medio del presente, ${data.get("nombreCompleto") || "[NOMBRE O RAZÓN SOCIAL]"}, identificado(a) con ${data.get("tipoIdentificacion") || "[TIPO IDENTIFICACIÓN]"} No. ${data.get("numeroIdentificacion") || "[NÚMERO IDENTIFICACIÓN]"}, manifiesta su interés en iniciar la evaluación de viabilidad para la solicitud de devolución del IVA pagado en la adquisición de vehículo eléctrico o híbrido.`,
      "",
      "Datos del solicitante:",
      `- Nombre o razón social: ${data.get("nombreCompleto") || "No indicado"}`,
      `- Tipo y número de identificación: ${data.get("tipoIdentificacion") || "No indicado"} ${data.get("numeroIdentificacion") || ""}`,
      `- Teléfono: ${data.get("telefono") || "No indicado"}`,
      `- Correo: ${data.get("correo") || "No indicado"}`,
      `- Ciudad: ${data.get("ciudad") || "No indicada"}`,
      "",
      "Datos del vehículo:",
      `- Marca: ${data.get("marcaVehiculo") || "No indicada"}`,
      `- Modelo: ${data.get("modeloVehiculo") || "No indicado"}`,
      `- Valor factura electrónica: ${formatCurrency(calculation.vehicleValue)}`,
      "",
      "Resultados estimados:",
      `- Recuperación estimada: ${formatCurrency(calculation.refund)}`,
      `- Honorarios estimados: ${formatCurrency(calculation.fee)}`,
      `- Pago inicial 50%: ${formatCurrency(calculation.initialPayment)}`,
      `- Pago final 50%: ${formatCurrency(calculation.finalPayment)}`,
      `- Valor neto aproximado: ${formatCurrency(calculation.net)}`,
      "",
      "Estado Certificado UPME:",
      upmeInput.value || "No indicado",
      "",
      "Documentos adjuntos:",
      documents.length ? documents.map((item) => `- ${item}`).join("\n") : "- No se cargaron documentos en el navegador.",
      "",
      mode === "payment"
        ? "Forma de pago: el solicitante seleccionó la opción de pago en línea para el primer abono del 50%; el correo se genera como solicitud con pago del primer abono en proceso de confirmación por MercadoPago."
        : "Forma de pago: el solicitante prefiere hablar con un asesor antes de realizar el primer abono.",
      "",
      "Solicito iniciar la evaluación de la solicitud y revisión documental correspondiente.",
      "",
      `Comentarios adicionales: ${data.get("comentarios") || "Sin comentarios"}`
    ].join("\n");

    const attachments = await Promise.all(
      [...uploadedDocuments.values()].map(({ label, file }) => fileToBase64Attachment(file, `${label} - `))
    );

    try {
      const response = await fetch("/api/email/send-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          text: body,
          replyTo: data.get("correo"),
          recipient: "evcar",
          attachments
        })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const detail = result.detail && (result.detail.message || result.detail.error || JSON.stringify(result.detail));
        throw new Error([result.error, detail].filter(Boolean).join(" — ") || "No fue posible enviar el correo automático.");
      }
    } catch (error) {
      alert(`No fue posible enviar automáticamente el formulario con todos los documentos: ${error.message}`);
      throw error;
    }

    form.setAttribute("hidden", "");
    confirmation.removeAttribute("hidden");
  };

  const finalPayButton = wizard.querySelector("[data-final-pay]");
  const finalAdvisorButton = wizard.querySelector("[data-final-advisor]");

  const setFinalButtonsDisabled = (disabled) => {
    finalPayButton.disabled = disabled;
    finalAdvisorButton.disabled = disabled;
  };

  finalPayButton.addEventListener("click", async () => {
    paymentMessage.textContent = "";
    setFinalButtonsDisabled(true);
    try {
      await sendEvaluation("payment");
    } catch (error) {
      setFinalButtonsDisabled(false);
      return;
    }
    try {
      const initPoint = await createPaymentPreference();
      window.location.href = initPoint;
    } catch (error) {
      setFinalButtonsDisabled(false);
      alert("La información fue enviada, pero MercadoPago aún no está activo. Publique el endpoint con las credenciales reales para abrir el checkout.");
    }
  });

  finalAdvisorButton.addEventListener("click", async () => {
    setFinalButtonsDisabled(true);
    try {
      await sendEvaluation("advisor");
    } catch (error) {
      setFinalButtonsDisabled(false);
      return;
    }
    contactAdvisor();
  });

  updateCalculation();
  showStep(1);
});

const areaModal = document.querySelector("[data-area-modal]");
if (areaModal) {
  const areaTitle = areaModal.querySelector("[data-area-modal-title]");
  const areaDetail = areaModal.querySelector("[data-area-modal-detail]");
  const closeAreaModal = () => areaModal.setAttribute("hidden", "");

  areaModal.querySelector("[data-area-close]").addEventListener("click", closeAreaModal);
  areaModal.addEventListener("click", (event) => {
    if (event.target === areaModal) closeAreaModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !areaModal.hasAttribute("hidden")) {
      closeAreaModal();
      return;
    }
    if (event.key === "Tab" && !areaModal.hasAttribute("hidden")) {
      const focusable = [...areaModal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const openAreaModal = () => {
    areaModal.removeAttribute("hidden");
    const closeButton = areaModal.querySelector("[data-area-close]");
    if (closeButton) closeButton.focus();
  };

  document.querySelectorAll("[data-area-title]").forEach((card) => {
    card.addEventListener("click", () => {
      areaTitle.textContent = card.dataset.areaTitle || "";
      areaDetail.textContent = card.dataset.areaDetail || "";
      openAreaModal();
    });
  });
}

function buildMailUrl(subject, body) {
  const email = document.body.dataset.tutelaEmail || siteConfig.tutelaEmail;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.querySelectorAll("[data-tutela-toggle]").forEach((button) => {
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  if (!panel) return;

  button.addEventListener("click", () => {
    const isOpening = panel.hasAttribute("hidden");
    panel.toggleAttribute("hidden", !isOpening);
    button.setAttribute("aria-expanded", String(isOpening));
    button.textContent = isOpening ? "Cerrar solicitud de tutela" : "Iniciar solicitud de tutela";
  });
});

document.querySelectorAll("[data-tutela-form]").forEach((form) => {
  const serviceRadios = form.querySelectorAll('input[name="servicioTutela"]');
  const rightChecks = form.querySelectorAll('input[name="derechos"]');
  const rightInput = form.querySelector('input[name="derechoPrincipal"]');
  const uploadField = form.querySelector("[data-review-upload]");
  const powerFields = form.querySelector("[data-power-fields]");
  const powerSubmit = form.querySelector("[data-power-submit]");
  const caseFields = form.querySelectorAll("[data-case-field]");

  function getSelectedRights() {
    return Array.from(rightChecks)
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  function syncSelectedRights() {
    const selectedRights = getSelectedRights();
    rightInput.value = selectedRights.join(", ");
  }

  function toggleReviewMode() {
    const selectedService = form.querySelector('input[name="servicioTutela"]:checked');
    const isReview = selectedService && selectedService.value === "Revisión de tutela o documento";
    const isPower = selectedService && selectedService.value === "Otorgo poder para presentar tutela";

    uploadField.hidden = !isReview;
    uploadField.querySelectorAll("input").forEach((field) => {
      field.disabled = !isReview;
      field.required = Boolean(isReview);
    });
    powerFields.hidden = !isPower;
    powerSubmit.disabled = !isPower;
    powerFields.querySelectorAll("input").forEach((field) => {
      field.disabled = !isPower;
      field.required = Boolean(isPower);
    });

    caseFields.forEach((container) => {
      container.classList.toggle("is-disabled", Boolean(isReview));
      container.querySelectorAll("input, textarea").forEach((field) => {
        field.disabled = Boolean(isReview);
      });
      if (container.matches("details")) {
        container.querySelectorAll("input").forEach((field) => {
          field.disabled = Boolean(isReview);
        });
        if (isReview) {
          container.removeAttribute("open");
        }
      }
    });
  }

  rightChecks.forEach((input) => {
    input.addEventListener("change", syncSelectedRights);
  });

  serviceRadios.forEach((input) => {
    input.addEventListener("change", toggleReviewMode);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const servicio = data.get("servicioTutela");
    if (!servicio) {
      alert("Selecciona el servicio que necesitas antes de continuar.");
      return;
    }
    const selectedRights = getSelectedRights();
    const reviewPdf = data.get("tutelaCompletaPdf");
    const powerIdentityPdf = data.get("documentoIdentidadPoder");
    const powerEvidenceFiles = data.getAll("pruebasPoder").filter((file) => file && file.name);
    const isReview = servicio === "Revisión de tutela o documento";
    const isPower = servicio === "Otorgo poder para presentar tutela";

    if ((isReview && (!reviewPdf || !reviewPdf.name)) || (isPower && (!powerIdentityPdf || !powerIdentityPdf.name || powerEvidenceFiles.length === 0))) {
      alert("Aún no adjunta documentación.");
      return;
    }

    const subject = `Solicitud de tutela - ${servicio}`;
    const message = [
      "Solicitud de apoyo con acción de tutela.",
      "",
      `Nombre: ${data.get("nombre") || "No indicado"}`,
      `Cédula: ${data.get("cedula") || "No indicada"}`,
      `Ciudad de expedición: ${data.get("ciudadExpedicion") || "No indicada"}`,
      `Teléfono de contacto: ${data.get("telefonoCiudadano") || "No indicado"}`,
      `Servicio solicitado: ${servicio}`,
      isPower ? `Correo electrónico: ${data.get("correoPoder") || "No indicado"}` : "",
      isPower ? `Documento de identidad PDF seleccionado: ${powerIdentityPdf && powerIdentityPdf.name ? powerIdentityPdf.name : "No adjuntado"}` : "",
      isPower ? `Anexos o pruebas seleccionados: ${powerEvidenceFiles.length ? powerEvidenceFiles.map((file) => file.name).join(", ") : "No adjuntados"}` : "",
      isReview ? `Escrito completo de tutela con anexos: ${reviewPdf && reviewPdf.name ? reviewPdf.name : "No adjuntado"}` : "",
      isReview ? "" : `Accionado: ${data.get("accionado") || "No indicado"}`,
      isReview ? "" : `Tipo de documento del accionado: ${data.get("tipoDocumentoAccionado") || "No indicado"}`,
      isReview ? "" : `Dirección del accionado: ${data.get("direccionAccionado") || "No indicada"}`,
      isReview ? "" : `Teléfono del accionado: ${data.get("telefonoAccionado") || "No indicado"}`,
      isReview ? "Instruccion: adjuntar un solo PDF con el escrito completo de tutela y todos sus anexos." : `Derecho que considero vulnerado: ${data.get("derechoPrincipal") || "No indicado"}`,
      isReview ? "" : `Derechos constitucionales seleccionados: ${selectedRights.length ? selectedRights.join(", ") : "No indicados"}`,
      "",
      isReview || isPower ? "Los documentos cargados por el usuario se adjuntan a este correo cuando el backend de correo está activo." : "Hechos:",
      isReview ? "" : data.get("hechos") || "No indicados"
    ].filter(Boolean).join("\n");

    const files = [
      reviewPdf,
      powerIdentityPdf,
      ...powerEvidenceFiles
    ].filter((file) => file && file.name);

    try {
      await sendSiteEmail({
        subject,
        text: message,
        replyTo: data.get("correoPoder") || "",
        recipient: "legal",
        files
      });
      alert("Solicitud enviada correctamente. Nuestro equipo revisará la documentación.");
      form.reset();
      toggleReviewMode();
    } catch (error) {
      alert(`No fue posible enviar el correo automático: ${error.message}`);
    }
  });

  toggleReviewMode();
});

const whatsappIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3.2A12.65 12.65 0 0 0 5.1 22.22L3.4 28.8l6.73-1.62A12.66 12.66 0 1 0 16.04 3.2Zm0 2.28a10.38 10.38 0 0 1 8.76 15.96 10.33 10.33 0 0 1-13.93 3.36l-.45-.27-3.99.96 1.02-3.88-.29-.47A10.37 10.37 0 0 1 16.04 5.48Zm-4.08 4.83c-.23 0-.6.08-.92.43-.32.35-1.21 1.18-1.21 2.87s1.24 3.34 1.41 3.57c.17.23 2.39 3.82 5.94 5.2 2.95 1.16 3.55.93 4.19.87.64-.06 2.06-.84 2.35-1.65.29-.81.29-1.51.2-1.65-.08-.14-.32-.23-.66-.4-.35-.17-2.06-1.02-2.38-1.13-.32-.12-.55-.17-.78.17-.23.35-.89 1.13-1.09 1.36-.2.23-.4.26-.75.09-.35-.17-1.47-.54-2.8-1.72-1.03-.92-1.73-2.06-1.93-2.41-.2-.35-.02-.54.15-.71.16-.15.35-.4.52-.61.17-.2.23-.35.35-.58.12-.23.06-.43-.03-.61-.09-.17-.78-1.88-1.07-2.58-.28-.67-.57-.58-.78-.59h-.67Z"/></svg>';

document.querySelectorAll("[data-electrolinera-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const subject = "Consulta proyecto de electrolinera — SRC Consulting";
    const body = [
      "Consulta sobre proyecto de electrolinera.",
      "",
      `Nombre: ${data.get("nombreEV") || "No indicado"}`,
      `Teléfono: ${data.get("telefonoEV") || "No indicado"}`,
      `Correo: ${data.get("correoEV") || "No indicado"}`,
      `Ubicación del lote: ${data.get("ubicacionEV") || "No indicada"}`,
      "",
      "El solicitante desea recibir información sobre el proyecto llave en mano de electrolinera (desde $270 millones)."
    ].join("\n");
    try {
      await sendSiteEmail({
        subject,
        text: body,
        replyTo: data.get("correoEV"),
        recipient: "evcar"
      });
      alert("Consulta enviada correctamente. Nuestro equipo se comunicará contigo.");
      form.reset();
    } catch (error) {
      alert(`No fue posible enviar el correo automático: ${error.message}`);
    }
  });
});

const paymentParam = new URLSearchParams(window.location.search).get("payment");
if (paymentParam) {
  const messages = {
    success: "¡Pago recibido! Nuestro equipo revisará su solicitud y se comunicará pronto.",
    pending: "Su pago está pendiente de confirmación. Le notificaremos cuando se acredite.",
    failure: "No fue posible procesar el pago. Por favor intente nuevamente o contáctenos."
  };
  const text = messages[paymentParam];
  if (text) {
    const banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 24px;text-align:center;font-weight:800;font-size:1rem;";
    banner.style.background = paymentParam === "success" ? "#65c832" : paymentParam === "pending" ? "#b5893e" : "#c0392b";
    banner.style.color = paymentParam === "success" ? "#07100b" : "#ffffff";
    banner.textContent = text;
    document.body.prepend(banner);
    setTimeout(() => banner.remove(), 8000);
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  window.history.replaceState({}, "", url.toString());
}

if (document.body.classList.contains("manglar-homepage")) {
  const overlay = document.getElementById("mgOverlay");
  const mucubaModal = document.getElementById("mgMucubaModal");

  const openMucubaModal = () => {
    if (!mucubaModal) return;
    mucubaModal.removeAttribute("hidden");
    const closeBtn = document.getElementById("mgMucubaClose");
    if (closeBtn) closeBtn.focus();
  };

  const closeMucubaModal = () => {
    if (!mucubaModal) return;
    mucubaModal.setAttribute("hidden", "");
  };

  document.getElementById("mgMucubaClose")?.addEventListener("click", closeMucubaModal);
  document.getElementById("mgMucubaClose2")?.addEventListener("click", closeMucubaModal);

  mucubaModal?.addEventListener("click", (event) => {
    if (event.target === mucubaModal) closeMucubaModal();
  });

  document.addEventListener("keydown", (event) => {
    if (!mucubaModal || mucubaModal.hasAttribute("hidden")) return;
    if (event.key === "Escape") {
      closeMucubaModal();
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...mucubaModal.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  document.querySelector("[data-mucuba-invest]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const message = "Hola, me interesa invertir en el proyecto Mucuba Hotel & Glamping en Guatavita.";
    window.open(buildCustomWhatsAppUrl(message), "_blank", "noopener");
  });

  document.querySelector("[data-mucuba-info]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openMucubaModal();
  });

  const mucubaWhatsAppLink = mucubaModal?.querySelector("[data-whatsapp]");
  if (mucubaWhatsAppLink) {
    const message = "Hola, quiero conocer más sobre el proyecto Mucuba Hotel & Glamping en Guatavita.";
    mucubaWhatsAppLink.href = buildCustomWhatsAppUrl(message);
    mucubaWhatsAppLink.target = "_blank";
    mucubaWhatsAppLink.rel = "noopener";
  }

  const triggerCardTransition = (card) => {
    const route = card.dataset.route;
    const color = card.dataset.color || "#002B46";

    if (!route) {
      openMucubaModal();
      return;
    }

    if (!overlay) {
      window.location.href = route;
      return;
    }

    const rect = card.getBoundingClientRect();
    overlay.style.cssText = [
      "position:fixed",
      `top:${rect.top}px`,
      `left:${rect.left}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      `background:${color}`,
      "border-radius:18px",
      "opacity:1",
      "z-index:9000",
      "pointer-events:none",
      "transition:none"
    ].join(";");
    overlay.removeAttribute("hidden");

    overlay.getBoundingClientRect();

    overlay.style.transition = [
      "top 780ms cubic-bezier(0.76,0,0.24,1)",
      "left 780ms cubic-bezier(0.76,0,0.24,1)",
      "width 780ms cubic-bezier(0.76,0,0.24,1)",
      "height 780ms cubic-bezier(0.76,0,0.24,1)",
      "border-radius 780ms cubic-bezier(0.76,0,0.24,1)"
    ].join(",");
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.borderRadius = "0";

    setTimeout(() => {
      window.location.href = route;
    }, 820);
  };

  document.querySelectorAll(".mg-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-mucuba-invest]")) return;
      triggerCardTransition(card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.target.closest("[data-mucuba-invest]")) return;
        triggerCardTransition(card);
      }
    });
  });
}

if (document.body.dataset.hideWhatsappWidget !== "true") {
  const widget = document.createElement("div");
  const whatsappLabel = getWhatsAppLabel();
  widget.className = "whatsapp-widget";
  widget.innerHTML = `
    <div class="whatsapp-hint">¿Cómo podemos ayudarte?</div>
    <div class="whatsapp-panel" hidden>
      <div class="whatsapp-panel-header">
        ${whatsappIcon}
        <div>
          <strong>Inicia una conversación</strong>
          <span>¡Hola! Da clic sobre nuestra cuenta para chatear por WhatsApp</span>
        </div>
      </div>
      <div class="whatsapp-panel-body">
        <p>Nuestro equipo te responderá en unos momentos.</p>
        <a class="whatsapp-contact-card" href="${buildWhatsAppUrl()}" target="_blank" rel="noopener">
          <span class="whatsapp-avatar">${whatsappIcon}</span>
          <span>
            <strong>${whatsappLabel}</strong>
            <small>Línea de WhatsApp de ${whatsappLabel}</small>
          </span>
          <span class="whatsapp-mini">${whatsappIcon}</span>
        </a>
      </div>
    </div>
    <button class="floating-whatsapp" type="button" aria-label="Abrir chat de WhatsApp" aria-expanded="false">
      ${whatsappIcon}
    </button>
  `;

  const toggle = widget.querySelector(".floating-whatsapp");
  const panel = widget.querySelector(".whatsapp-panel");
  const hint = widget.querySelector(".whatsapp-hint");

  toggle.addEventListener("click", () => {
    const isOpen = panel.hasAttribute("hidden");
    panel.toggleAttribute("hidden", !isOpen);
    hint.toggleAttribute("hidden", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.innerHTML = isOpen ? "×" : whatsappIcon;
  });

  document.body.appendChild(widget);
}
