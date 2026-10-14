// GET/POST /api/admin/invoices — listado (paginado) + generación desde cita completada.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { z } from "zod";

import { requireAdminSession, jsonError, jsonOk, handleError, pageParams, pageCount } from "@/lib/api";
import { createInvoiceFromAppointment } from "@/modules/invoicing/invoicing";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const { page, pageSize } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const year = url.searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (year) where.date = { startsWith: year };
    if (q) {
      where.patient = {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
        ],
      };
    }

    const [total, invoices] = await Promise.all([
      db.invoice.count({ where }),
      db.invoice.findMany({
        where,
        include: { patient: true },
        orderBy: { number: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return jsonOk({
      items: invoices.map((i) => ({
        id: i.id, number: i.number, date: i.date, patientId: i.patientId,
        patientName: `${i.patient.firstName} ${i.patient.lastName}`,
        total: i.total, subtotal: i.subtotal, paymentMethod: i.paymentMethod,
        appointmentId: i.appointmentId,
      })),
      total, page, pageCount: pageCount(total, pageSize),
    });
  } catch (e) {
    return handleError(e);
  }
}

const createSchema = z.object({ appointmentId: z.string() });

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError("appointmentId requerido.", 400);

    const invoice = await createInvoiceFromAppointment(parsed.data.appointmentId);
    return jsonOk({ invoice }, 201);
  } catch (e) {
    if (e instanceof DomainError) return jsonError(e.message, e.status);
    return handleError(e);
  }
}
