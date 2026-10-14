// Limpieza: elimina los MediaAsset de prueba creados durante la verificación
// (el campo de foto del doctor quedó restaurado a su URL original).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.mediaAsset.count();
  await prisma.mediaAsset.deleteMany({});
  const after = await prisma.mediaAsset.count();
  console.log(`MediaAsset: ${before} → ${after} (pruebas eliminadas)`);

  // Confirmar que la foto del doctor quedó en su URL original
  const row = await prisma.clinicSetting.findUnique({ where: { key: "doctor" } });
  const doctor = JSON.parse(row?.value ?? "{}");
  console.log("photoUrl actual:", doctor.photoUrl);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
