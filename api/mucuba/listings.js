const { getJson, putJson, isAdmin } = require("../_lib/s3");

const LISTINGS_KEY = "mucuba/listings.json";
const emptyData = { listings: [], heroVideoUrl: "" };

module.exports = async function listings(request, response) {
  try {
    if (request.method === "GET") {
      const data = await getJson(LISTINGS_KEY, emptyData).catch(() => emptyData);
      const admin = isAdmin(request);
      response.status(200).json({
        ...data,
        listings: admin ? data.listings : (data.listings || []).filter((item) => item.status !== "hidden")
      });
      return;
    }

    if (request.method === "PUT") {
      if (!isAdmin(request)) {
        response.status(401).json({ error: "No autorizado." });
        return;
      }
      const data = request.body || {};
      await putJson(LISTINGS_KEY, {
        listings: Array.isArray(data.listings) ? data.listings : [],
        heroVideoUrl: data.heroVideoUrl || ""
      });
      response.status(200).json({ ok: true });
      return;
    }

    response.setHeader("Allow", "GET, PUT");
    response.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    response.status(500).json({ error: error.message || "Error conectando AWS." });
  }
};
