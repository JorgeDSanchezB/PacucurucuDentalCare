// GET/POST /api/admin/services — listado completo (admin) y creación.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceInputSchema, slugify } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const services = await db.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return jsonOk({
      services: services.map((s) => ({
        id: s.id, name: s.name, slug: s.slug, description: s.description,
        duration: s.duration, price: s.price, category: s.category,
        imageUrl: s.imageUrl, active: s.active, sortOrder: s.sortOrder,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Cuerpo inválido.", 400);

    const parsed = serviceInputSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del servicio.", 400);
    }

    const data = parsed.data;
    // slug único: base + sufijo si colisiona
    let slug = slugify(data.name) || "servicio";
    const existing = await db.service.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const maxOrder = await db.service.aggregate({ _max: { sortOrder: true } });

    const service = await db.service.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        duration: data.duration,
        price: data.price,
        category: data.category,
        imageUrl: data.imageUrl || null,
        active: data.active,
        sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return jsonOk({ service }, 201);
  } catch (e) {
    return handleError(e);
  }
}
