// Consulta rápida del tema DB (colores vivos que el AppShell inyecta como CSS vars).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const rows = await db.clinicSetting.findMany();
  for (const r of rows) {
    let v = r.value;
    try { v = JSON.parse(r.value); } catch { /* texto plano */ }
    console.log(`\n■ ${r.key}:\n${JSON.stringify(v, null, 1)}`);
  }
  await db.$disconnect();
}

main();
