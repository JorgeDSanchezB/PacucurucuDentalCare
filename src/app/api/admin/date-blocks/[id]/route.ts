// DELETE /api/admin/date-blocks/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await db.dateBlock.delete({ where: { id } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
