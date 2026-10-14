// Limpieza de datos de prueba: usa Prisma (respeta FK cascade).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // 1. Citas huérfanas (patientId sin paciente, producto de un DELETE sql directo)
  const orphanIds = (await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT a.id FROM Appointment a LEFT JOIN Patient p ON a.patientId = p.id WHERE p.id IS NULL`
  )).map((r) => r.id);
  if (orphanIds.length > 0) {
    await db.appointment.deleteMany({ where: { id: { in: orphanIds } } });
    console.log(`✓ Citas huérfanas eliminadas: ${orphanIds.length}`);
  } else {
    console.log("– Sin citas huérfanas");
  }

  // 2. Paciente de prueba del E2E en navegador (Verónica Pinos)
  const testPatient = await db.patient.findUnique({ where: { email: "veronica.pinos@example.com" } });
  if (testPatient) {
    await db.patient.delete({ where: { id: testPatient.id } });
    console.log("✓ Paciente de prueba eliminado (cascade)");
  } else {
    console.log("– Sin paciente de prueba");
  }

  // 3. Servicios de prueba residuales
  await db.service.deleteMany({ where: { slug: { startsWith: "prueba-crud" } } });
  console.log("✓ Servicios de prueba eliminados");

  // 4. Logs de notificación de pruebas
  await db.notificationLog.deleteMany({
    where: { toAddress: { in: ["veronica.pinos@example.com", "+593 98 445 6712"] } },
  });

  const counts = {
    patients: await db.patient.count(),
    appointments: await db.appointment.count(),
    services: await db.service.count(),
    invoices: await db.invoice.count(),
  };
  console.log("Estado final:", counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
