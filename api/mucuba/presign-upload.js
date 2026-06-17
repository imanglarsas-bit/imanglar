const path = require("path");
const { presignPutUrl, publicUrlFor, isAdmin } = require("../_lib/s3");

function safeName(name) {
  const parsed = path.parse(name || "archivo");
  const base = parsed.name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "archivo";
  const ext = (parsed.ext || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `${base}${ext}`;
}

module.exports = async function presignUpload(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({ error: "Método no permitido" });
      return;
    }
    if (!isAdmin(request)) {
      response.status(401).json({ error: "No autorizado." });
      return;
    }

    const { fileName, contentType, folder = "uploads" } = request.body || {};
    if (!fileName) {
      response.status(400).json({ error: "Falta nombre del archivo." });
      return;
    }

    const cleanFolder = String(folder).replace(/[^a-z0-9/-]/gi, "").replace(/^\/+|\/+$/g, "") || "uploads";
    const key = `mucuba/${cleanFolder}/${Date.now()}-${safeName(fileName)}`;
    const type = contentType || "application/octet-stream";

    response.status(200).json({
      key,
      uploadUrl: presignPutUrl(key, type),
      url: publicUrlFor(key),
      contentType: type
    });
  } catch (error) {
    response.status(500).json({ error: error.message || "No fue posible preparar la carga a AWS." });
  }
};
