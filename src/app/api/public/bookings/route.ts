// POST /api/public/bookings — crea la solicitud de reserva (flujo v1).
// Tolerancia a fallos: la cita se persiste ANTES de cualquier notificación.
import { NextRequest, NextResponse } from "next/server";
import { bookingSchema } from "@/lib/validators";
import { DomainError } from "@/lib/domain-error";

import { notifyDoctorOfBooking } from "@/lib/whatsapp";
import { createAppointment } from "@/modules/appointments/appointments";
import { db } from "@/lib/db";
import { jsonError, jsonOk, handleError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Cuerpo de la solicitud inválido.", 400);

    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del formulario.", 400);
    }

    const appointment = await createAppointment({
      ...parsed.data,
      source: "PUBLIC_FORM",
      initialStatus: "PENDING",
    });

    // Notificación al odontólogo (flag-aware; nunca rompe el flujo si falla)
    let doctorNotified: "SENT" | "SIMULATED" | "FAILED" = "FAILED";
    try {
      const result = await notifyDoctorOfBooking(appointment);
      doctorNotified = result.status;
      await db.bookingRequest.updateMany({
        where: { appointmentId: appointment.id },
        data: { doctorNotified },
      });
    } catch {
      // la solicitud ya está persistida; queda como FAILED para reintento
    }

    return jsonOk(
      {
        appointmentId: appointment.id,
        message:
          "Tu solicitud ha sido recibida. El odontólogo te contactará por WhatsApp para confirmar la cita.",
      },
      201
    );
  } catch (e) {
    if (e instanceof DomainError) return jsonError(e.message, e.status);
    return handleError(e);
  }
}
