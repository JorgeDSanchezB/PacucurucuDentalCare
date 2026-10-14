// PUT/DELETE /api/admin/clinical-notes/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clinicalNoteSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    const parsed = clinicalNoteSchema.partial().safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa la nota clínica.", 400);
    }

    const data = parsed.data;
    const note = await db.clinicalNote.update({
      where: { id },
      data: {
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.treatment !== undefined ? { treatment: data.treatment } : {}),
        ...(data.observations !== undefined ? { observations: data.observations || null } : {}),
        ...(data.privateNotes !== undefined ? { privateNotes: data.privateNotes || null } : {}),
      },
    });
    return jsonOk({ note });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await db.clinicalNote.delete({ where: { id } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
