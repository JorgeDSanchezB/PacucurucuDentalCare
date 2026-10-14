// Task 27 — E2E: reserva de prueba en la web pública de Vercel + verificación + limpieza
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = "https://pacucurucu-dental-care.vercel.app";
const TEST_EMAIL = "verificacion.e2e@pacurucu.test";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const EMAIL = get("ADMIN_EMAIL");
const PASSWORD = get("ADMIN_PASSWORD");

const jar = {};
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

// ── 1. Elegir servicio y horario ──
const { services } = await (await fetch(`${BASE}/api/public/services`)).json();
const servicio = services.find((s) => s.name === "Consulta y diagnóstico");
console.log(`1️⃣  Servicio: ${servicio.name} (${servicio.duration} min, $${servicio.price})`);

const FECHA = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const disp1 = await (
  await fetch(`${BASE}/api/public/availability?serviceId=${servicio.id}&date=${FECHA}`)
).json();
if (!disp1.slots?.length) throw new Error("sin slots");
const SLOT = disp1.slots[4] ?? disp1.slots[0];
console.log(`2️⃣  Fecha ${FECHA}, hora ${SLOT} (${disp1.slots.length} slots libres antes de reservar)`);

// ── 2. Crear la reserva (como paciente real) ──
const bookingBody = {
  serviceIds: [servicio.id],
  patient: {
    firstName: "Prueba",
    lastName: "Verificación",
    email: TEST_EMAIL,
    phone: "0999999999",
  },
  date: FECHA,
  startTime: SLOT,
  notes: "Reserva automática de verificación E2E (se eliminará).",
};
const bookRes = await fetch(`${BASE}/api/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(bookingBody),
});
const bookJson = await bookRes.json().catch(() => ({}));
console.log(`3️⃣  Reserva creada: HTTP ${bookRes.status} → ${JSON.stringify(bookJson).slice(0, 260)}`);
if (bookRes.status !== 201) process.exit(1);

// ── 3. El slot reservado ya no debe estar disponible ──
const disp2 = await (
  await fetch(`${BASE}/api/public/availability?serviceId=${servicio.id}&date=${FECHA}`)
).json();
const sigueLibre = disp2.slots?.includes(SLOT);
console.log(`4️⃣  Slot ${SLOT} tras reservar: ${sigueLibre ? "❌ SIGUE LIBRE (error)" : "✅ ya no disponible (anti solapes OK)"}`);

// ── 4. Intentar reservar el MISMO slot otra vez → debe fallar ──
const dupRes = await fetch(`${BASE}/api/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...bookingBody, patient: { ...bookingBody.patient, email: "otro@pacurucu.test", firstName: "Otro", lastName: "Paciente" } }),
});
const dupJson = await dupRes.json().catch(() => ({}));
console.log(`5️⃣  Doble reserva mismo slot: HTTP ${dupRes.status} → ${dupJson?.error ?? ""} ${dupRes.status === 409 ? "✅ rechazada" : "⚠️ revisar"}`);

// ── 5. La reserva debe verse en el panel admin ──
const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
storeCookies(csrfRes);
const { csrfToken } = await csrfRes.json();
await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
  body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
  redirect: "manual",
}).then(storeCookies);
const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader() } })).json();
console.log(`6️⃣  Admin conectado: ${sess?.user?.name ?? "❌ sin sesión"}`);

const appts = await (
  await fetch(`${BASE}/api/admin/appointments?search=Prueba&page=1&pageSize=10`, { headers: { Cookie: cookieHeader() } })
).json();
const encontrada = appts?.appointments?.some(
  (a) => a.patientEmail === TEST_EMAIL || a.patient?.email === TEST_EMAIL
);
console.log(`7️⃣  Reserva visible en panel admin: ${encontrada ? "✅ sí" : "❌ no"}`);
if (appts?.appointments?.length) {
  const a = appts.appointments.find((x) => x.patientEmail === TEST_EMAIL || x.patient?.email === TEST_EMAIL);
  if (a) console.log(`    → ${a.patientName ?? a.patient?.name} | ${a.date} ${a.startTime} | estado: ${a.status}`);
}

// ── 6. LIMPIEZA: borrar datos de prueba (Neon compartido con el sandbox) ──
const db = new PrismaClient();
const borrados = await db.patient.deleteMany({ where: { email: { in: [TEST_EMAIL, "otro@pacurucu.test"] } } });
const logs = await db.notificationLog.deleteMany({ where: { channel: "SIMULATED", createdAt: { gte: new Date(Date.now() - 3600000) } } });
const restantes = await db.appointment.count();
console.log(`🧹 Limpieza: ${borrados.count} pacientes de prueba eliminados (cascada de citas), ${logs.count} logs de notificación. Citas restantes en producción: ${restantes}`);
await db.$disconnect();
console.log("DONE");
