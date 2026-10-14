// Task 27 — Verificación E2E del login admin en la URL pública de Vercel
// Flujo completo: csrf → callback/credentials → session → API admin protegida
const BASE = "https://pacucurucu-dental-care.vercel.app";

// Credenciales desde .env local (las mismas que el doctor configuró en Vercel)
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const EMAIL = get("ADMIN_EMAIL");
const PASSWORD = get("ADMIN_PASSWORD");

const jar = {}; // cookie jar minimal {name: value}
const cookieHeader = () =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
}

async function step(name, fn) {
  try {
    const out = await fn();
    console.log(`✅ ${name}${out ? " → " + out : ""}`);
    return true;
  } catch (e) {
    console.log(`❌ ${name} → ${e.message}`);
    return false;
  }
}

// 1. CSRF
const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
storeCookies(csrfRes);
const { csrfToken } = await csrfRes.json();
if (!csrfToken) throw new Error("sin csrfToken");
console.log("✅ CSRF token obtenido");

// 2. Login con credenciales
const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookieHeader(),
  },
  body: new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    json: "true",
  }),
  redirect: "manual",
});
storeCookies(loginRes);
const loginStatus = loginRes.status;
const location = loginRes.headers.get("location") ?? loginRes.headers.get("x-auth-redirect") ?? "";
let loginBody = "";
try { loginBody = (await loginRes.text()).slice(0, 200); } catch {}
console.log(`ℹ️  Login respuesta: HTTP ${loginStatus}${location ? " | redirect: " + location : ""}${loginBody ? " | body: " + loginBody : ""}`);

// Con json=true y credenciales correctas, NextAuth devuelve 200 {ok:true} + cookie next-auth.session-token
const okBody = loginBody.includes('"ok"') || loginStatus === 200;

// 3. Sesión
const sessRes = await fetch(`${BASE}/api/auth/session`, {
  headers: { Cookie: cookieHeader() },
});
storeCookies(sessRes);
const sess = await sessRes.json();
const userName = sess?.user?.name ?? null;
if (!userName) throw new Error("sin sesión tras login");
console.log(`✅ Sesión activa: ${userName} (${sess.user.email})`);
console.log(`   Cookie de sesión presente: ${Object.keys(jar).some((k) => k.includes("session-token"))}`);

// 4. API admin protegida (stats)
const statsRes = await fetch(`${BASE}/api/admin/stats`, {
  headers: { Cookie: cookieHeader() },
});
const stats = await statsRes.json().catch(() => ({}));
console.log(`✅ /api/admin/stats: HTTP ${statsRes.status} → ${JSON.stringify(stats).slice(0, 220)}`);

// 5. Otra API admin (pacientes) para confirmar
const patRes = await fetch(`${BASE}/api/admin/patients?page=1&pageSize=5`, {
  headers: { Cookie: cookieHeader() },
});
const pat = await patRes.json().catch(() => ({}));
console.log(`✅ /api/admin/patients: HTTP ${patRes.status} → total=${pat?.total ?? "?"}`);

// 6. Sin cookie no debe dejar entrar (control negativo)
const noAuth = await fetch(`${BASE}/api/admin/stats`);
console.log(`✅ Sin sesión /api/admin/stats rechaza: HTTP ${noAuth.status} (esperado 401)`);
