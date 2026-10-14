// GET /api/admin/invoices/export — listado completo en CSV.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, handleError } from "@/lib/api";

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const invoices = await db.invoice.findMany({
      include: { patient: true, appointment: { include: { services: true } } },
      orderBy: { number: "asc" },
    });

    const header = ["numero", "fecha", "paciente", "servicios", "subtotal", "total", "metodo_pago"];
    const rows = invoices.map((i) => {
      const services = i.appointment?.services.map((s) => s.name).join(" / ") ?? "";
      return [
        `FAC-${String(i.number).padStart(4, "0")}`,
        i.date,
        `${i.patient.firstName} ${i.patient.lastName}`,
        services,
        i.subtotal.toFixed(2),
        i.total.toFixed(2),
        i.paymentMethod,
      ].map(csvEscape).join(",");
    });

    const csv = `\uFEFF${header.join(",")}\n${rows.join("\n")}\n`; // BOM para Excel en español

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facturas-pacurucu.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
