// PATCH /api/admin/contact-messages/[id] — marcar leído/no leído.
// DELETE — borrar el mensaje de la bandeja.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

const bodySchema = z.object({ read: z.boolean() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Valor inválido.", 400);

    await db.contactMessage.update({ where: { id }, data: { read: parsed.data.read } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const msg = await db.contactMessage.findUnique({ where: { id } });
    if (!msg) return jsonError("Mensaje no encontrado.", 404);

    await db.contactMessage.delete({ where: { id } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
