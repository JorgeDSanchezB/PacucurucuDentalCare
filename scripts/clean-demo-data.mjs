// Limpieza de datos demo tras el seed en la DB de producción (Neon).
// Los pacientes se borran en cascada: citas, notas clínicas, facturas y solicitudes.
// Se conserva TODO el contenido del sitio: admin, servicios, horarios,
// settings, flags, testimonios, FAQ y galería.
// Uso: DATABASE_URL='postgresql://…' node scripts/clean-demo-data.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const paciente = await db.patient.deleteMany({});
const mensaje = await db.contactMessage.deleteMany({});
const notif = await db.notificationLog.deleteMany({});

const [user, service, schedule, settings, testimonial, faq, gallery, patient] =
  await Promise.all([
    db.user.count(),
    db.service.count(),
    db.schedule.count(),
    db.clinicSetting.count(),
    db.testimonial.count(),
    db.faqItem.count(),
    db.galleryItem.count(),
    db.patient.count(),
  ]);

console.log("Demo eliminado:", paciente.count, "pacientes (cascada de citas/notas/facturas),", mensaje.count, "mensajes,", notif.count, "logs");
console.log("Contenido real en Neon:", JSON.stringify({
  user, service, schedule, settings, testimonial, faq, gallery, patient,
}));

await db.$disconnect();
