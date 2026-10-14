// PUT/DELETE /api/admin/services/[id] — edición y borrado de servicios.
// El borrado es soft para el catálogo: las citas históricas conservan snapshot.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceInputSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Cuerpo inválido.", 400);

    const parsed = serviceInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del servicio.", 400);
    }

    const data = parsed.data;
    const service = await db.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });

    return jsonOk({ service });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    // ¿El servicio tiene citas activas futuras? → solo desactivar
    const futureAppts = await db.appointmentService.count({
      where: {
        serviceId: id,
        appointment: { date: { gte: new Date().toISOString().slice(0, 10) }, status: { in: ["PENDING", "CONFIRMED"] } },
      },
    });
    if (futureAppts > 0) {
      await db.service.update({ where: { id }, data: { active: false } });
      return jsonOk({
        message: "El servicio tiene citas activas: se desactivó en el catálogo y se conservó en las citas existentes.",
      });
    }

    await db.appointmentService.updateMany({ where: { serviceId: id }, data: { serviceId: null } });
    await db.service.delete({ where: { id } });
    return jsonOk({ message: "Servicio eliminado." });
  } catch (e) {
    return handleError(e);
  }
}
