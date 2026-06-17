const crypto = require("crypto");

function getConfig() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY.");
  }
  return { region, bucket, accessKeyId, secretAccessKey };
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function signingKey(secretAccessKey, date, region) {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

async function s3Request(method, key, body = "", extraHeaders = {}) {
  const { region, bucket, accessKeyId, secretAccessKey } = getConfig();
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || "");
  const payloadHash = hash(payload);
  const path = `/${encodeKey(key)}`;
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders
  };
  const signedHeaderNames = Object.keys(headers).map((item) => item.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${String(headers[name] || headers[Object.keys(headers).find((keyName) => keyName.toLowerCase() === name)]).trim()}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");
  const signature = hmac(signingKey(secretAccessKey, dateStamp, region), stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${path}`, {
    method,
    headers: {
      ...headers,
      Authorization: authorization
    },
    body: method === "GET" ? undefined : payload
  });
  const responseBuffer = Buffer.from(await response.arrayBuffer());
  return { response, body: responseBuffer };
}

async function getJson(key, fallback) {
  const { response, body } = await s3Request("GET", key);
  if (response.status === 404 || response.status === 403 && !body.length) return fallback;
  if (!response.ok) throw new Error(`AWS S3 GET ${key} falló con estado ${response.status}.`);
  return JSON.parse(body.toString("utf8"));
}

async function putJson(key, value) {
  return s3Request("PUT", key, JSON.stringify(value, null, 2), {
    "content-type": "application/json; charset=utf-8"
  });
}

async function putObject(key, buffer, contentType) {
  return s3Request("PUT", key, buffer, {
    "content-type": contentType || "application/octet-stream"
  });
}

function publicUrlFor(key) {
  const { region, bucket } = getConfig();
  const base = process.env.AWS_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${base.replace(/\/$/, "")}/${encodeKey(key)}`;
}

function presignPutUrl(key, contentType, expires = 900) {
  const { region, bucket, accessKeyId, secretAccessKey } = getConfig();
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const path = `/${encodeKey(key)}`;
  const signedHeaders = "content-type;host";
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(query[name])}`)
    .join("&");
  const canonicalHeaders = `content-type:${contentType || "application/octet-stream"}\nhost:${host}\n`;
  const canonicalRequest = ["PUT", path, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");
  const signature = hmac(signingKey(secretAccessKey, dateStamp, region), stringToSign, "hex");
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function isAdmin(request) {
  const expected = process.env.MUCUBA_ADMIN_TOKEN;
  const header = request.headers.authorization || "";
  return Boolean(expected && header === `Bearer ${expected}`);
}

module.exports = {
  getJson,
  putJson,
  putObject,
  publicUrlFor,
  presignPutUrl,
  isAdmin
};
