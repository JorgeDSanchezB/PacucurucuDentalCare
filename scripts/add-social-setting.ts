// Inserta la clave "social" (redes del pie) en la BD viva sin tocar nada más.
// Idempotente: si ya existe (p. ej. el doctor ya guardó algo desde el panel),
// no se sobrescribe. WhatsApp hereda el número ya guardado en clinic.whatsapp.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const existing = await db.clinicSetting.findUnique({ where: { key: "social" } });
  if (existing) {
    console.log("La clave 'social' ya existe; no se toca:", existing.value);
    return;
  }

  let whatsapp = "+593 98 612 4470";
  const clinic = await db.clinicSetting.findUnique({ where: { key: "clinic" } });
  if (clinic) {
    try {
      const parsed = JSON.parse(clinic.value) as { whatsapp?: string };
      if (parsed.whatsapp && parsed.whatsapp.trim()) whatsapp = parsed.whatsapp.trim();
    } catch {
      // valor corrupto → se usa el número por defecto
    }
  }

  const value = JSON.stringify({ whatsapp, instagram: "", facebook: "", tiktok: "" });
  await db.clinicSetting.create({ data: { key: "social", value } });
  console.log("Clave 'social' creada:", value);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
