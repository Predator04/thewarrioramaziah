const DATA_KEY = "site-data";
const PREVIOUS_DATA_KEY = "site-data:previous";
const PASSWORD_KEY = "admin-password";
const SUBMISSION_PREFIX = "submission:";
const RATE_PREFIX = "rate:";
const SESSION_COOKIE = "warrior_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

function text(data, init = {}) {
  return new Response(data, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), part.slice(index + 1)];
      })
  );
}

function base64Url(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function bytesFromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

async function signSession(payload, secret) {
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64Url(signature)}`;
}

async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return false;
  const [body, signature] = token.split(".");
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, bytesFromBase64Url(signature), new TextEncoder().encode(body));
  if (!valid) return false;
  const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(body)));
  return payload.exp && payload.exp > Math.floor(Date.now() / 1000);
}

async function sha256(value) {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomToken(bytes = 18) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

async function passwordHash(password, salt) {
  return sha256(`${salt}:${password}`);
}

async function getPasswordRecord(env) {
  return env.SITE_KV.get(PASSWORD_KEY, "json");
}

async function passwordMatches(password, env) {
  const record = await getPasswordRecord(env);
  if (record?.salt && record?.hash) {
    return (await passwordHash(password, record.salt)) === record.hash;
  }
  return password === env.ADMIN_PASSWORD;
}

async function isAuthed(request, env) {
  const cookies = parseCookies(request);
  return verifySession(cookies[SESSION_COOKIE], env.ADMIN_SESSION_SECRET);
}

async function requireAuth(request, env) {
  if (await isAuthed(request, env)) return null;
  return json({ error: "Unauthorized" }, { status: 401 });
}

async function getStoredData(env) {
  return (await env.SITE_KV.get(DATA_KEY, "json")) || null;
}

function getClientKey(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
}

async function rateLimit(request, env, bucket, limit, windowSeconds) {
  const key = `${RATE_PREFIX}${bucket}:${getClientKey(request)}`;
  const record = (await env.SITE_KV.get(key, "json")) || { count: 0 };
  const count = Number(record.count || 0) + 1;
  if (count > limit) {
    return json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  await env.SITE_KV.put(key, JSON.stringify({ count, updatedAt: new Date().toISOString() }), {
    expirationTtl: windowSeconds
  });
  return null;
}

async function handleLogin(request, env) {
  const limited = await rateLimit(request, env, "login", 12, 300);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  if (!body.password || !(await passwordMatches(body.password, env))) {
    return json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signSession(
    {
      sub: "admin",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    },
    env.ADMIN_SESSION_SECRET
  );

  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
      }
    }
  );
}

async function handleChangePassword(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  if (password.length < 10) return json({ error: "Use at least 10 characters." }, { status: 400 });
  const salt = randomToken();
  await env.SITE_KV.put(PASSWORD_KEY, JSON.stringify({ salt, hash: await passwordHash(password, salt), changedAt: new Date().toISOString() }));
  return json({ ok: true });
}

function validateData(data) {
  if (!data || typeof data !== "object") return "Missing site data.";
  if (!Array.isArray(data.products) || !Array.isArray(data.events) || !Array.isArray(data.stats)) {
    return "Site data must include products, events, and stats lists.";
  }
  const serialized = JSON.stringify(data);
  if (serialized.length > 8000000) return "Site data is too large. Compress photos before uploading.";
  return null;
}

async function handleUpload(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "Missing file." }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return json({ error: "Only JPG, PNG, or WebP images are allowed." }, { status: 400 });
  }
  if (file.size > 1500000) {
    return json({ error: "Image is too large. Keep uploads under 1.5 MB for now." }, { status: 400 });
  }
  const buffer = await file.arrayBuffer();
  return json({
    src: `data:${file.type};base64,${base64Url(buffer).replaceAll("-", "+").replaceAll("_", "/")}`
  });
}

async function handleContact(request, env) {
  const limited = await rateLimit(request, env, "contact", 8, 600);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const type = String(body.type || "Other").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !message) return json({ error: "Name, email, and message are required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Use a valid email address." }, { status: 400 });
  if (message.length > 4000) return json({ error: "Message is too long." }, { status: 400 });

  const submission = {
    id: randomToken(12),
    createdAt: new Date().toISOString(),
    name,
    email,
    type,
    message,
    reviewed: false
  };
  await env.SITE_KV.put(`${SUBMISSION_PREFIX}${Date.now()}:${submission.id}`, JSON.stringify(submission));
  return json({ ok: true });
}

async function handleSubmissions(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const list = await env.SITE_KV.list({ prefix: SUBMISSION_PREFIX, limit: 25 });
  const submissions = await Promise.all(
    list.keys.map(async (key) => ({ ...((await env.SITE_KV.get(key.name, "json")) || {}), key: key.name }))
  );
  submissions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json({ submissions });
}

async function handleSubmissionUpdate(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  if (!key.startsWith(SUBMISSION_PREFIX)) return json({ error: "Missing request key." }, { status: 400 });

  const submission = await env.SITE_KV.get(key, "json");
  if (!submission) return json({ error: "Request not found." }, { status: 404 });

  submission.reviewed = Boolean(body.reviewed);
  submission.reviewedAt = submission.reviewed ? new Date().toISOString() : "";
  await env.SITE_KV.put(key, JSON.stringify(submission));
  return json({ ok: true });
}

async function handleSubmissionDelete(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  if (!key.startsWith(SUBMISSION_PREFIX)) return json({ error: "Missing request key." }, { status: 400 });
  await env.SITE_KV.delete(key);
  return json({ ok: true });
}

async function handleSave(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const data = await request.json().catch(() => null);
  const validationError = validateData(data);
  if (validationError) return json({ error: validationError }, { status: 400 });

  data.meta = {
    ...(data.meta || {}),
    lastSavedAt: new Date().toISOString()
  };
  const current = await env.SITE_KV.get(DATA_KEY);
  if (current) {
    await env.SITE_KV.put(PREVIOUS_DATA_KEY, current);
  }
  await env.SITE_KV.put(DATA_KEY, JSON.stringify(data));
  return json({ ok: true, lastSavedAt: data.meta.lastSavedAt });
}

async function handleRestorePrevious(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const previous = await env.SITE_KV.get(PREVIOUS_DATA_KEY, "json");
  if (!previous) return json({ error: "No previous saved version found yet." }, { status: 404 });

  previous.meta = {
    ...(previous.meta || {}),
    lastSavedAt: new Date().toISOString(),
    restoredAt: new Date().toISOString()
  };
  const current = await env.SITE_KV.get(DATA_KEY);
  if (current) {
    await env.SITE_KV.put(PREVIOUS_DATA_KEY, current);
  }
  await env.SITE_KV.put(DATA_KEY, JSON.stringify(previous));
  return json({ ok: true, data: previous, lastSavedAt: previous.meta.lastSavedAt });
}

async function handleLogout() {
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
      }
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/site-data") {
      return json(await getStoredData(env));
    }

    if (url.pathname === "/api/admin/status") {
      return json({ authenticated: await isAuthed(request, env) });
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") return handleLogin(request, env);
    if (url.pathname === "/api/admin/logout" && request.method === "POST") return handleLogout();
    if (url.pathname === "/api/admin/save" && request.method === "POST") return handleSave(request, env);
    if (url.pathname === "/api/admin/restore-previous" && request.method === "POST") return handleRestorePrevious(request, env);
    if (url.pathname === "/api/admin/upload" && request.method === "POST") return handleUpload(request, env);
    if (url.pathname === "/api/admin/change-password" && request.method === "POST") return handleChangePassword(request, env);
    if (url.pathname === "/api/admin/submissions") return handleSubmissions(request, env);
    if (url.pathname === "/api/admin/submissions/update" && request.method === "POST") return handleSubmissionUpdate(request, env);
    if (url.pathname === "/api/admin/submissions/delete" && request.method === "POST") return handleSubmissionDelete(request, env);
    if (url.pathname === "/api/contact" && request.method === "POST") return handleContact(request, env);

    if (url.pathname === "/admin") {
      return env.ASSETS.fetch(new Request(new URL("/admin.html", url), request));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  }
};
