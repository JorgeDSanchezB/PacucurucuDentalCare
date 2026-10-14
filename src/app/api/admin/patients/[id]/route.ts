// GET/PUT/DELETE /api/admin/patients/[id] — ficha completa (citas, historial, facturas).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { patientInputSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

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
        invoices: { orderBy: { date: "desc" } },
      },
    });
    if (!patient) return jsonError("Paciente no encontrado.", 404);

    return jsonOk({
      patient: {
        id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
        email: patient.email, phone: patient.phone, birthDate: patient.birthDate,
        createdAt: patient.createdAt.toISOString(),
      },
      appointments: patient.appointments.map((a) => ({
        id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime,
        status: a.status, source: a.source, notes: a.notes, adminNotes: a.adminNotes,
        createdAt: a.createdAt.toISOString(),
        patient: {
          id: patient.id, firstName: patient.firstName, lastName: patient.lastName,
          phone: patient.phone, email: patient.email,
        },
        services: a.services.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
        hasInvoice: !!a.invoice,
      })),
      clinicalNotes: patient.clinicalNotes.map((n) => ({
        id: n.id, date: n.date, treatment: n.treatment,
        observations: n.observations, privateNotes: n.privateNotes, appointmentId: n.appointmentId,
      })),
      invoices: patient.invoices.map((i) => ({
        id: i.id, number: i.number, date: i.date, patientId: i.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        total: i.total, subtotal: i.subtotal, paymentMethod: i.paymentMethod,
        appointmentId: i.appointmentId,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    const parsed = patientInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del paciente.", 400);
    }

    const data = parsed.data;
    if (data.email) {
      const email = data.email.toLowerCase().trim();
      const dup = await db.patient.findUnique({ where: { email } });
      if (dup && dup.id !== id) return jsonError("Otro paciente ya usa ese email.", 409);
    }

    const patient = await db.patient.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase().trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.birthDate !== undefined ? { birthDate: data.birthDate || null } : {}),
      },
    });
    return jsonOk({ patient });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true, clinicalNotes: true, invoices: true } } },
    });
    if (!patient) return jsonError("Paciente no encontrado.", 404);

    // Borrado completo y explícito en una transacción, en orden de
    // dependencias (antes dependía de las cascadas implícitas y se
    // bloqueaba si había facturas; el odontólogo pidió poder borrar
    // con todo lo asociado, avisando en el diálogo de confirmación).
    await db.$transaction(async (tx) => {
      await tx.bookingRequest.deleteMany({ where: { appointment: { patientId: id } } });
      await tx.appointmentService.deleteMany({ where: { appointment: { patientId: id } } });
      await tx.clinicalNote.deleteMany({ where: { patientId: id } });
      await tx.invoice.deleteMany({ where: { patientId: id } });
      await tx.appointment.deleteMany({ where: { patientId: id } });
      await tx.patient.delete({ where: { id } });
    });

    return jsonOk({
      deleted: {
        appointments: patient._count.appointments,
        clinicalNotes: patient._count.clinicalNotes,
        invoices: patient._count.invoices,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
