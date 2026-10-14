// ¿Qué servicios tienen imagen real? Decide el tratamiento visual de las tarjetas.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const services = await db.service.findMany({
    select: { name: true, category: true, imageUrl: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const s of services) {
    console.log(`${s.imageUrl ? "IMG " : "SIN "}| ${s.category} | ${s.name} | ${s.imageUrl ?? ""}`);
  }
  await db.$disconnect();
}

main();
