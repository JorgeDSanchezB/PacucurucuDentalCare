// GET /api/admin/contact-messages — bandeja de mensajes del formulario público.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, jsonOk, handleError, pageParams, pageCount } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const { page, pageSize } = pageParams(url);

    const [total, messages] = await Promise.all([
      db.contactMessage.count(),
      db.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return jsonOk({
      items: messages.map((m) => ({
        id: m.id, name: m.name, email: m.email, phone: m.phone,
        message: m.message, read: m.read, createdAt: m.createdAt.toISOString(),
      })),
      total, page, pageCount: pageCount(total, pageSize),
    });
  } catch (e) {
    return handleError(e);
  }
}
