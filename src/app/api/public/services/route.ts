// GET /api/public/services — catálogo activo para el sitio y el selector de reserva.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/lib/api";

export async function GET() {
  try {
    const services = await db.service.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true,
        duration: true, price: true, category: true, imageUrl: true, sortOrder: true,
      },
    });
    return NextResponse.json({ ok: true, services });
  } catch (e) {
    return handleError(e);
  }
}
