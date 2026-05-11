const DATA_KEY = "site-data";
const PREVIOUS_DATA_KEY = "site-data:previous";
const PASSWORD_KEY = "admin-password";
const SUBMISSION_PREFIX = "submission:";
const NEWSLETTER_PREFIX = "newsletter:";
const RATE_PREFIX = "rate:";
const SESSION_COOKIE = "warrior_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_JSON_BYTES = 120000;

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

function securityHeaders(extra = {}) {
  return {
    ...SECURITY_HEADERS,
    ...extra
  };
}

function withSecurityHeaders(response, extra = {}) {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders(extra)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders(init.headers || {})
    }
  });
}

function text(data, init = {}) {
  return new Response(data, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders(init.headers || {})
    }
  });
}

async function readJson(request, maxBytes = MAX_JSON_BYTES) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length && length > maxBytes) throw new Error("Request body is too large.");
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("Request body is too large.");
  return JSON.parse(raw || "{}");
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
  if (!secret || secret.length < 32) return false;
  if (!token || !token.includes(".")) return false;
  try {
    const [body, signature] = token.split(".");
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, bytesFromBase64Url(signature), new TextEncoder().encode(body));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(body)));
    return payload.exp && payload.exp > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
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
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) {
    return json({ error: "Admin session secret is not configured." }, { status: 503 });
  }
  const limited = await rateLimit(request, env, "login", 12, 300);
  if (limited) return limited;

  const body = await readJson(request, 2000).catch(() => ({}));
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

  const body = await readJson(request, 4000).catch(() => ({}));
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

  const body = await readJson(request, 8000).catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  const business = String(body.business || "").trim().slice(0, 160);
  const email = String(body.email || "").trim().slice(0, 254);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const allowedTypes = new Set(["Booking", "Sponsorship", "Media", "Other"]);
  const type = allowedTypes.has(String(body.type || "")) ? String(body.type) : "Other";
  const message = String(body.message || "").trim();

  if (!name || !email || !message) return json({ error: "Name, email, and message are required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Use a valid email address." }, { status: 400 });
  if (message.length > 4000) return json({ error: "Message is too long." }, { status: 400 });

  const submission = {
    id: randomToken(12),
    createdAt: new Date().toISOString(),
    name,
    business,
    email,
    phone,
    type,
    message,
    reviewed: false
  };
  await env.SITE_KV.put(`${SUBMISSION_PREFIX}${Date.now()}:${submission.id}`, JSON.stringify(submission));
  return json({ ok: true });
}

async function handleNewsletter(request, env) {
  const limited = await rateLimit(request, env, "newsletter", 6, 600);
  if (limited) return limited;

  const body = await readJson(request, 2000).catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Use a valid email address." }, { status: 400 });

  const keyEmail = email.replace(/[^a-z0-9@._+-]/gi, "");
  const subscriber = {
    id: randomToken(12),
    createdAt: new Date().toISOString(),
    email,
    source: String(body.source || "homepage").slice(0, 80),
    active: true
  };
  await env.SITE_KV.put(`${NEWSLETTER_PREFIX}${keyEmail}`, JSON.stringify(subscriber));
  return json({ ok: true });
}

async function handleNewsletterList(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const list = await env.SITE_KV.list({ prefix: NEWSLETTER_PREFIX, limit: 1000 });
  const subscribers = await Promise.all(
    list.keys.map(async (key) => ({ ...((await env.SITE_KV.get(key.name, "json")) || {}), key: key.name }))
  );
  subscribers.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json({ subscribers });
}

async function handleNewsletterDelete(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await readJson(request, 2000).catch(() => ({}));
  const key = String(body.key || "");
  if (!key.startsWith(NEWSLETTER_PREFIX)) return json({ error: "Missing subscriber key." }, { status: 400 });
  await env.SITE_KV.delete(key);
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

  const body = await readJson(request, 2000).catch(() => ({}));
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

  const body = await readJson(request, 2000).catch(() => ({}));
  const key = String(body.key || "");
  if (!key.startsWith(SUBMISSION_PREFIX)) return json({ error: "Missing request key." }, { status: 400 });
  await env.SITE_KV.delete(key);
  return json({ ok: true });
}

async function handleSave(request, env) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const data = await readJson(request, 8000000).catch(() => null);
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

function hasValidAdminRequestOrigin(request) {
  if (request.method !== "POST") return true;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const requestOrigin = new URL(request.url).origin;
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  return !origin || origin === requestOrigin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const visitor = request.headers.get("cf-visitor") || "";
    if (url.protocol === "http:" || forwardedProto === "http" || visitor.includes('"scheme":"http"')) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/site-data") {
      return json(await getStoredData(env));
    }

    if (url.pathname === "/api/admin/status") {
      return json({ authenticated: await isAuthed(request, env) });
    }

    if (url.pathname.startsWith("/api/admin/") && !hasValidAdminRequestOrigin(request)) {
      return json({ error: "Invalid request origin." }, { status: 403 });
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
    if (url.pathname === "/api/admin/newsletter") return handleNewsletterList(request, env);
    if (url.pathname === "/api/admin/newsletter/delete" && request.method === "POST") return handleNewsletterDelete(request, env);
    if (url.pathname === "/api/contact" && request.method === "POST") return handleContact(request, env);
    if (url.pathname === "/api/newsletter" && request.method === "POST") return handleNewsletter(request, env);

    if (["/worker.js", "/wrangler.jsonc", "/design-explorations.html"].includes(url.pathname)) {
      return text("Not found", { status: 404 });
    }

    if (url.pathname === "/admin") {
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL("/admin.html", url), request)), {
        "x-robots-tag": "noindex"
      });
    }

    const pageRoutes = {
      "/": "/index.html",
      "/about": "/about.html",
      "/events": "/events.html",
      "/contact": "/contact.html",
      "/sponsors": "/sponsors.html",
      "/merch": "/merch.html"
    };
    const pageAsset = pageRoutes[url.pathname];
    if (pageAsset) {
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL(pageAsset, url), request)));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      const extra = url.pathname === "/admin" || url.pathname === "/admin.html" ? { "x-robots-tag": "noindex" } : {};
      return withSecurityHeaders(response, extra);
    }
    const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    return withSecurityHeaders(new Response(notFound.body, { status: 404, headers: notFound.headers }));
  }
};
