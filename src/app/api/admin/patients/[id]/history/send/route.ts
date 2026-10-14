// POST /api/admin/patients/[id]/history/send — envío del historial por email.
// Fallback garantizado: si el email falla, la descarga sigue disponible.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmailWithAttachment } from "@/lib/email";
import { generateClinicalHistoryPdf } from "@/lib/pdf";
import { getSettings } from "@/modules/settings/settings";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

const bodySchema = z.object({ email: z.string().email().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          include: { services: true, invoice: { select: { id: true } } },
          orderBy: [{ date: "desc" }, { startTime: "asc" }],
        },
        clinicalNotes: { orderBy: { date: "desc" } },
      },
    });
    if (!patient) return jsonError("Paciente no encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Email inválido.", 400);

    const to = parsed.data.email || patient.email;
    const settings = await getSettings();

    const pdfBytes = await generateClinicalHistoryPdf(
      {
        id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
        email: patient.email, phone: patient.phone, birthDate: patient.birthDate,
        createdAt: patient.createdAt.toISOString(),
      },
      patient.clinicalNotes.map((n) => ({
        id: n.id, date: n.date, treatment: n.treatment,
        observations: n.observations, privateNotes: n.privateNotes, appointmentId: n.appointmentId,
      })),
      patient.appointments.map((a) => ({
        id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime,
        status: a.status as never, source: a.source, notes: a.notes, adminNotes: a.adminNotes,
        createdAt: a.createdAt.toISOString(),
        patient: {
          id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
          phone: patient.phone, email: patient.email,
        },
        services: a.services.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
        hasInvoice: !!a.invoice,
      })),
      settings
    );

    const result = await sendEmailWithAttachment({
      to,
      subject: `Historial clínico · ${settings.clinic.name}`,
      text: `Hola ${patient.firstName}, adjunto encontrarás tu historial clínico de ${settings.clinic.name}. Cualquier duda, escríbenos a ${settings.clinic.email}.`,
      pdfBytes,
      filename: "historial-clinico.pdf",
    });

    // Auditoría del intento
    await db.notificationLog.create({
      data: {
        type: "EMAIL_HISTORY",
        status: result.status,
        toAddress: to,
        payload: JSON.stringify({ patientId: patient.id }),
        error: result.error ?? null,
      },
    }).catch(() => undefined);

    return jsonOk({
      emailStatus: result.status,
      message: result.message,
      downloadUrl: `/api/admin/patients/${patient.id}/history/pdf`,
    });
  } catch (e) {
    return handleError(e);
  }
}
