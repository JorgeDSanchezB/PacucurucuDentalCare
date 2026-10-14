// Limpia los datos de prueba creados por la verificación E2E del flujo de
// reserva (Task 17): paciente "Test Flujo", su cita y registros derivados.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const patients = await db.patient.findMany({ where: { firstName: "Test", lastName: "Flujo" } });
  for (const p of patients) {
    const appts = await db.appointment.findMany({
      where: { patientId: p.id },
      include: { services: true },
    });
    for (const a of appts) {
      await db.appointmentService.deleteMany({ where: { appointmentId: a.id } });
      await db.bookingRequest.deleteMany({ where: { appointmentId: a.id } });
      await db.appointment.delete({ where: { id: a.id } });
    }
    await db.clinicalNote.deleteMany({ where: { patientId: p.id } });
    await db.patient.delete({ where: { id: p.id } });
    console.log(`Eliminado paciente de prueba ${p.firstName} ${p.lastName} (${appts.length} citas)`);
  }
  if (patients.length === 0) console.log("Sin datos de prueba que limpiar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
