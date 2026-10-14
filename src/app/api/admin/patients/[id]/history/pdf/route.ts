// GET /api/admin/patients/[id]/history/pdf — historial clínico en PDF.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateClinicalHistoryPdf } from "@/lib/pdf";
import { getSettings } from "@/modules/settings/settings";
import { requireAdminSession, handleError } from "@/lib/api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Paciente no encontrado." }, { status: 404 });
    }

    const settings = await getSettings();
    const bytes = await generateClinicalHistoryPdf(
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

    const filename = `historial-${patient.firstName}-${patient.lastName}.pdf`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
