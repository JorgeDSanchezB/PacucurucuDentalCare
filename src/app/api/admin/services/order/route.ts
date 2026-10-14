// PATCH /api/admin/services/order — reordenamiento drag-and-drop.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

const orderSchema = z.object({
  items: z
    .array(z.object({ id: z.string(), sortOrder: z.number().int().min(0) }))
    .min(1, "Lista de orden vacía"),
});

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) return jsonError("Orden inválido.", 400);

    await db.$transaction(
      parsed.data.items.map((item) =>
        db.service.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
