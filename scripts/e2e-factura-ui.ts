// Dataset mínimo para la prueba UI de borrado de factura (task 20)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // limpiar restos previos
  const old = await db.patient.findUnique({ where: { email: "fact-ui@prueba.local" } });
  if (old) {
    await db.invoice.deleteMany({ where: { patientId: old.id } });
    await db.appointmentService.deleteMany({ where: { appointment: { patientId: old.id } } });
    await db.appointment.deleteMany({ where: { patientId: old.id } });
    await db.patient.delete({ where: { id: old.id } });
  }

  const patient = await db.patient.create({
    data: { firstName: "Temporal", lastName: "FacturaUi", email: "fact-ui@prueba.local", phone: "0992222222" },
  });
  const appt = await db.appointment.create({
    data: {
      patientId: patient.id,
      date: "2026-10-15",
      startTime: "09:00",
      endTime: "10:00",
      status: "COMPLETED",
      source: "ADMIN",
      services: { create: [{ name: "Puli (prueba UI)", price: 30, duration: 60 }] },
    },
  });
  const max = await db.invoice.aggregate({ _max: { number: true } });
  const inv = await db.invoice.create({
    data: {
      number: (max._max.number ?? 0) + 1,
      appointmentId: appt.id,
      patientId: patient.id,
      date: "2026-10-15",
      itemsJson: JSON.stringify([{ name: "Puli (prueba UI)", price: 30, quantity: 1 }]),
      subtotal: 30,
      total: 30,
    },
  });
  console.log(`Factura UI creada: FAC-${String(inv.number).padStart(4, "0")} (id ${inv.id}) del paciente Temporal FacturaUi`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
