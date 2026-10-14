// POST /api/admin/date-blocks — bloquear una fecha (vacaciones, feriado).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateBlockSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = dateBlockSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa la fecha a bloquear.", 400);
    }

    const block = await db.dateBlock.upsert({
      where: { date: parsed.data.date },
      update: { reason: parsed.data.reason },
      create: parsed.data,
    });

    return jsonOk({ block }, 201);
  } catch (e) {
    return handleError(e);
  }
}
