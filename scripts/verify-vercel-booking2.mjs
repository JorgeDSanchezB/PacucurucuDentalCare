// Task 27 (2ª ronda) — reserva → visible en panel con consulta correcta → limpieza
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = "https://pacucurucu-dental-care.vercel.app";
const TEST_EMAIL = "verificacion.e2e@pacurucu.test";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "");
process.env.DATABASE_URL = get("DATABASE_URL");
const EMAIL = get("ADMIN_EMAIL");
const PASSWORD = get("ADMIN_PASSWORD");

const jar = {};
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
}

// 1. Reservar
const { services } = await (await fetch(`${BASE}/api/public/services`)).json();
const servicio = services.find((s) => s.name === "Consulta y diagnóstico");
const FECHA = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const disp = await (await fetch(`${BASE}/api/public/availability?serviceId=${servicio.id}&date=${FECHA}`)).json();
const SLOT = disp.slots[2];
const bookRes = await fetch(`${BASE}/api/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    serviceIds: [servicio.id],
    patient: { firstName: "Prueba", lastName: "Verificación", email: TEST_EMAIL, phone: "0999999999" },
    date: FECHA, startTime: SLOT,
    notes: "2ª ronda de verificación E2E (se eliminará).",
  }),
});
const bookJson = await bookRes.json().catch(() => ({}));
console.log(`1️⃣  Reserva: HTTP ${bookRes.status} id=${bookJson.appointmentId?.slice(0, 12)}…`);
if (bookRes.status !== 201) process.exit(1);

// 2. Login admin y consulta CORRECTA (q=, items)
const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
storeCookies(csrfRes);
const { csrfToken } = await csrfRes.json();
await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
  body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
  redirect: "manual",
}).then(storeCookies);

const listRes = await fetch(`${BASE}/api/admin/appointments?q=Verificación&page=1&pageSize=10`, {
  headers: { Cookie: cookieHeader() },
});
const list = await listRes.json();
const found = list?.items?.find((a) => a.patient?.email === TEST_EMAIL);
console.log(`2️⃣  Panel admin (búsqueda "Verificación"): HTTP ${listRes.status}, total=${list?.total}`);
console.log(`3️⃣  Reserva visible en el panel: ${found ? "✅ SÍ" : "❌ NO"}`);
if (found) {
  console.log(`    → ${found.patient.firstName} ${found.patient.lastName} | ${found.date} ${found.startTime}–${found.endTime} | estado: ${found.status} | servicios: ${found.services.map((s) => s.name).join(", ")} | fuente: ${found.source}`);
}

// 3. Confirmar cita desde el panel (transición PENDING → CONFIRMED)
let confirmada = null;
if (found) {
  const confRes = await fetch(`${BASE}/api/admin/appointments/${found.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ action: "confirm" }),
  });
  confirmada = await confRes.json().catch(() => ({}));
  console.log(`4️⃣  Confirmar cita desde panel: HTTP ${confRes.status} → estado: ${confirmada?.appointment?.status ?? confirmada?.status ?? JSON.stringify(confirmada).slice(0, 80)}`);
}

// 4. Limpieza total
const db = new PrismaClient();
const borrados = await db.patient.deleteMany({ where: { email: TEST_EMAIL } });
const logs = await db.notificationLog.deleteMany({ where: { createdAt: { gte: new Date(Date.now() - 3600000) } } });
const pacientes = await db.patient.count();
const citas = await db.appointment.count();
console.log(`🧹 Limpieza: ${borrados.count} paciente(s), ${logs.count} logs → producción queda con ${pacientes} pacientes y ${citas} citas`);
await db.$disconnect();
console.log("DONE");
