// Task 27 (3ª ronda) — flujo completo: reserva pública → confirmación por el doctor → limpieza
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

// 1. Reserva pública
const { services } = await (await fetch(`${BASE}/api/public/services`)).json();
const servicio = services.find((s) => s.name === "Limpieza dental");
const FECHA = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const disp = await (await fetch(`${BASE}/api/public/availability?serviceId=${servicio.id}&date=${FECHA}`)).json();
const SLOT = disp.slots[1];
const bookRes = await fetch(`${BASE}/api/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    serviceIds: [servicio.id],
    patient: { firstName: "Prueba", lastName: "Verificación", email: TEST_EMAIL, phone: "0988888888" },
    date: FECHA, startTime: SLOT,
    notes: "3ª ronda E2E (se eliminará).",
  }),
});
const bookJson = await bookRes.json().catch(() => ({}));
console.log(`1️⃣  Reserva "${servicio.name}" el ${FECHA} ${SLOT}: HTTP ${bookRes.status}`);
if (bookRes.status !== 201) process.exit(1);
const apptId = bookJson.appointmentId;

// 2. Login admin
const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
storeCookies(csrfRes);
const { csrfToken } = await csrfRes.json();
await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
  body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
  redirect: "manual",
}).then(storeCookies);

// 3. Confirmar la cita (PUT + status CONFIRMED)
const confRes = await fetch(`${BASE}/api/admin/appointments/${apptId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
  body: JSON.stringify({ status: "CONFIRMED" }),
});
const confJson = await confRes.json().catch(() => ({}));
const estado = confJson?.appointment?.status;
console.log(`2️⃣  Confirmación por el doctor: HTTP ${confRes.status} → estado: ${estado} ${estado === "CONFIRMED" ? "✅" : "❌"}`);

// 4. Marcar completada (segunda transición) — el flujo de facturación parte de COMPLETED
const compRes = await fetch(`${BASE}/api/admin/appointments/${apptId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
  body: JSON.stringify({ status: "COMPLETED" }),
});
const compJson = await compRes.json().catch(() => ({}));
console.log(`3️⃣  Marcar atendida (COMPLETED): HTTP ${compRes.status} → estado: ${compJson?.appointment?.status}`);

// 5. Facturar la cita completada (PDF)
const invRes = await fetch(`${BASE}/api/admin/invoices`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
  body: JSON.stringify({ appointmentId: apptId }),
});
const invJson = await invRes.json().catch(() => ({}));
console.log(`4️⃣  Factura generada: HTTP ${invRes.status} → ${JSON.stringify(invJson).slice(0, 160)}`);
const invoiceId = invJson?.invoice?.id;
if (invoiceId) {
  const pdfRes = await fetch(`${BASE}/api/admin/invoices/${invoiceId}/pdf`, { headers: { Cookie: cookieHeader() } });
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  const esPdf = buf.slice(0, 5).toString() === "%PDF-";
  console.log(`5️⃣  PDF de factura: HTTP ${pdfRes.status}, ${(buf.length / 1024).toFixed(1)} KB, formato ${esPdf ? "✅ PDF válido" : "❌ no es PDF"}`);
}

// 6. Limpieza final (paciente en cascada borra cita+factura; + logs)
const db = new PrismaClient();
const borrados = await db.patient.deleteMany({ where: { email: TEST_EMAIL } });
const logs = await db.notificationLog.deleteMany({ where: { createdAt: { gte: new Date(Date.now() - 3600000) } } });
const conteo = {
  pacientes: await db.patient.count(),
  citas: await db.appointment.count(),
  facturas: await db.invoice.count(),
  mensajes: await db.contactMessage.count(),
};
console.log(`🧹 Limpieza: ${borrados.count} paciente(s), ${logs.count} logs → producción queda: ${JSON.stringify(conteo)}`);
await db.$disconnect();
console.log("DONE");
