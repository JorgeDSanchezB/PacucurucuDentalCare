// Corrección de género en la BD viva: doctora → doctor.
// El odontólogo ya editó nombre/título/biografía desde el panel; este script
// corrige lo que quedó en femenino fuera de su alcance.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1) Credencial "Odontóloga" → "Odontólogo" en settings.doctor
  const row = await prisma.clinicSetting.findUnique({ where: { key: "doctor" } });
  if (row) {
    const doctor = JSON.parse(row.value);
    if (Array.isArray(doctor.credentials)) {
      doctor.credentials = doctor.credentials.map((c: string) => c.replace(/^Odontóloga\b/, "Odontólogo"));
    }
    await prisma.clinicSetting.update({ where: { key: "doctor" }, data: { value: JSON.stringify(doctor) } });
    console.log("✓ settings.doctor.credentials:", doctor.credentials[0]);
  }

  // 2) Usuario admin: "Dra. María José Pacurucu" → "Dr. Miguel Pacurucu" (como lo definió en el panel)
  const users = await prisma.user.findMany();
  for (const u of users) {
    if (/Dra\.|María José|doctora/i.test(u.name)) {
      await prisma.user.update({ where: { id: u.id }, data: { name: "Dr. Miguel Pacurucu" } });
      console.log(`✓ user '${u.name}' → 'Dr. Miguel Pacurucu'`);
    }
  }

  // 3) Testimonio: "La doctora me explicó" → "El doctor me explicó"
  const tms = await prisma.testimonial.findMany();
  for (const t of tms) {
    const fixed = t.text
      .replace(/\bLa doctora\b/g, "El doctor")
      .replace(/\bla doctora\b/g, "el doctor");
    if (fixed !== t.text) {
      await prisma.testimonial.update({ where: { id: t.id }, data: { text: fixed } });
      console.log(`✓ testimonio [${t.id}] corregido`);
    }
  }

  // 4) FAQ: "la doctora te indicará" → "el doctor te indicará"
  const faqs = await prisma.faqItem.findMany();
  for (const f of faqs) {
    const fixed = f.answer.replace(/\bla doctora\b/g, "el doctor").replace(/\bLa doctora\b/g, "El doctor");
    if (fixed !== f.answer) {
      await prisma.faqItem.update({ where: { id: f.id }, data: { answer: fixed } });
      console.log(`✓ FAQ [${f.id}] corregida: ${f.question}`);
    }
  }

  await prisma.$disconnect();
  console.log("— Base de datos actualizada —");
}

main().catch((e) => { console.error(e); process.exit(1); });
