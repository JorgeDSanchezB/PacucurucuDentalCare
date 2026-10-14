// E2E Task 20 — borrado de pacientes, facturas y mensajes (HTTP real + DB real).
// Crea datos de prueba claramente marcados, los borra vía API con sesión de
// admin real y verifica en la base de datos que todo quedó consistente.
// NO toca datos reales (Maria Pruebas, Jorge Sánchez, etc.).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";
// Credenciales desde el entorno (.env local, nunca versionado). Sin ellas el E2E no corre.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? loadEnv("ADMIN_EMAIL");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? loadEnv("ADMIN_PASSWORD");

function loadEnv(key: string): string | undefined {
  try {
    const env = require("node:fs").readFileSync(".env", "utf8");
    const line = env.split("\n").find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Login real contra NextAuth (captcha + callback credentials) ─────────────
async function login(): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = csrfRes.headers.get("set-cookie")?.split(";")[0] ?? "";

  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    callbackUrl: `${BASE}/admin`,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: body.toString(),
  });
  const cookies = loginRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = cookies
    .find((c) => c.includes("authjs.session-token") || c.includes("next-auth.session-token"))
    ?.split(";")[0];
  if (!sessionCookie) throw new Error(`Login falló (status ${loginRes.status}): no hay cookie de sesión`);
  return sessionCookie;
}

async function api(
  path: string,
  method: string,
  cookie: string | null
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, json };
}

async function main() {
  // ── 0. Limpiar restos de ejecuciones previas (idempotente) ───────────────
  for (const email of ["e2e-task20@prueba.local", "ui-task20@prueba.local"]) {
    const old = await db.patient.findUnique({ where: { email } });
    if (old) {
      await db.bookingRequest.deleteMany({ where: { appointment: { patientId: old.id } } });
      await db.appointmentService.deleteMany({ where: { appointment: { patientId: old.id } } });
      await db.clinicalNote.deleteMany({ where: { patientId: old.id } });
      await db.invoice.deleteMany({ where: { patientId: old.id } });
      await db.appointment.deleteMany({ where: { patientId: old.id } });
      await db.patient.delete({ where: { id: old.id } });
      console.log(`Restos previos eliminados (${email}).`);
    }
  }
  await db.contactMessage.deleteMany({ where: { email: { in: ["e2e-task20@prueba.local", "ui-task20@prueba.local"] } } });

  // ── 1. Crear dataset de prueba ───────────────────────────────────────────
  const maxInv = await db.invoice.aggregate({ _max: { number: true } });
  const patient = await db.patient.create({
    data: {
      firstName: "Temporal",
      lastName: "BorradoE2E",
      email: "e2e-task20@prueba.local",
      phone: "0990000000",
    },
  });
  const appointment = await db.appointment.create({
    data: {
      patientId: patient.id,
      date: tomorrow(),
      startTime: "10:00",
      endTime: "11:00",
      status: "COMPLETED",
      source: "ADMIN",
      notes: "dato de prueba E2E task20",
      services: {
        create: [{ name: "Limpieza (prueba)", price: 35, duration: 60 }],
      },
    },
  });
  await db.bookingRequest.create({ data: { appointmentId: appointment.id } });
  await db.clinicalNote.create({
    data: {
      patientId: patient.id,
      appointmentId: appointment.id,
      date: tomorrow(),
      treatment: "Revisión de prueba E2E",
    },
  });
  const invoice = await db.invoice.create({
    data: {
      number: (maxInv._max.number ?? 0) + 1,
      appointmentId: appointment.id,
      patientId: patient.id,
      date: tomorrow(),
      itemsJson: JSON.stringify([{ name: "Limpieza (prueba)", price: 35, quantity: 1 }]),
      subtotal: 35,
      total: 35,
    },
  });
  const message = await db.contactMessage.create({
    data: {
      name: "Mensaje E2E",
      email: "e2e-task20@prueba.local",
      message: "Mensaje de prueba para el borrado (task 20).",
    },
  });
  console.log("Dataset de prueba creado (paciente, cita+servicio+solicitud, nota, factura, mensaje).");

  const cookie = await login();
  ok("Login admin real", true);

  // ── 2. Seguridad: sin sesión → 401 ──────────────────────────────────────
  const noAuth = await api(`/api/admin/patients/${patient.id}`, "DELETE", null);
  ok("DELETE paciente sin sesión → 401", noAuth.status === 401, `status=${noAuth.status}`);

  // ── 3. Borrar FACTURA ────────────────────────────────────────────────────
  const invRes = await api(`/api/admin/invoices/${invoice.id}`, "DELETE", cookie);
  ok("DELETE /api/admin/invoices/:id → 200", invRes.status === 200, JSON.stringify(invRes.json));
  ok("  respuesta devuelve el número", invRes.json?.number === invoice.number);
  const invGone = await db.invoice.findUnique({ where: { id: invoice.id } });
  ok("  factura desapareció de la DB", invGone === null);
  const apptStill = await db.appointment.findUnique({ where: { id: appointment.id } });
  ok("  la cita asociada sigue intacta", apptStill !== null);
  const badInv = await api("/api/admin/invoices/no-existe", "DELETE", cookie);
  ok("DELETE factura inexistente → 404", badInv.status === 404, `status=${badInv.status}`);

  // La cita vuelve a ser facturable (sin factura asociada)
  ok("  la cita queda re-facturable", apptStill !== null && !(await db.invoice.findFirst({ where: { appointmentId: appointment.id } })));

  // ── 4. Borrar MENSAJE ────────────────────────────────────────────────────
  const msgRes = await api(`/api/admin/contact-messages/${message.id}`, "DELETE", cookie);
  ok("DELETE /api/admin/contact-messages/:id → 200", msgRes.status === 200);
  const msgGone = await db.contactMessage.findUnique({ where: { id: message.id } });
  ok("  mensaje desapareció de la DB", msgGone === null);
  const badMsg = await api("/api/admin/contact-messages/no-existe", "DELETE", cookie);
  ok("DELETE mensaje inexistente → 404", badMsg.status === 404, `status=${badMsg.status}`);

  // ── 5. Borrar PACIENTE (con cita, nota y solicitud; factura ya borrada) ──
  const patRes = await api(`/api/admin/patients/${patient.id}`, "DELETE", cookie);
  ok("DELETE /api/admin/patients/:id → 200", patRes.status === 200, JSON.stringify(patRes.json));
  ok(
    "  respuesta informa los borrados en cascada",
    patRes.json?.deleted?.appointments === 1 && patRes.json?.deleted?.clinicalNotes === 1 && patRes.json?.deleted?.invoices === 0,
    JSON.stringify(patRes.json?.deleted)
  );
  const pGone = await db.patient.findUnique({ where: { id: patient.id } });
  const aGone = await db.appointment.findUnique({ where: { id: appointment.id } });
  const svcGone = await db.appointmentService.findFirst({ where: { appointmentId: appointment.id } });
  const reqGone = await db.bookingRequest.findFirst({ where: { appointmentId: appointment.id } });
  const noteGone = await db.clinicalNote.findFirst({ where: { patientId: patient.id } });
  ok(
    "  paciente+cita+servicio+solicitud+nota desaparecieron",
    pGone === null && aGone === null && svcGone === null && reqGone === null && noteGone === null
  );
  const badPat = await api(`/api/admin/patients/${patient.id}`, "DELETE", cookie);
  ok("DELETE paciente ya borrado → 404", badPat.status === 404, `status=${badPat.status}`);

  // ── 6. Dataset para la prueba visual en navegador (UI) ───────────────────
  const uiPatient = await db.patient.create({
    data: {
      firstName: "Temporal",
      lastName: "UiBorrado",
      email: "ui-task20@prueba.local",
      phone: "0991111111",
    },
  });
  const uiAppt = await db.appointment.create({
    data: {
      patientId: uiPatient.id,
      date: tomorrow(),
      startTime: "11:00",
      endTime: "12:00",
      status: "COMPLETED",
      source: "ADMIN",
      services: { create: [{ name: "Revisión (prueba UI)", price: 25, duration: 60 }] },
    },
  });
  await db.invoice.create({
    data: {
      number: (maxInv._max.number ?? 0) + 2,
      appointmentId: uiAppt.id,
      patientId: uiPatient.id,
      date: tomorrow(),
      itemsJson: JSON.stringify([{ name: "Revisión (prueba UI)", price: 25, quantity: 1 }]),
      subtotal: 25,
      total: 25,
    },
  });
  await db.contactMessage.create({
    data: {
      name: "Mensaje UI E2E",
      email: "ui-task20@prueba.local",
      message: "Mensaje de prueba UI para el borrado (task 20).",
    },
  });
  console.log(`\nDataset UI listo para navegador:\n  paciente: ${uiPatient.id} (Temporal UiBorrado)\n  cita: ${uiAppt.id}\nBusca 'UiBorrado' en el panel y 'Mensaje UI E2E' en Mensajes.`);

  console.log(`\n${failures === 0 ? "TODO OK" : `HUBO ${failures} FALLOS`}`);
}

main()
  .catch((e) => { console.error("ERROR E2E:", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
