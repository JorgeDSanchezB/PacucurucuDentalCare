// PUT/DELETE /api/admin/appointments/[id] — edición, re-agendado, cambio de estado, borrado.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { appointmentUpdateSchema } from "@/lib/validators";
import {
  updateAppointmentStatus, rescheduleAppointment, serializeAppointment,
} from "@/modules/appointments/appointments";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    const parsed = appointmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos de la cita.", 400);
    }

    const data = parsed.data;

    // Re-agendado
    if (data.date && data.startTime) {
      await rescheduleAppointment(id, data.date, data.startTime);
    }

    // Notas
    if (data.notes !== undefined || data.adminNotes !== undefined) {
      await db.appointment.update({
        where: { id },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
        },
      });
    }

    // Cambio de estado (con efectos de notificación)
    if (data.status) {
      await updateAppointmentStatus(id, data.status);
    }

    const appointment = await serializeAppointment(id);
    return jsonOk({ appointment });
  } catch (e) {
    if (e instanceof DomainError) return jsonError(e.message, e.status);
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const appt = await db.appointment.findUnique({ where: { id }, include: { invoice: true } });
    if (!appt) return jsonError("Cita no encontrada.", 404);
    if (appt.invoice) {
      return jsonError("No se puede borrar una cita con factura emitida. Márcala como cancelada.", 409);
    }

    await db.appointment.delete({ where: { id } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
