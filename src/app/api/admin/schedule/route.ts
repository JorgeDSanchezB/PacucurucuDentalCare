// GET/PUT /api/admin/schedule — horarios semanales + bloqueos de fechas.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleUpdateSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const [schedule, dateBlocks] = await Promise.all([
      db.schedule.findMany({ orderBy: { dayOfWeek: "asc" } }),
      db.dateBlock.findMany({ orderBy: { date: "asc" } }),
    ]);
    return jsonOk({
      schedule: schedule.map((s) => ({
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive,
      })),
      dateBlocks: dateBlocks.map((b) => ({ id: b.id, date: b.date, reason: b.reason })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = scheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los horarios.", 400);
    }

    for (const row of parsed.data.schedule) {
      if (row.startTime >= row.endTime) {
        return jsonError("La hora de inicio debe ser menor a la hora de fin.", 400);
      }
    }

    await db.$transaction(
      parsed.data.schedule.map((row) =>
        db.schedule.upsert({
          where: { dayOfWeek: row.dayOfWeek },
          update: {
            startTime: row.startTime, endTime: row.endTime, isActive: row.isActive,
          },
          create: row,
        })
      )
    );

    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
