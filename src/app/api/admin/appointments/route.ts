// GET/POST /api/admin/appointments — listado con filtros y creación manual.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { appointmentCreateSchema } from "@/lib/validators";
import { createAppointment, serializeAppointment } from "@/modules/appointments/appointments";
import { requireAdminSession, jsonError, jsonOk, handleError, pageParams, pageCount } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const { page, pageSize } = pageParams(url);
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    const q = url.searchParams.get("q")?.trim();

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
    if (date) where.date = date;
    if (q) {
      where.patient = {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      };
    }

    const [total, appointments] = await Promise.all([
      db.appointment.count({ where }),
      db.appointment.findMany({
        where,
        include: { patient: true, services: true, invoice: { select: { id: true } } },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return jsonOk({
      items: appointments.map((a) => ({
        id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime,
        status: a.status, source: a.source, notes: a.notes, adminNotes: a.adminNotes,
        createdAt: a.createdAt.toISOString(),
        patient: {
          id: a.patient.id, firstName: a.patient.firstName, lastName: a.patient.lastName,
          phone: a.patient.phone, email: a.patient.email,
        },
        services: a.services.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
        hasInvoice: !!a.invoice,
      })),
      total,
      page,
      pageCount: pageCount(total, pageSize),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = appointmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos de la cita.", 400);
    }

    const data = parsed.data;

    let patientData: { firstName: string; lastName: string; email: string; phone: string };

    if (data.patientId) {
      const patient = await db.patient.findUnique({ where: { id: data.patientId } });
      if (!patient) return jsonError("Paciente no encontrado.", 404);
      patientData = {
        firstName: patient.firstName, lastName: patient.lastName,
        email: patient.email, phone: patient.phone,
      };
    } else if (data.newPatient) {
      const existing = await db.patient.findUnique({
        where: { email: data.newPatient.email.toLowerCase() },
      });
      if (existing) {
        return jsonError("Ya existe un paciente con ese email. Selecciónalo en la lista.", 409);
      }
      patientData = data.newPatient;
    } else {
      return jsonError("Selecciona un paciente o crea uno nuevo.", 400);
    }

    const appointment = await createAppointment({
      serviceIds: data.serviceIds,
      patient: patientData,
      date: data.date,
      startTime: data.startTime,
      notes: data.notes,
      source: "ADMIN",
      initialStatus: data.status ?? "CONFIRMED",
    });

    return jsonOk({ appointment }, 201);
  } catch (e) {
    if (e instanceof DomainError) return jsonError(e.message, e.status);
    return handleError(e);
  }
}
