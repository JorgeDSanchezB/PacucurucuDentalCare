// DELETE /api/admin/invoices/[id] — borrado de factura interna.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const invoice = await db.invoice.findUnique({ where: { id }, select: { number: true } });
    if (!invoice) return jsonError("Factura no encontrada.", 404);

    // La factura no tiene dependientes; el borrado es directo. Si estaba
    // ligada a una cita, la cita queda intacta (podrá facturarse de nuevo).
    await db.invoice.delete({ where: { id } });
    return jsonOk({ number: invoice.number });
  } catch (e) {
    return handleError(e);
  }
}
