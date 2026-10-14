// Verificación de que el login sigue funcionando tras el reinicio del dev server
// (en dev.log reaparecieron JWT_SESSION_ERROR — probablemente cookies viejas del
// navegador headless, hay que confirmar que el flujo de autenticación está sano).
const BASE = "http://localhost:3000";
// Credenciales del admin desde el entorno o el .env local (nunca versionado).
import { readFileSync } from "node:fs";
function loadEnv(key) {
  try {
    const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}
const creds = {
  email: process.env.ADMIN_EMAIL ?? loadEnv("ADMIN_EMAIL"),
  password: process.env.ADMIN_PASSWORD ?? loadEnv("ADMIN_PASSWORD"),
};
if (!creds.email || !creds.password) {
  console.error("Faltan ADMIN_EMAIL/ADMIN_PASSWORD en el entorno o .env — abortando.");
  process.exit(1);
}

async function main() {
  console.log("Credenciales admin reales:", creds.email);

  // 2. Login programático con cookie jar manual
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: "include" });
  const csrf = (await csrfRes.json()).csrfToken;
  const setCookie = csrfRes.headers.getSetCookie?.() ?? [csrfRes.headers.get("set-cookie")].filter(Boolean);
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader },
    body: new URLSearchParams({ csrfToken: csrf, email: creds.email, password: creds.password, json: "true" }),
    redirect: "manual",
  });
  const loginCookies = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
  console.log("Login HTTP:", loginRes.status);
  const allCookies = [...setCookie.map((c) => c.split(";")[0]), ...loginCookies].join("; ");

  // 3. Sesión
  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: allCookies } });
  const session = await sessionRes.json();
  console.log("Sesión:", sessionRes.status, session ? `OK (${session.user?.email ?? "sin email"})` : "VACÍA");

  // 4. API admin protegida
  const apiRes = await fetch(`${BASE}/api/admin/patients?take=1`, { headers: { Cookie: allCookies } });
  console.log("API admin /patients:", apiRes.status);

  const ok = sessionRes.status === 200 && session && apiRes.status === 200;
  console.log(ok ? "\nAUTENTICACIÓN SANA ✓" : "\nAUTENTICACIÓN ROTA ✗");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
