// Inspección: textos con género en la BD viva (settings, admin, testimonios, FAQ)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.clinicSetting.findMany();
  const parsed: Record<string, any> = {};
  for (const r of rows) parsed[r.key] = JSON.parse(r.value);

  console.log("=== SETTINGS.doctor ===");
  console.log(JSON.stringify(parsed.doctor, null, 2));
  console.log("\n=== SETTINGS.clinic (nombre) ===");
  console.log(parsed.clinic?.name, "|", parsed.clinic?.tagline);
  console.log("\n=== SETTINGS.about ===");
  console.log(JSON.stringify(parsed.about));
  console.log("\n=== SETTINGS.hero ===");
  console.log(JSON.stringify(parsed.hero));

  console.log("\n=== USER (admin) ===");
  const users = await prisma.user.findMany();
  for (const u of users) console.log(`name=${u.name} email=${u.email}`);

  console.log("\n=== TESTIMONIOS con 'doctora' ===");
  const tms = await prisma.testimonial.findMany();
  for (const t of tms) if (/doctora|dra\.|odontóloga/i.test(`${t.patientName} ${t.text}`)) console.log(`[${t.id}] ${t.patientName}: ${t.text}`);

  console.log("\n=== FAQ con 'doctora' ===");
  const faqs = await prisma.faqItem.findMany();
  for (const f of faqs) if (/doctora|dra\./i.test(`${f.question} ${f.answer}`)) console.log(`[${f.id}] ${f.question} -> ${f.answer}`);

  console.log("\n=== GALERIA / SERVICIOS (revisión) ===");
  const gal = await prisma.galleryItem.findMany();
  for (const g of gal) if (/doctora|dra\./i.test(`${g.title}`)) console.log(`GALERIA: ${g.title}`);
  const srv = await prisma.service.findMany();
  for (const s of srv) if (/doctora|dra\.|odontóloga/i.test(`${s.name} ${s.description}`)) console.log(`SERVICIO: ${s.name}: ${s.description}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
