// GET/POST /api/admin/patients — listado con búsqueda + creación.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { patientInputSchema } from "@/lib/validators";
import { requireAdminSession, jsonError, jsonOk, handleError, pageParams, pageCount } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const { page, pageSize } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();

    const where = q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

    const [total, patients, counts] = await Promise.all([
      db.patient.count({ where }),
      db.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          birthDate: true, createdAt: true,
        },
      }),
      db.appointment.groupBy({ by: ["patientId"], _count: { id: true } }),
    ]);

    const countMap = new Map(counts.map((c) => [c.patientId, c._count.id]));

    return jsonOk({
      items: patients.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        appointmentCount: countMap.get(p.id) ?? 0,
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
    const parsed = patientInputSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del paciente.", 400);
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await db.patient.findUnique({ where: { email } });
    if (existing) return jsonError("Ya existe un paciente con ese email.", 409);

    const patient = await db.patient.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        phone: parsed.data.phone,
        birthDate: parsed.data.birthDate || null,
      },
    });

    return jsonOk({ patient }, 201);
  } catch (e) {
    return handleError(e);
  }
}
