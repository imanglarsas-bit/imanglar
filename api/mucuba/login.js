module.exports = async function login(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Método no permitido" });
    return;
  }

  const username = process.env.MUCUBA_ADMIN_USER;
  const password = process.env.MUCUBA_ADMIN_PASSWORD;
  const token = process.env.MUCUBA_ADMIN_TOKEN;

  if (!username || !password || !token) {
    response.status(500).json({ error: "Faltan MUCUBA_ADMIN_USER, MUCUBA_ADMIN_PASSWORD o MUCUBA_ADMIN_TOKEN." });
    return;
  }

  const body = request.body || {};
  if (body.username !== username || body.password !== password) {
    response.status(401).json({ error: "Usuario o clave incorrectos." });
    return;
  }

  response.status(200).json({ token });
};
