// GET/POST /api/admin/clinical-notes — notas del historial clínico.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clinicalNoteSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = clinicalNoteSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa la nota clínica.", 400);
    }

    const data = parsed.data;
    const patient = await db.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) return jsonError("Paciente no encontrado.", 404);

    if (data.appointmentId) {
      const appt = await db.appointment.findUnique({ where: { id: data.appointmentId } });
      if (!appt || appt.patientId !== data.patientId) {
        return jsonError("La cita seleccionada no pertenece a este paciente.", 400);
      }
    }

    const note = await db.clinicalNote.create({
      data: {
        patientId: data.patientId,
        appointmentId: data.appointmentId || null,
        date: data.date,
        treatment: data.treatment,
        observations: data.observations || null,
        privateNotes: data.privateNotes || null,
      },
    });

    return jsonOk({ note }, 201);
  } catch (e) {
    return handleError(e);
  }
}
